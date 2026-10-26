import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { httpError } from '../lib/http.js';
import { UploadedImage } from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function cloudinaryConfigured() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

if (cloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const memory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(httpError(400, 'Only JPEG, PNG, WebP, or GIF images up to 5 MB are allowed.'));
    }
    return cb(null, true);
  },
});

export const uploadImageMiddleware = memory.single('image');

async function ensureLocalDir() {
  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
}

async function saveLocal(file) {
  await ensureLocalDir();
  const safe = String(file.originalname || 'image').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const full = path.join(LOCAL_UPLOAD_DIR, filename);
  await fs.writeFile(full, file.buffer);
  return {
    url: `/uploads/${filename}`,
    publicId: filename,
    provider: 'local',
    bytes: file.size,
    mimeType: file.mimetype,
    originalName: file.originalname || filename,
  };
}

async function saveCloudinary(file) {
  const encoded = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  const result = await cloudinary.uploader.upload(encoded, {
    folder: process.env.CLOUDINARY_FOLDER || 'buildright',
    resource_type: 'image',
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
    provider: 'cloudinary',
    bytes: result.bytes || file.size,
    mimeType: file.mimetype,
    originalName: file.originalname || result.public_id,
    width: result.width,
    height: result.height,
  };
}

export async function storeUploadedImage(file, { userId = null, entityType = '', entityId = '' } = {}) {
  if (!file) throw httpError(400, 'Choose an image file to upload.');
  if (!ALLOWED.has(file.mimetype)) throw httpError(400, 'Only JPEG, PNG, WebP, or GIF images are allowed.');
  if (file.size > MAX_BYTES) throw httpError(400, 'Image must be 5 MB or smaller.');

  let stored;
  try {
    if (cloudinaryConfigured()) {
      stored = await saveCloudinary(file);
    } else if (process.env.VERCEL) {
      throw httpError(503, 'Cloudinary is required on Vercel. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
    } else {
      stored = await saveLocal(file);
    }
  } catch (error) {
    if (error.status) throw error;
    throw httpError(502, `Image upload failed: ${error.message || 'storage provider error'}`);
  }

  const record = await UploadedImage.create({
    url: stored.url,
    publicId: stored.publicId,
    originalName: stored.originalName,
    mimeType: stored.mimeType,
    bytes: stored.bytes,
    width: stored.width ?? null,
    height: stored.height ?? null,
    provider: stored.provider,
    entityType,
    entityId: entityId ? String(entityId) : '',
    uploadedBy: userId || null,
  });

  return record;
}

export async function deleteStoredImage(imageOrId) {
  const record = typeof imageOrId === 'string' || imageOrId?._id
    ? await UploadedImage.findById(imageOrId._id || imageOrId)
    : imageOrId;
  if (!record) throw httpError(404, 'Image was not found.');

  if (record.provider === 'cloudinary' && record.publicId && cloudinaryConfigured()) {
    try {
      await cloudinary.uploader.destroy(record.publicId);
    } catch {
      /* keep DB record cleanup even if remote delete fails */
    }
  }
  if (record.provider === 'local' && record.publicId) {
    try {
      await fs.unlink(path.join(LOCAL_UPLOAD_DIR, record.publicId));
    } catch {
      /* file may already be gone */
    }
  }
  await UploadedImage.deleteOne({ _id: record._id });
  return { ok: true, url: record.url };
}

export function uploadProviderLabel() {
  return cloudinaryConfigured() ? 'cloudinary' : 'local';
}
