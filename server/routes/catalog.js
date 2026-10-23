import { Article, ContactMessage, Contractor, LaborRate, MaterialRate } from '../models/index.js';
import { httpError, isEmail, pagination, slugify } from '../lib/http.js';
import { containsRegex } from '../lib/search.js';
import { recordAudit } from '../services/database.js';

export function createCatalogRouter({ Router, requireAdmin, requireDatabase }) {
  const router = Router();

  router.get('/materials', requireDatabase, async (req, res, next) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const filter = {};
      if (req.query.category && req.query.category !== 'All') filter.category = String(req.query.category);
      if (req.query.location) filter.location = String(req.query.location);
      const materialQuery = containsRegex(req.query.q);
      if (materialQuery) filter.name = materialQuery;
      const sort = req.query.sort === 'price-asc' ? { rate: 1 } : req.query.sort === 'price-desc' ? { rate: -1 } : { name: 1 };
      const [materials, total] = await Promise.all([
        MaterialRate.find(filter).sort(sort).skip(skip).limit(limit).lean(),
        MaterialRate.countDocuments(filter),
      ]);
      res.json({ ok: true, materials, page, total });
    } catch (error) {
      next(error);
    }
  });

  router.post('/materials', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const material = await MaterialRate.create(cleanMaterial(req.body || {}));
      await recordAudit(req, 'material.create', 'MaterialRate', material._id);
      res.status(201).json({ ok: true, material });
    } catch (error) {
      next(error);
    }
  });

  router.put('/materials/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const material = await MaterialRate.findByIdAndUpdate(req.params.id, cleanMaterial(req.body || {}), { new: true, runValidators: true });
      if (!material) throw httpError(404, 'Material rate was not found.');
      await recordAudit(req, 'material.update', 'MaterialRate', material._id, { rate: material.rate });
      res.json({ ok: true, material });
    } catch (error) {
      next(error);
    }
  });

  router.get('/labor-rates', requireDatabase, async (_req, res, next) => {
    try {
      const rates = await LaborRate.find({}).lean();
      res.json({ ok: true, rates });
    } catch (error) {
      next(error);
    }
  });

  router.get('/contractors', requireDatabase, async (req, res, next) => {
    try {
      const filter = {};
      if (req.query.q) filter.name = { $regex: String(req.query.q).slice(0, 80), $options: 'i' };
      if (req.query.role) filter.role = String(req.query.role);
      const contractors = await Contractor.find(filter).sort({ name: 1 }).limit(60).lean();
      res.json({ ok: true, contractors });
    } catch (error) {
      next(error);
    }
  });

  router.post('/contractors', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const contractor = await Contractor.create(cleanContractor(req.body || {}));
      res.status(201).json({ ok: true, contractor });
    } catch (error) {
      next(error);
    }
  });

  router.put('/contractors/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const contractor = await Contractor.findByIdAndUpdate(req.params.id, cleanContractor(req.body || {}), { new: true, runValidators: true });
      if (!contractor) throw httpError(404, 'Professional profile was not found.');
      res.json({ ok: true, contractor });
    } catch (error) {
      next(error);
    }
  });

  router.get('/articles', requireDatabase, async (req, res, next) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const filter = { published: true };
      if (req.query.category && req.query.category !== 'All') filter.category = String(req.query.category);
      if (req.query.q) filter.title = { $regex: String(req.query.q).slice(0, 80), $options: 'i' };
      const [articles, total] = await Promise.all([
        Article.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-body').lean(),
        Article.countDocuments(filter),
      ]);
      res.json({ ok: true, articles, page, total });
    } catch (error) {
      next(error);
    }
  });

  router.get('/articles/:slug', requireDatabase, async (req, res, next) => {
    try {
      const article = await Article.findOne({ slug: req.params.slug, published: true }).lean();
      if (!article) throw httpError(404, 'Article was not found.');
      const related = await Article.find({ published: true, category: article.category, _id: { $ne: article._id } }).select('-body').limit(3).lean();
      res.json({ ok: true, article, related });
    } catch (error) {
      next(error);
    }
  });

  router.post('/articles', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const article = await Article.create(await cleanArticle(req.body || {}));
      res.status(201).json({ ok: true, article });
    } catch (error) {
      next(error);
    }
  });

  router.put('/articles/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const article = await Article.findByIdAndUpdate(req.params.id, await cleanArticle(req.body || {}, req.params.id), { new: true, runValidators: true });
      if (!article) throw httpError(404, 'Article was not found.');
      res.json({ ok: true, article });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/articles/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const article = await Article.findByIdAndDelete(req.params.id);
      if (!article) throw httpError(404, 'Article was not found.');
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post('/contact', requireDatabase, async (req, res, next) => {
    try {
      const name = String(req.body?.name || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const subject = String(req.body?.subject || '').trim();
      const message = String(req.body?.message || '').trim();
      const details = [];
      if (name.length < 2 || name.length > 80) details.push('Name must be 2 to 80 characters.');
      if (!isEmail(email)) details.push('Enter a valid email address.');
      if (subject.length < 3 || subject.length > 140) details.push('Subject must be 3 to 140 characters.');
      if (message.length < 10 || message.length > 4000) details.push('Message must be 10 to 4000 characters.');
      if (details.length) throw httpError(400, details[0], details);
      const saved = await ContactMessage.create({ name, email, subject, message });
      res.status(201).json({ ok: true, id: saved._id, message: 'Message received. BuildRight will review it from the admin inbox.' });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function cleanMaterial(body) {
  const rate = Number(body.rate);
  const perSqFt = Number(body.perSqFt);
  if (!body.name || !body.code || !body.category || !body.unit) throw httpError(400, 'Material name, code, category, and unit are required.');
  if (!Number.isFinite(rate) || rate < 0) throw httpError(400, 'Rate must be a positive number.');
  if (!Number.isFinite(perSqFt) || perSqFt < 0) throw httpError(400, 'Quantity per square foot must be zero or greater.');
  return {
    code: String(body.code).slice(0, 60),
    name: String(body.name).slice(0, 120),
    category: String(body.category).slice(0, 60),
    unit: String(body.unit).slice(0, 30),
    scope: body.scope === 'finishing' ? 'finishing' : 'grey',
    perSqFt,
    rate,
    quality: String(body.quality || 'standard'),
    location: String(body.location || 'Islamabad'),
    supplier: String(body.supplier || '').slice(0, 160),
    source: String(body.source || 'Administrator entry').slice(0, 240),
    illustrative: body.illustrative !== false,
    effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
  };
}

function cleanContractor(body) {
  if (!body.name || !body.role) throw httpError(400, 'Name and role are required.');
  const verificationStatus = body.verificationStatus === 'verified' ? 'verified' : 'unverified';
  return {
    name: String(body.name).slice(0, 120),
    role: String(body.role).slice(0, 80),
    specialties: Array.isArray(body.specialties) ? body.specialties.map(String).slice(0, 8) : String(body.specialties || '').split(',').map((item) => item.trim()).filter(Boolean),
    locations: Array.isArray(body.locations) ? body.locations.map(String).slice(0, 8) : String(body.locations || '').split(',').map((item) => item.trim()).filter(Boolean),
    summary: String(body.summary || '').slice(0, 1000),
    email: String(body.email || '').slice(0, 160),
    phone: String(body.phone || '').slice(0, 40),
    imageUrl: String(body.imageUrl || '').slice(0, 500),
    verificationStatus,
    sample: body.sample !== false,
  };
}

async function cleanArticle(body, ignoreId) {
  if (!body.title || !body.excerpt || !body.body || !body.category) throw httpError(400, 'Title, category, excerpt, and body are required.');
  let slug = slugify(body.slug || body.title);
  const clash = await Article.findOne({ slug, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) });
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;
  return {
    title: String(body.title).slice(0, 180),
    slug,
    category: String(body.category).slice(0, 80),
    excerpt: String(body.excerpt).slice(0, 400),
    body: String(body.body).slice(0, 20000),
    imageUrl: String(body.imageUrl || '').slice(0, 500),
    published: body.published !== false,
  };
}
