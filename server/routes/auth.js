import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Admin, User } from '../models/index.js';
import { isEmail, httpError } from '../lib/http.js';
import { signAccessToken } from '../middleware/auth.js';
import { recordAudit } from '../services/database.js';

const SALT_BYTES = 16;
const KEY_BYTES = 32;

export function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const hash = scryptSync(password, salt, KEY_BYTES).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const actual = scryptSync(password, salt, KEY_BYTES);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus || (user.disabled ? 'disabled' : 'active'),
    createdAt: user.createdAt,
  };
}

function assertPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    throw httpError(400, 'Password must be 8 to 72 characters.');
  }
}

export function createAuthRouter({ Router, env, requireDatabase }) {
  const router = Router();

  router.post('/register', requireDatabase, async (req, res, next) => {
    try {
      const name = String(req.body?.name || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = req.body?.password;
      if (name.length < 2 || name.length > 80) throw httpError(400, 'Name must be 2 to 80 characters.');
      if (!isEmail(email)) throw httpError(400, 'Enter a valid email address.');
      assertPassword(password);
      const existing = await User.findOne({ email });
      if (existing) throw httpError(409, 'An account with this email already exists.');
      const user = await User.create({ name, email, passwordHash: hashPassword(password) });
      await recordAudit(req, 'auth.register', 'User', user._id);
      const token = signAccessToken(user, env.jwtSecret);
      res.status(201).json({ ok: true, token, user: publicUser(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/login', requireDatabase, async (req, res, next) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!isEmail(email) || !password) throw httpError(400, 'Email and password are required.');
      const user = await User.findOne({ email }).select('+passwordHash');
      if (!user) throw httpError(401, 'No account found with this email address.');
      if (!verifyPassword(password, user.passwordHash)) throw httpError(401, 'Invalid email or password.');
      if (user.disabled || user.accountStatus === 'disabled' || user.accountStatus === 'suspended') {
        throw httpError(403, 'This account has been disabled.');
      }
      if (user.role === 'admin') {
        await Admin.findOneAndUpdate(
          { email: user.email },
          {
            $set: { name: user.name, accountStatus: user.accountStatus || 'active', userId: user._id, role: 'admin' },
            $setOnInsert: { passwordHash: user.passwordHash },
          },
          { upsert: true },
        );
      }
      await recordAudit(req, 'auth.login', 'User', user._id);
      res.json({ ok: true, token: signAccessToken(user, env.jwtSecret), user: publicUser(user) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', requireDatabase, async (req, res, next) => {
    try {
      const header = req.get('authorization') || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';
      if (!token) throw httpError(401, 'Sign in is required.');
      const { readToken } = await import('../middleware/auth.js');
      const claims = readToken(req, env.jwtSecret);
      if (!claims?.sub) throw httpError(401, 'Sign in is required.');
      const user = await User.findById(claims.sub);
      if (!user || user.disabled) throw httpError(401, 'Sign in is required.');
      res.json({ ok: true, user: publicUser(user) });
    } catch (error) {
      next(error.status ? error : httpError(401, 'Your session is no longer valid.'));
    }
  });

  router.put('/profile', requireDatabase, async (req, res, next) => {
    try {
      const { readToken } = await import('../middleware/auth.js');
      const claims = readToken(req, env.jwtSecret);
      if (!claims?.sub) throw httpError(401, 'Sign in is required.');
      const name = String(req.body?.name || '').trim();
      if (name.length < 2 || name.length > 80) throw httpError(400, 'Name must be 2 to 80 characters.');
      const user = await User.findByIdAndUpdate(claims.sub, { name }, { new: true });
      if (!user) throw httpError(404, 'Account was not found.');
      res.json({ ok: true, user: publicUser(user) });
    } catch (error) {
      next(error);
    }
  });

  router.put('/password', requireDatabase, async (req, res, next) => {
    try {
      const { readToken } = await import('../middleware/auth.js');
      const claims = readToken(req, env.jwtSecret);
      if (!claims?.sub) throw httpError(401, 'Sign in is required.');
      assertPassword(req.body?.nextPassword);
      const user = await User.findById(claims.sub).select('+passwordHash');
      if (!user || !verifyPassword(String(req.body?.currentPassword || ''), user.passwordHash)) {
        throw httpError(400, 'Current password is incorrect.');
      }
      user.passwordHash = hashPassword(req.body.nextPassword);
      await user.save();
      await recordAudit(req, 'auth.password', 'User', user._id);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/forgot-password', requireDatabase, async (req, res, next) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!isEmail(email)) throw httpError(400, 'Enter a valid email address.');
      const user = await User.findOne({ email }).select('+resetTokenHash');
      const payload = { ok: true, message: 'If an account exists for that email, a reset token has been created.' };
      if (user && !user.disabled) {
        const token = randomBytes(24).toString('hex');
        user.resetTokenHash = tokenHash(token);
        user.resetTokenExpires = new Date(Date.now() + 1000 * 60 * 30);
        await user.save();
        if (env.nodeEnv !== 'production') payload.developmentResetToken = token;
      }
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.post('/reset-password', requireDatabase, async (req, res, next) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const token = String(req.body?.token || '');
      assertPassword(req.body?.password);
      if (!isEmail(email) || token.length < 20) throw httpError(400, 'Email and reset token are required.');
      const user = await User.findOne({ email }).select('+passwordHash +resetTokenHash +resetTokenExpires');
      if (!user || !user.resetTokenHash || !user.resetTokenExpires || user.resetTokenExpires.getTime() < Date.now()) {
        throw httpError(400, 'The reset token is invalid or has expired.');
      }
      const actual = Buffer.from(tokenHash(token));
      const expected = Buffer.from(user.resetTokenHash);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        throw httpError(400, 'The reset token is invalid or has expired.');
      }
      user.passwordHash = hashPassword(req.body.password);
      user.resetTokenHash = undefined;
      user.resetTokenExpires = undefined;
      await user.save();
      res.json({ ok: true, message: 'Password updated. You can sign in with the new password.' });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
