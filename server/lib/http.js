export function loadEnv() {
  const env = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.API_PORT || 3001),
    mongoUri: process.env.MONGODB_URI || '',
    jwtSecret: process.env.JWT_SECRET || '',
    webOrigin: process.env.WEB_ORIGIN || 'http://localhost:5173',
    aiProvider: (process.env.AI_PROVIDER || 'procedural').toLowerCase(),
    aiApiKey: process.env.AI_API_KEY || '',
    aiModel: process.env.AI_MODEL || '',
    aiBaseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
    aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 20000),
    imageApiKey: process.env.IMAGE_API_KEY || '',
    imageModel: process.env.IMAGE_MODEL || 'dall-e-2',
    imageBaseUrl: process.env.IMAGE_BASE_URL || 'https://api.openai.com/v1',
  };
  if (!Number.isFinite(env.port) || env.port <= 0) throw new Error('API_PORT must be a positive number.');
  if (env.nodeEnv === 'production') {
    if (!env.mongoUri) throw new Error('MONGODB_URI is required in production.');
    if (!env.jwtSecret || env.jwtSecret.length < 24) throw new Error('JWT_SECRET must be at least 24 characters in production.');
  }
  return env;
}

export function httpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
}

export function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 160;
}

export function pagination(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(48, Math.max(1, Number(query.limit) || 12));
  return { page, limit, skip: (page - 1) * limit };
}

export function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
