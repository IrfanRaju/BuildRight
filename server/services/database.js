import mongoose from 'mongoose';
import { AuditLog } from '../models/index.js';

const globalForMongo = globalThis;

export async function connectDatabase(uri) {
  if (!uri) {
    console.warn('MONGODB_URI is not set. API routes that need storage will return 503.');
    return false;
  }

  if (mongoose.connection.readyState === 1) return true;

  if (!globalForMongo.__buildrightMongoPromise) {
    globalForMongo.__buildrightMongoPromise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: process.env.VERCEL ? 5 : 10,
    }).then(() => {
      console.info('BuildRight API connected to MongoDB.');
      return true;
    }).catch((error) => {
      globalForMongo.__buildrightMongoPromise = null;
      console.error('BuildRight API could not connect to MongoDB:', error.message);
      throw error;
    });
  }

  try {
    await globalForMongo.__buildrightMongoPromise;
    return true;
  } catch {
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
