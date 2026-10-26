import {
  MarketplaceProduct,
  RepairPricingRule,
  RepairProject,
  RepairService,
  ServiceProvider,
  ServiceRequest,
  SystemSetting,
  User,
} from '../models/index.js';
import { httpError, pagination, slugify } from '../lib/http.js';
import { containsRegex } from '../lib/search.js';
import { recordAudit } from '../services/database.js';
import { renderRepairReport } from '../services/pdf.js';
import { conceptPreview, previewStatus } from '../services/visualPreview.js';
import { assertOwner } from '../middleware/auth.js';
import { DEFAULT_COMMERCE, SERVICE_REQUEST_NOTICE, distanceForCity, moneyRound } from '../../shared/commerce.js';
import { DEFAULT_LABOR_RULES, LABOR_RATE_SOURCE, SERVICE_FIELDS } from '../../shared/repairCatalog.js';
import { estimateRepairProject, retotalRepair } from '../../shared/repairEngine.js';
import { ensureMarketplaceCatalog } from '../services/ensureCatalog.js';

async function commerceSettings() {
  const stored = await SystemSetting.findOne({ key: 'commerce' }).lean();
  return { ...DEFAULT_COMMERCE, ...(stored?.value || {}) };
}

async function pricingMap() {
  const rules = await RepairPricingRule.find({}).lean();
  const map = { ...DEFAULT_LABOR_RULES };
  for (const rule of rules) map[rule.serviceSlug] = rule;
  return map;
}

function cleanPhotos(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map((photo) => {
    const dataUrl = String(photo?.dataUrl || '');
    if (!/^data:image\/(jpeg|png);base64,/.test(dataUrl) || dataUrl.length > 450000) return null;
    const kind = ['existing', 'completion', 'concept'].includes(photo?.kind) ? photo.kind : 'existing';
    return { dataUrl, caption: String(photo?.caption || '').slice(0, 140), kind };
  }).filter(Boolean);
}

function presentRequest(request) {
  return { ...request, notice: SERVICE_REQUEST_NOTICE, booked: request.status === 'confirmed' || request.status === 'completed' };
}

export function createRepairRouter({ Router, requireUser, requireAdmin, optionalUser, requireDatabase, env }) {
  const router = Router();
  const requireProvider = (req, res, next) => requireUser(req, res, (error) => {
    if (error) return next(error);
    if (!['admin', 'provider'].includes(req.user.role)) return next(httpError(403, 'Service provider access is required.'));
    return next();
  });

  router.get('/services', optionalUser, requireDatabase, async (req, res, next) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const filter = req.user?.role === 'admin' && req.query.all === '1' ? {} : { active: true };
      const regex = containsRegex(req.query.q);
      if (regex) {
        filter.$or = [
          { title: regex },
          { summary: regex },
          { slug: regex },
          { calculator: regex },
          { tasks: regex },
          { keywords: regex },
        ];
      }
      const [stored, total] = await Promise.all([
        RepairService.find(filter).sort({ title: 1 }).skip(skip).limit(limit).lean(),
        RepairService.countDocuments(filter),
      ]);
      res.json({
        ok: true,
        services: stored.map((service) => ({ ...service, fields: SERVICE_FIELDS[service.calculator] || [] })),
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
        notice: 'Repair costs are planning estimates and depend on actual site conditions. Results come from the saved service catalog.',
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/services', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const title = String(req.body?.title || '').trim();
      const calculator = String(req.body?.calculator || '');
      if (title.length < 2) throw httpError(400, 'Enter a service name.');
      if (!SERVICE_FIELDS[calculator]) throw httpError(400, 'Choose one of the built-in repair calculators.');
      const service = await RepairService.create({
        title,
        slug: slugify(req.body?.slug || title),
        summary: String(req.body?.summary || '').trim().slice(0, 400),
        calculator,
        tasks: Array.isArray(req.body?.tasks) ? req.body.tasks.map((item) => String(item).slice(0, 80)).slice(0, 8) : [],
        imageUrl: String(req.body?.imageUrl || '').slice(0, 500),
        galleryImages: Array.isArray(req.body?.galleryImages) ? req.body.galleryImages.map(String).slice(0, 8) : [],
        active: true,
      });
      res.status(201).json({ ok: true, service });
    } catch (error) {
      next(error);
    }
  });

  router.put('/services/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const service = await RepairService.findById(req.params.id);
      if (!service) throw httpError(404, 'Repair service was not found.');
      if (req.body?.title) service.title = String(req.body.title).trim().slice(0, 80);
      if (req.body?.summary !== undefined) service.summary = String(req.body.summary).trim().slice(0, 400);
      if (Array.isArray(req.body?.keywords)) service.keywords = req.body.keywords.map((item) => String(item).trim().slice(0, 40)).filter(Boolean).slice(0, 8);
      if (Array.isArray(req.body?.tasks)) service.tasks = req.body.tasks.map((item) => String(item).trim().slice(0, 80)).filter(Boolean).slice(0, 8);
      if (req.body?.imageUrl !== undefined) service.imageUrl = String(req.body.imageUrl || '').slice(0, 500);
      if (Array.isArray(req.body?.galleryImages)) service.galleryImages = req.body.galleryImages.map(String).slice(0, 8);
      if (typeof req.body?.active === 'boolean') service.active = req.body.active;
      await service.save();
      res.json({ ok: true, service });
    } catch (error) {
      next(error);
    }
  });

  router.get('/pricing', requireDatabase, async (_req, res, next) => {
    try {
      const stored = await RepairPricingRule.find({}).lean();
      const bySlug = new Map(stored.map((rule) => [rule.serviceSlug, rule]));
      const rules = Object.entries(DEFAULT_LABOR_RULES).map(([serviceSlug, rule]) => bySlug.get(serviceSlug) || { serviceSlug, ...rule, source: LABOR_RATE_SOURCE, illustrative: true });
      res.json({ ok: true, rules, source: LABOR_RATE_SOURCE, illustrative: true });
    } catch (error) {
      next(error);
    }
  });

  router.put('/pricing/:slug', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const labor = cleanRateTable(req.body?.labor);
      const equipment = cleanRateTable(req.body?.equipment);
      const rule = await RepairPricingRule.findOneAndUpdate(
        { serviceSlug: req.params.slug },
        { laborUnit: String(req.body?.laborUnit || 'sq ft').slice(0, 20), labor, equipment, source: LABOR_RATE_SOURCE, illustrative: true },
        { new: true, upsert: true, runValidators: true },
      );
      res.json({ ok: true, rule });
    } catch (error) {
      next(error);
    }
  });

  router.post('/estimate', requireDatabase, async (req, res, next) => {
    try {
      await ensureMarketplaceCatalog();
      const [products, rules, settings, services] = await Promise.all([
        MarketplaceProduct.find({ active: true }).lean(),
        pricingMap(),
        commerceSettings(),
        RepairService.find({ active: true }).lean(),
      ]);
      const distanceKm = Number.isFinite(Number(req.body?.distanceKm)) ? Number(req.body.distanceKm) : distanceForCity(req.body?.location, settings);
      let estimate = estimateRepairProject({ tasks: Array.isArray(req.body?.tasks) ? req.body.tasks.slice(0, 12) : [], products, rules, settings, distanceKm, services });
      if (!estimate.ok) throw httpError(400, estimate.error);
      estimate = applySelections(estimate, req.body?.materials, products, settings, distanceKm);
      res.json({ ok: true, estimate, priceNotice: settings.priceNotice, laborNotice: 'Labor is estimated separately from the materials you can order.' });
    } catch (error) {
      next(error);
    }
  });

  router.get('/projects', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const filter = req.user.role === 'admin' ? {} : { ownerId: req.user.id };
      const projects = await RepairProject.find(filter).sort({ updatedAt: -1 }).limit(40).select('-photos.dataUrl').lean();
      res.json({ ok: true, projects });
    } catch (error) {
      next(error);
    }
  });

  router.post('/projects', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const project = await RepairProject.create({ ...await projectPayload(req), ownerId: req.user.id });
      await recordAudit(req, 'repair.project.create', 'RepairProject', project._id);
      res.status(201).json({ ok: true, project });
    } catch (error) {
      next(error);
    }
  });

  router.get('/projects/:id', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const project = await RepairProject.findById(req.params.id).lean();
      assertOwner(project, req.user);
      const requests = await ServiceRequest.find({ projectId: project._id }).sort({ createdAt: -1 }).lean();
      res.json({ ok: true, project, requests: requests.map(presentRequest), preview: previewStatus(env), notice: SERVICE_REQUEST_NOTICE });
    } catch (error) {
      next(error);
    }
  });

  router.put('/projects/:id', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const project = await RepairProject.findById(req.params.id);
      assertOwner(project, req.user);
      const payload = await projectPayload(req, project);
      if (req.body?.progress) payload.progress = ['Planning', 'Materials ordered', 'In progress', 'Completed'].includes(req.body.progress) ? req.body.progress : project.progress;
      if (req.body?.notes !== undefined) payload.notes = String(req.body.notes).slice(0, 4000);
      Object.assign(project, payload);
      await project.save();
      res.json({ ok: true, project });
    } catch (error) {
      next(error);
    }
  });

  router.get('/projects/:id/report', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const project = await RepairProject.findById(req.params.id);
      assertOwner(project, req.user);
      const pdf = await renderRepairReport(project.toObject());
      await recordAudit(req, 'repair.report', 'RepairProject', project._id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="buildright-repair-${project._id}.pdf"`);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  });

  router.post('/projects/:id/preview', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const project = await RepairProject.findById(req.params.id);
      assertOwner(project, req.user);
      const result = await conceptPreview({ ...project.visual, ...req.body, env });
      if (result.imageDataUrl && result.imageDataUrl.length < 450000 && project.photos.length < 4) {
        project.photos.push({ dataUrl: result.imageDataUrl, caption: 'AI visual concept', kind: 'concept' });
        await project.save();
      }
      res.json({ ok: true, preview: result });
    } catch (error) {
      next(error);
    }
  });

  router.get('/providers', requireDatabase, async (_req, res, next) => {
    try {
      const providers = await ServiceProvider.find({ active: true }).select('-sample').lean();
      res.json({ ok: true, providers, notice: SERVICE_REQUEST_NOTICE });
    } catch (error) {
      next(error);
    }
  });

  router.post('/providers', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const provider = await ServiceProvider.create(await cleanProvider(req.body || {}));
      res.status(201).json({ ok: true, provider });
    } catch (error) {
      next(error);
    }
  });

  router.put('/providers/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const provider = await ServiceProvider.findByIdAndUpdate(req.params.id, await cleanProvider(req.body || {}), { new: true, runValidators: true });
      if (!provider) throw httpError(404, 'Service provider was not found.');
      res.json({ ok: true, provider });
    } catch (error) {
      next(error);
    }
  });

  router.get('/requests', requireUser, requireDatabase, async (req, res, next) => {
    try {
      let requests;
      if (req.user.role === 'admin') requests = await ServiceRequest.find({}).sort({ createdAt: -1 }).limit(80).lean();
      else if (req.user.role === 'provider') {
        const provider = await ServiceProvider.findOne({ userId: req.user.id });
        requests = provider ? await ServiceRequest.find({ providerId: provider._id }).sort({ createdAt: -1 }).lean() : [];
      } else requests = await ServiceRequest.find({ ownerId: req.user.id }).sort({ createdAt: -1 }).lean();
      res.json({ ok: true, requests: requests.map(presentRequest), notice: SERVICE_REQUEST_NOTICE });
    } catch (error) {
      next(error);
    }
  });

  router.post('/requests', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const trade = String(req.body?.trade || '').trim();
      if (trade.length < 2) throw httpError(400, 'Choose the trade you need.');
      const request = await ServiceRequest.create({
        ownerId: req.user.id,
        projectId: req.body?.projectId || null,
        trade: trade.slice(0, 80),
        description: String(req.body?.description || '').trim().slice(0, 2000),
        location: String(req.body?.location || '').trim().slice(0, 80),
        preferredDate: String(req.body?.preferredDate || '').slice(0, 20),
        status: 'requested',
        history: [{ status: 'requested', note: SERVICE_REQUEST_NOTICE, at: new Date() }],
      });
      await recordAudit(req, 'repair.request.create', 'ServiceRequest', request._id);
      res.status(201).json({ ok: true, request: presentRequest(request.toObject()), notice: SERVICE_REQUEST_NOTICE });
    } catch (error) {
      next(error);
    }
  });

  router.post('/requests/:id/assign', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const request = await ServiceRequest.findById(req.params.id);
      if (!request) throw httpError(404, 'Service request was not found.');
      const provider = await ServiceProvider.findById(req.body?.providerId);
      if (!provider || !provider.active) throw httpError(400, 'Choose an active service provider.');
      request.providerId = provider._id;
      request.status = 'assigned';
      request.history.push({ status: 'assigned', note: `Assigned to ${provider.name}. Not booked yet.`, at: new Date() });
      await request.save();
      res.json({ ok: true, request: presentRequest(request.toObject()) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/requests/:id/accept', requireProvider, requireDatabase, async (req, res, next) => {
    try {
      const request = await loadProviderRequest(req);
      if (request.status !== 'assigned') throw httpError(400, 'This request is not waiting for your response.');
      request.status = 'accepted';
      request.history.push({ status: 'accepted', note: 'Provider accepted. The customer still needs to confirm. This is not a booking yet.', at: new Date() });
      await request.save();
      res.json({ ok: true, request: presentRequest(request.toObject()) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/requests/:id/decline', requireProvider, requireDatabase, async (req, res, next) => {
    try {
      const request = await loadProviderRequest(req);
      if (!['assigned', 'accepted'].includes(request.status)) throw httpError(400, 'This request can no longer be declined.');
      request.status = 'declined';
      request.history.push({ status: 'declined', note: String(req.body?.note || 'Provider declined.').slice(0, 240), at: new Date() });
      await request.save();
      res.json({ ok: true, request: presentRequest(request.toObject()) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/requests/:id/confirm', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const request = await ServiceRequest.findById(req.params.id);
      assertOwner(request, req.user);
      if (request.status !== 'accepted') throw httpError(400, 'A provider must accept the request before it can be confirmed.');
      request.status = 'confirmed';
      request.history.push({ status: 'confirmed', note: 'Customer confirmed the service request.', at: new Date() });
      await request.save();
      res.json({ ok: true, request: presentRequest(request.toObject()) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/requests/:id/cancel', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const request = await ServiceRequest.findById(req.params.id);
      assertOwner(request, req.user);
      if (['completed', 'cancelled'].includes(request.status)) throw httpError(400, 'This request is already closed.');
      request.status = 'cancelled';
      request.history.push({ status: 'cancelled', note: 'Cancelled before completion.', at: new Date() });
      await request.save();
      res.json({ ok: true, request: presentRequest(request.toObject()) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function cleanRateTable(value) {
  const source = value || {};
  const table = {};
  for (const key of ['economy', 'standard', 'premium', 'luxury']) {
    const number = Number(source[key]);
    if (!Number.isFinite(number) || number < 0) throw httpError(400, 'Enter labor and equipment rates for every quality level.');
    table[key] = number;
  }
  return table;
}

function applySelections(estimate, materials, products, settings, distanceKm) {
  if (!Array.isArray(materials) || !materials.length) return estimate;
  const next = {
    ...estimate,
    materials: estimate.materials.map((line) => {
      const key = `${line.role}|${line.name}|${line.unit}`;
      const change = materials.find((item) => item.key === key || item.role === line.role);
      if (!change) return line;
      const quantity = Math.max(0, Number(change.quantity));
      const product = products.find((item) => String(item._id) === String(change.productId));
      const selected = product && product.unit === line.unit ? product : null;
      const unitPrice = selected ? selected.pricePkr : line.unitPrice;
      return {
        ...line,
        quantity: Number.isFinite(quantity) ? quantity : line.quantity,
        productId: selected ? String(selected._id) : line.productId,
        productName: selected?.name || line.productName,
        brand: selected?.brand || line.brand,
        unitPrice,
        unmatched: selected ? false : line.unmatched,
        lineTotal: moneyRound((Number.isFinite(quantity) ? quantity : line.quantity) * unitPrice),
      };
    }),
  };
  return retotalRepair(next, settings, distanceKm);
}

async function projectPayload(req, existing) {
  const title = String(req.body?.title || existing?.title || '').trim();
  if (title.length < 2) throw httpError(400, 'Name the repair project.');
  const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks.slice(0, 12) : existing?.tasks || [];
  let estimate = existing?.estimate || null;
  if (req.body?.tasks || req.body?.materials) {
    await ensureMarketplaceCatalog();
    const [products, rules, settings, services] = await Promise.all([
      MarketplaceProduct.find({ active: true }).lean(),
      pricingMap(),
      commerceSettings(),
      RepairService.find({ active: true }).lean(),
    ]);
    const distanceKm = distanceForCity(req.body?.location || existing?.location, settings);
    const calculated = estimateRepairProject({ tasks, products, rules, settings, distanceKm, services });
    if (!calculated.ok) throw httpError(400, calculated.error);
    estimate = applySelections(calculated, req.body?.materials, products, settings, distanceKm);
  }
  return {
    title: title.slice(0, 140),
    buildingType: String(req.body?.buildingType || existing?.buildingType || 'House').slice(0, 40),
    location: String(req.body?.location || existing?.location || 'Islamabad').slice(0, 80),
    budget: Math.max(0, Number(req.body?.budget ?? existing?.budget) || 0),
    startDate: String(req.body?.startDate || existing?.startDate || '').slice(0, 20),
    tasks,
    estimate,
    photos: req.body?.photos ? cleanPhotos(req.body.photos) : existing?.photos || [],
    notes: req.body?.notes !== undefined ? String(req.body.notes).slice(0, 4000) : existing?.notes || '',
    visual: {
      color: /^#[0-9a-fA-F]{6}$/.test(req.body?.visual?.color || '') ? req.body.visual.color : existing?.visual?.color || '#F4E4C8',
      finish: String(req.body?.visual?.finish || existing?.visual?.finish || 'Matte').slice(0, 40),
      style: String(req.body?.visual?.style || existing?.visual?.style || 'Modern').slice(0, 40),
    },
  };
}

async function cleanProvider(body) {
  const name = String(body.name || '').trim();
  if (name.length < 2) throw httpError(400, 'Enter the provider name.');
  let userId = body.userId || null;
  if (body.email) {
    const user = await User.findOne({ email: String(body.email).trim().toLowerCase() });
    if (user) userId = user._id;
  }
  return {
    name: name.slice(0, 120),
    trades: Array.isArray(body.trades) ? body.trades.map((item) => String(item).slice(0, 40)).slice(0, 6) : [],
    phone: String(body.phone || '').slice(0, 40),
    email: String(body.email || '').trim().toLowerCase().slice(0, 160),
    cities: Array.isArray(body.cities) ? body.cities.map((item) => String(item).slice(0, 40)).slice(0, 8) : [],
    active: body.active !== false,
    userId,
    sample: Boolean(body.sample),
  };
}

async function loadProviderRequest(req) {
  const request = await ServiceRequest.findById(req.params.id);
  if (!request) throw httpError(404, 'Service request was not found.');
  if (req.user.role === 'admin') return request;
  const provider = await ServiceProvider.findOne({ userId: req.user.id });
  if (!provider || String(request.providerId) !== String(provider._id)) throw httpError(403, 'This request is not assigned to you.');
  return request;
}
