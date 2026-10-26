import {
  BuildingTemplate,
  LaborRate,
  MarginRule,
  PriceHistory,
  QuantityRule,
  RegionalRate,
  UploadedImage,
} from '../models/index.js';
import { httpError, pagination } from '../lib/http.js';
import { recordAudit } from '../services/database.js';
import { recordPriceChange } from '../services/priceHistory.js';
import { deleteStoredImage, storeUploadedImage, uploadImageMiddleware, uploadProviderLabel } from '../services/upload.js';

export function createConfigRouter({ Router, requireAdmin, requireDatabase }) {
  const router = Router();

  // —— Regional rates ——
  router.get('/regional-rates', requireDatabase, async (_req, res, next) => {
    try {
      const rates = await RegionalRate.find({}).sort({ city: 1 }).lean();
      res.json({ ok: true, rates });
    } catch (error) {
      next(error);
    }
  });

  router.post('/regional-rates', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const rate = await RegionalRate.create(cleanRegional(req.body || {}));
      await recordAudit(req, 'regional.create', 'RegionalRate', rate._id);
      res.status(201).json({ ok: true, rate });
    } catch (error) {
      next(error);
    }
  });

  router.put('/regional-rates/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const previous = await RegionalRate.findById(req.params.id);
      if (!previous) throw httpError(404, 'Regional rate was not found.');
      const rate = await RegionalRate.findByIdAndUpdate(req.params.id, cleanRegional(req.body || {}), { new: true, runValidators: true });
      if (previous.multiplier !== rate.multiplier) {
        await recordPriceChange({
          entityType: 'RegionalRate',
          entityId: rate._id,
          field: 'multiplier',
          previousValue: previous.multiplier,
          newValue: rate.multiplier,
          user: req.user,
        });
      }
      await recordAudit(req, 'regional.update', 'RegionalRate', rate._id);
      res.json({ ok: true, rate });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/regional-rates/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const rate = await RegionalRate.findByIdAndDelete(req.params.id);
      if (!rate) throw httpError(404, 'Regional rate was not found.');
      await recordAudit(req, 'regional.delete', 'RegionalRate', rate._id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  // —— Labor rates CRUD ——
  router.get('/labor-rates', requireDatabase, async (req, res, next) => {
    try {
      const filter = {};
      if (req.query.location) filter.location = String(req.query.location);
      if (req.query.skill) filter.skill = String(req.query.skill);
      if (req.query.kind) filter.kind = String(req.query.kind);
      const rates = await LaborRate.find(filter).sort({ location: 1, skill: 1 }).lean();
      res.json({ ok: true, rates });
    } catch (error) {
      next(error);
    }
  });

  router.post('/labor-rates', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const rate = await LaborRate.create(cleanLabor(req.body || {}));
      await recordAudit(req, 'labor.create', 'LaborRate', rate._id);
      res.status(201).json({ ok: true, rate });
    } catch (error) {
      next(error);
    }
  });

  router.put('/labor-rates/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const previous = await LaborRate.findById(req.params.id);
      if (!previous) throw httpError(404, 'Labor rate was not found.');
      const payload = cleanLabor(req.body || {});
      const rate = await LaborRate.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
      if (previous.ratePerSqFt !== rate.ratePerSqFt) {
        await recordPriceChange({
          entityType: 'LaborRate',
          entityId: rate._id,
          field: 'ratePerSqFt',
          previousValue: previous.ratePerSqFt,
          newValue: rate.ratePerSqFt,
          user: req.user,
        });
      }
      await recordAudit(req, 'labor.update', 'LaborRate', rate._id);
      res.json({ ok: true, rate });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/labor-rates/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const rate = await LaborRate.findByIdAndDelete(req.params.id);
      if (!rate) throw httpError(404, 'Labor rate was not found.');
      await recordAudit(req, 'labor.delete', 'LaborRate', rate._id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  // —— Margin rules ——
  router.get('/margin-rules', requireDatabase, async (_req, res, next) => {
    try {
      const rules = await MarginRule.find({}).sort({ priority: 1, name: 1 }).lean();
      res.json({ ok: true, rules });
    } catch (error) {
      next(error);
    }
  });

  router.post('/margin-rules', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const rule = await MarginRule.create(cleanMargin(req.body || {}));
      await recordAudit(req, 'margin.create', 'MarginRule', rule._id);
      res.status(201).json({ ok: true, rule });
    } catch (error) {
      next(error);
    }
  });

  router.put('/margin-rules/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const rule = await MarginRule.findByIdAndUpdate(req.params.id, cleanMargin(req.body || {}), { new: true, runValidators: true });
      if (!rule) throw httpError(404, 'Margin rule was not found.');
      await recordAudit(req, 'margin.update', 'MarginRule', rule._id);
      res.json({ ok: true, rule });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/margin-rules/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const rule = await MarginRule.findByIdAndDelete(req.params.id);
      if (!rule) throw httpError(404, 'Margin rule was not found.');
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  // —— Quantity rules ——
  router.get('/quantity-rules', requireDatabase, async (req, res, next) => {
    try {
      const filter = {};
      if (req.query.buildingType) filter.buildingType = String(req.query.buildingType);
      const rules = await QuantityRule.find(filter).sort({ scope: 1, code: 1 }).lean();
      res.json({ ok: true, rules });
    } catch (error) {
      next(error);
    }
  });

  router.post('/quantity-rules', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const rule = await QuantityRule.create(cleanQuantity(req.body || {}));
      await recordAudit(req, 'quantity.create', 'QuantityRule', rule._id);
      res.status(201).json({ ok: true, rule });
    } catch (error) {
      next(error);
    }
  });

  router.put('/quantity-rules/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const rule = await QuantityRule.findByIdAndUpdate(req.params.id, cleanQuantity(req.body || {}), { new: true, runValidators: true });
      if (!rule) throw httpError(404, 'Quantity rule was not found.');
      res.json({ ok: true, rule });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/quantity-rules/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const rule = await QuantityRule.findByIdAndDelete(req.params.id);
      if (!rule) throw httpError(404, 'Quantity rule was not found.');
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  // —— Building templates ——
  router.get('/building-templates', requireDatabase, async (_req, res, next) => {
    try {
      const templates = await BuildingTemplate.find({}).sort({ name: 1 }).lean();
      res.json({ ok: true, templates });
    } catch (error) {
      next(error);
    }
  });

  router.post('/building-templates', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const template = await BuildingTemplate.create(cleanTemplate(req.body || {}));
      res.status(201).json({ ok: true, template });
    } catch (error) {
      next(error);
    }
  });

  router.put('/building-templates/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const template = await BuildingTemplate.findByIdAndUpdate(req.params.id, cleanTemplate(req.body || {}), { new: true, runValidators: true });
      if (!template) throw httpError(404, 'Building template was not found.');
      res.json({ ok: true, template });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/building-templates/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const template = await BuildingTemplate.findByIdAndDelete(req.params.id);
      if (!template) throw httpError(404, 'Building template was not found.');
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  // —— Price history ——
  router.get('/price-history', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const filter = {};
      if (req.query.entityType) filter.entityType = String(req.query.entityType);
      if (req.query.entityId) filter.entityId = String(req.query.entityId);
      const [entries, total] = await Promise.all([
        PriceHistory.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        PriceHistory.countDocuments(filter),
      ]);
      res.json({ ok: true, entries, page, total });
    } catch (error) {
      next(error);
    }
  });

  // —— Image uploads ——
  router.get('/uploads', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const filter = {};
      if (req.query.entityType) filter.entityType = String(req.query.entityType);
      const [images, total] = await Promise.all([
        UploadedImage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        UploadedImage.countDocuments(filter),
      ]);
      res.json({ ok: true, images, page, total, provider: uploadProviderLabel() });
    } catch (error) {
      next(error);
    }
  });

  router.post('/uploads', requireAdmin, requireDatabase, (req, res, next) => {
    uploadImageMiddleware(req, res, async (err) => {
      if (err) return next(err.code === 'LIMIT_FILE_SIZE' ? httpError(400, 'Image must be 5 MB or smaller.') : err);
      try {
        const image = await storeUploadedImage(req.file, {
          userId: req.user?.id,
          entityType: String(req.body?.entityType || ''),
          entityId: String(req.body?.entityId || ''),
        });
        await recordAudit(req, 'upload.create', 'UploadedImage', image._id);
        res.status(201).json({ ok: true, image, provider: uploadProviderLabel() });
      } catch (error) {
        next(error);
      }
    });
  });

  router.delete('/uploads/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      await deleteStoredImage(req.params.id);
      await recordAudit(req, 'upload.delete', 'UploadedImage', req.params.id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function cleanRegional(body) {
  const city = String(body.city || '').trim();
  const multiplier = Number(body.multiplier);
  if (!city) throw httpError(400, 'City is required.');
  if (!Number.isFinite(multiplier) || multiplier < 0.5 || multiplier > 3) throw httpError(400, 'Multiplier must be between 0.5 and 3.');
  return {
    city,
    region: String(body.region || '').slice(0, 80),
    multiplier,
    transportAdjustment: Math.min(1, Math.max(0, Number(body.transportAdjustment) || 0)),
    notes: String(body.notes || '').slice(0, 500),
    active: body.active !== false,
  };
}

function cleanLabor(body) {
  const ratePerSqFt = Number(body.ratePerSqFt ?? body.rate);
  if (!Number.isFinite(ratePerSqFt) || ratePerSqFt < 0) throw httpError(400, 'Labor rate must be a non-negative number.');
  const skill = ['mason', 'laborer', 'steel_fixer', 'carpenter', 'electrician', 'plumber', 'painter', 'tile_worker', 'general', 'equipment'].includes(body.skill)
    ? body.skill
    : 'general';
  const unit = ['daily', 'hourly', 'per_sq_ft'].includes(body.unit) ? body.unit : 'per_sq_ft';
  return {
    kind: body.kind === 'equipment' ? 'equipment' : 'labor',
    skill: body.kind === 'equipment' ? 'equipment' : skill,
    unit,
    scope: ['grey', 'finishing', 'any'].includes(body.scope) ? body.scope : 'any',
    quality: String(body.quality || 'standard').slice(0, 40),
    location: String(body.location || 'Islamabad').slice(0, 80),
    rate: Number.isFinite(Number(body.rate)) ? Number(body.rate) : ratePerSqFt,
    ratePerSqFt,
    source: String(body.source || 'Administrator entry').slice(0, 240),
    illustrative: body.illustrative !== false,
    effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
    lastUpdated: new Date(),
  };
}

function cleanMargin(body) {
  const marginPercent = Number(body.marginPercent);
  if (!body.name) throw httpError(400, 'Margin rule name is required.');
  if (!Number.isFinite(marginPercent) || marginPercent < 0 || marginPercent > 40) throw httpError(400, 'Margin percent must be 0–40.');
  return {
    name: String(body.name).slice(0, 120),
    projectType: String(body.projectType || '*').slice(0, 80),
    quality: String(body.quality || '*').slice(0, 40),
    minCoveredArea: Number(body.minCoveredArea) || 0,
    maxCoveredArea: body.maxCoveredArea === '' || body.maxCoveredArea == null ? null : Number(body.maxCoveredArea),
    minFloors: Number(body.minFloors) || 1,
    maxFloors: body.maxFloors === '' || body.maxFloors == null ? null : Number(body.maxFloors),
    projectSize: ['small', 'medium', 'large', 'any'].includes(body.projectSize) ? body.projectSize : 'any',
    marginPercent,
    priority: Number(body.priority) || 100,
    active: body.active !== false,
    notes: String(body.notes || '').slice(0, 400),
  };
}

function cleanQuantity(body) {
  const perSqFt = Number(body.perSqFt);
  if (!body.code || !body.name || !body.category || !body.unit) throw httpError(400, 'Code, name, category, and unit are required.');
  if (!Number.isFinite(perSqFt) || perSqFt < 0) throw httpError(400, 'perSqFt must be zero or greater.');
  return {
    code: String(body.code).slice(0, 60),
    name: String(body.name).slice(0, 120),
    category: String(body.category).slice(0, 60),
    unit: String(body.unit).slice(0, 30),
    scope: body.scope === 'finishing' ? 'finishing' : 'grey',
    buildingType: String(body.buildingType || '*').slice(0, 80),
    constructionType: String(body.constructionType || '*').slice(0, 80),
    quality: String(body.quality || '*').slice(0, 40),
    perSqFt,
    floorFactor: Number(body.floorFactor) || 0,
    notes: String(body.notes || '').slice(0, 400),
    active: body.active !== false,
  };
}

function cleanTemplate(body) {
  if (!body.key || !body.name || !body.buildingType) throw httpError(400, 'Template key, name, and building type are required.');
  return {
    key: String(body.key).slice(0, 60),
    name: String(body.name).slice(0, 120),
    buildingType: String(body.buildingType).slice(0, 80),
    constructionType: String(body.constructionType || 'Framed RCC').slice(0, 80),
    description: String(body.description || '').slice(0, 1000),
    quantityMultipliers: body.quantityMultipliers && typeof body.quantityMultipliers === 'object' ? body.quantityMultipliers : {},
    laborIntensity: Number(body.laborIntensity) || 1,
    timelineFactor: Number(body.timelineFactor) || 1,
    phases: Array.isArray(body.phases) ? body.phases : [],
    active: body.active !== false,
  };
}
