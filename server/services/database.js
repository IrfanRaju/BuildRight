import mongoose from 'mongoose';
import { AuditLog } from '../models/index.js';

const globalForMongo = globalThis;

export async function connectDatabase(uri) {
  if (!uri) {
    console.warn('MONGODB_URI is not set. API routes that need storage will return 503.');
    return false;
  }

  // readyState: 0=disconnected 1=connected 2=connecting 3=disconnecting
  if (mongoose.connection.readyState === 1) return true;

  // Stale resolved promise after a drop would skip reconnect on Vercel warm instances.
  if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
    globalForMongo.__buildrightMongoPromise = null;
  }

  if (!globalForMongo.__buildrightMongoPromise) {
    globalForMongo.__buildrightMongoPromise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: process.env.VERCEL ? 1 : 10,
      serverSelectionTimeoutMS: 10000,
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
    return mongoose.connection.readyState === 1;
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
