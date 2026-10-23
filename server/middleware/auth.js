import jwt from 'jsonwebtoken';
import { httpError } from '../lib/http.js';

export function signAccessToken(user, secret) {
  return jwt.sign({ sub: String(user._id || user.id), role: user.role, email: user.email }, secret, { expiresIn: '7d' });
}

export function readToken(req, secret) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return null;
  return jwt.verify(token, secret);
}

export function requireUser(secret) {
  return (req, _res, next) => {
    if (!secret) return next(httpError(503, 'JWT_SECRET is not configured.'));
    try {
      const claims = readToken(req, secret);
      if (!claims?.sub) return next(httpError(401, 'Sign in is required.'));
      req.user = { id: claims.sub, role: claims.role, email: claims.email };
      return next();
    } catch (error) {
      return next(httpError(401, error.name === 'TokenExpiredError' ? 'Your session has expired.' : 'The authentication token is invalid.'));
    }
  };
}

export function requireRoles(secret, roles) {
  const authenticate = requireUser(secret);
  return (req, res, next) => authenticate(req, res, (error) => {
    if (error) return next(error);
    if (!roles.includes(req.user.role)) return next(httpError(403, 'You do not have access to this feature.'));
    return next();
  });
}

export function requireAdmin(secret) {
  return requireRoles(secret, ['admin']);
}

export function optionalUser(secret) {
  return (req, _res, next) => {
    if (!secret) return next();
    try {
      const claims = readToken(req, secret);
      if (claims?.sub) req.user = { id: claims.sub, role: claims.role, email: claims.email };
    } catch {
      req.user = null;
    }
    return next();
  };
}

export function assertOwner(record, user) {
  if (!record) throw httpError(404, 'The requested record was not found.');
  if (user.role === 'admin') return;
  if (!record.ownerId || String(record.ownerId) !== String(user.id)) {
    throw httpError(403, 'You do not have access to this record.');
  }
}
