import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { loadEnv } from './lib/http.js';
import { connectDatabase, requireDatabase } from './services/database.js';
import { optionalUser, requireAdmin, requireUser } from './middleware/auth.js';
import { createAuthRouter } from './routes/auth.js';
import { createEstimateRouter } from './routes/estimates.js';
import { createProjectRouter } from './routes/projects.js';
import { createCatalogRouter } from './routes/catalog.js';
import { createAdminRouter } from './routes/admin.js';
import { createDesignRouter } from './routes/designs.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { createMarketplaceRouter } from './routes/marketplace.js';
import { createRepairRouter } from './routes/repairs.js';
import { createConfigRouter } from './routes/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(options = {}) {
  const env = options.env || loadEnv();
  const app = express();

  app.disable('x-powered-by');
  if (process.env.VERCEL) app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    const started = Date.now();
    res.on('finish', () => console.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`));
    next();
  });

  // Ensure Mongo is ready on each serverless invocation (cached between warm starts).
  app.use(async (_req, _res, next) => {
    try {
      const connected = await connectDatabase(env.mongoUri);
      if (!connected && env.mongoUri) {
        return next(Object.assign(
          new Error('Database storage is unavailable. Start MongoDB and check MONGODB_URI.'),
          { status: 503 },
        ));
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  app.use(cors({ origin: env.webOrigin }));
  app.use(express.json({ limit: '3mb' }));
  if (!process.env.VERCEL) {
    app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));
  }
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

  const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
  const guards = {
    Router: express.Router,
    env,
    requireDatabase,
    requireUser: requireUser(env.jwtSecret),
    requireAdmin: requireAdmin(env.jwtSecret),
    optionalUser: optionalUser(env.jwtSecret),
  };

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      storage: mongoose.connection.readyState === 1 ? 'mongodb' : 'unavailable',
      ai: env.aiApiKey && env.aiProvider !== 'procedural' ? env.aiProvider : 'procedural',
      imagePreview: env.imageApiKey ? 'configured' : 'local-color-concept',
      runtime: process.env.VERCEL ? 'vercel' : 'node',
    });
  });

  app.use('/api/auth', authLimit, createAuthRouter(guards));
  app.use('/api/estimates', createEstimateRouter(guards));
  app.use('/api/projects', createProjectRouter(guards));
  app.use('/api', createCatalogRouter(guards));
  app.use('/api/admin', createAdminRouter(guards));
  app.use('/api', createConfigRouter(guards));
  app.use('/api/designs', createDesignRouter(guards));
  app.use('/api/dashboard', createDashboardRouter(guards));
  app.use('/api/marketplace', createMarketplaceRouter(guards));
  app.use('/api/repairs', createRepairRouter(guards));

  app.use((error, _req, res, _next) => {
    if (error.name === 'CastError') return res.status(400).json({ ok: false, error: 'The record id is invalid.' });
    if (error.code === 11000) return res.status(409).json({ ok: false, error: 'A record with that unique value already exists.' });
    const status = error.status || error.statusCode || 500;
    if (status >= 500 && status !== 503) console.error('BuildRight API request failed:', error);
    const message = status >= 500 && status !== 503
      ? 'The API encountered an unexpected error.'
      : error.type === 'entity.parse.failed'
        ? 'Request body must be valid JSON.'
        : error.message;
    return res.status(status).json({ ok: false, error: message, details: error.details });
  });

  return { app, env };
}
