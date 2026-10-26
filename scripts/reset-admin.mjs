import 'dotenv/config';
import mongoose from 'mongoose';
import { randomBytes, scryptSync } from 'node:crypto';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is missing');

const email = (process.env.SEED_ADMIN_EMAIL || 'admin@buildright.local').toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe-Admin-2026';

const salt = randomBytes(16).toString('hex');
const hash = scryptSync(password, salt, 32).toString('hex');
const passwordHash = `scrypt$${salt}$${hash}`;

await mongoose.connect(uri);
const users = mongoose.connection.collection('users');
const admins = mongoose.connection.collection('admins');

const doc = await users.findOneAndUpdate(
  { email },
  {
    $set: {
      passwordHash,
      role: 'admin',
      accountStatus: 'active',
      disabled: false,
      name: 'BuildRight Admin',
    },
    $setOnInsert: { email, createdAt: new Date() },
  },
  { upsert: true, returnDocument: 'after' },
);

const user = doc.value || doc;
await admins.updateOne(
  { email },
  {
    $set: {
      name: 'BuildRight Admin',
      email,
      passwordHash,
      role: 'superadmin',
      accountStatus: 'active',
      userId: user._id,
    },
  },
  { upsert: true },
);

console.log(JSON.stringify({
  ok: true,
  email,
  password,
  role: user.role,
  accountStatus: user.accountStatus,
}));

await mongoose.disconnect();
