import mongoose from 'mongoose';
import { AuditLog } from '../models/index.js';

export async function connectDatabase(uri) {
  if (!uri) {
    console.warn('MONGODB_URI is not set. API routes that need storage will return 503.');
    return false;
  }
  try {
    await mongoose.connect(uri);
    console.info('BuildRight API connected to MongoDB.');
    return true;
  } catch (error) {
    console.error('BuildRight API could not connect to MongoDB:', error.message);
    return false;
  }
}

export function requireDatabase(_req, _res, next) {
  if (mongoose.connection.readyState !== 1) {
    return next(Object.assign(new Error('Database storage is unavailable. Start MongoDB and check MONGODB_URI.'), { status: 503 }));
  }
  return next();
}

export async function recordAudit(req, action, entity, entityId = '', meta = {}) {
  if (mongoose.connection.readyState !== 1) return;
  await AuditLog.create({
    actorId: req.user?.id || null,
    action,
    entity,
    entityId: String(entityId || ''),
    meta,
    ip: req.ip || '',
  }).catch((error) => console.error('Audit log failed:', error.message));
}
