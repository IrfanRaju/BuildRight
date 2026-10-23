import { Project } from '../models/index.js';
import { assertOwner } from '../middleware/auth.js';
import { httpError, pagination } from '../lib/http.js';
import { recordAudit } from '../services/database.js';

const CATEGORIES = ['residential', 'commercial', 'corporate', 'institutional', 'infrastructure'];

function cleanProject(body, partial = false) {
  const project = {};
  if (!partial || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (title.length < 2 || title.length > 140) throw httpError(400, 'Project title must be 2 to 140 characters.');
    project.title = title;
  }
  if (!partial || body.projectType !== undefined) project.projectType = String(body.projectType || 'House').slice(0, 80);
  if (!partial || body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) throw httpError(400, 'Choose a valid project category.');
    project.category = body.category;
  }
  if (body.location !== undefined) project.location = String(body.location).slice(0, 80);
  if (body.area !== undefined) project.area = Number(body.area) || 0;
  if (body.areaUnit !== undefined) project.areaUnit = String(body.areaUnit).slice(0, 20);
  if (body.floors !== undefined) project.floors = Number(body.floors) || 0;
  if (body.description !== undefined) project.description = String(body.description).slice(0, 2000);
  if (body.imageUrl !== undefined) project.imageUrl = String(body.imageUrl).slice(0, 500);
  if (body.visibility !== undefined) {
    if (!['private', 'public'].includes(body.visibility)) throw httpError(400, 'Visibility must be private or public.');
    project.visibility = body.visibility;
  }
  return project;
}

export function createProjectRouter({ Router, requireUser, optionalUser, requireDatabase }) {
  const router = Router();

  router.get('/', optionalUser, requireDatabase, async (req, res, next) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const filter = { status: req.query.status === 'archived' ? 'archived' : 'active' };
      if (req.query.category && CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
      if (req.query.scope === 'mine') {
        if (!req.user) throw httpError(401, 'Sign in to view your projects.');
        filter.ownerId = req.user.id;
        if (req.query.status === 'all') delete filter.status;
      } else {
        filter.visibility = 'public';
      }
      if (req.query.q) filter.title = { $regex: String(req.query.q).slice(0, 80), $options: 'i' };
      const [projects, total] = await Promise.all([
        Project.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Project.countDocuments(filter),
      ]);
      res.json({ ok: true, projects, page, total });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const project = await Project.create({ ...cleanProject(req.body || {}), ownerId: req.user.id, isSample: false });
      await recordAudit(req, 'project.create', 'Project', project._id);
      res.status(201).json({ ok: true, project });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', optionalUser, requireDatabase, async (req, res, next) => {
    try {
      const project = await Project.findById(req.params.id).lean();
      if (!project) throw httpError(404, 'Project was not found.');
      const owns = req.user && (req.user.role === 'admin' || String(project.ownerId) === req.user.id);
      if (project.visibility !== 'public' && !owns) throw httpError(403, 'You do not have access to this project.');
      res.json({ ok: true, project });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const existing = await Project.findById(req.params.id);
      assertOwner(existing, req.user);
      if (existing.isSample && req.user.role !== 'admin') throw httpError(403, 'Sample projects can only be changed by an administrator.');
      Object.assign(existing, cleanProject(req.body || {}, true));
      await existing.save();
      res.json({ ok: true, project: existing });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/duplicate', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const existing = await Project.findById(req.params.id).lean();
      if (!existing) throw httpError(404, 'Project was not found.');
      const owns = req.user.role === 'admin' || String(existing.ownerId) === req.user.id;
      if (existing.visibility !== 'public' && !owns) throw httpError(403, 'You do not have access to this project.');
      const { _id, createdAt, updatedAt, __v, ...rest } = existing;
      const copy = await Project.create({
        ...rest,
        ownerId: req.user.id,
        title: `${existing.title} copy`.slice(0, 140),
        visibility: 'private',
        isSample: false,
        status: 'active',
      });
      res.status(201).json({ ok: true, project: copy });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/archive', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const existing = await Project.findById(req.params.id);
      assertOwner(existing, req.user);
      existing.status = existing.status === 'archived' ? 'active' : 'archived';
      await existing.save();
      res.json({ ok: true, project: existing });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const existing = await Project.findById(req.params.id);
      assertOwner(existing, req.user);
      await existing.deleteOne();
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
