import mongoose from 'mongoose';
import { calculateEstimate } from '../../shared/estimateEngine.js';
import { CostEstimate, Project } from '../models/index.js';
import { assertOwner } from '../middleware/auth.js';
import { httpError } from '../lib/http.js';
import { loadRateBook } from '../services/rateBookService.js';
import { renderEstimatePdf } from '../services/pdf.js';
import { recordAudit } from '../services/database.js';

export function createEstimateRouter({ Router, requireUser, requireDatabase }) {
  const router = Router();

  router.post('/calculate', async (req, res, next) => {
    try {
      const book = await loadRateBook(req.body || {});
      const result = calculateEstimate(req.body || {}, book);
      res.json({
        ok: true,
        estimate: result,
        rateBook: {
          source: book.source,
          updatedAt: book.updatedAt,
          illustrative: book.illustrative,
          regionalRates: book.regionalRates,
        },
      });
    } catch (error) {
      next(httpError(400, error.message));
    }
  });

  router.get('/', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const estimates = await CostEstimate.find({ ownerId: req.user.id }).sort({ createdAt: -1 }).limit(50).lean();
      res.json({ ok: true, estimates });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const book = await loadRateBook(req.body || {});
      const result = calculateEstimate(req.body || {}, book);
      const estimate = await CostEstimate.create({
        ownerId: req.user.id,
        projectId: mongoose.isValidObjectId(req.body?.projectId) ? req.body.projectId : undefined,
        title: result.input.projectName,
        input: result.input,
        result,
        rateSnapshot: {
          source: book.source,
          updatedAt: book.updatedAt,
          illustrative: book.illustrative,
          locationFactors: book.locationFactors,
          regionalRates: book.regionalRates,
          qualityFactors: book.qualityFactors,
          materials: book.materials,
          labor: book.labor,
          equipment: book.equipment,
          marginRules: book.marginRules,
          quantityRules: book.quantityRules,
          buildingTemplate: book.buildingTemplate,
        },
      });
      await recordAudit(req, 'estimate.save', 'CostEstimate', estimate._id, { total: result.total });
      res.status(201).json({ ok: true, estimate });
    } catch (error) {
      next(error.status ? error : httpError(400, error.message));
    }
  });

  router.post('/compare', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 3) : [];
      if (ids.length < 2) throw httpError(400, 'Choose two or three saved estimates to compare.');
      const estimates = await CostEstimate.find({ _id: { $in: ids }, ownerId: req.user.id }).lean();
      if (estimates.length !== ids.length) throw httpError(404, 'One or more estimates were not found.');
      res.json({
        ok: true,
        comparison: estimates.map((item) => ({
          id: item._id,
          title: item.title,
          total: item.result.total,
          costPerSqFt: item.result.costPerSqFt,
          category: item.result.input?.category,
          quality: item.result.input?.quality,
          location: item.result.input?.location,
          builtUpSqFt: item.result.areas?.builtUpSqFt,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id/report', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const estimate = await CostEstimate.findById(req.params.id);
      assertOwner(estimate, req.user);
      const pdf = await renderEstimatePdf({ ...estimate.result, estimateId: String(estimate._id) });
      await recordAudit(req, 'estimate.export', 'CostEstimate', estimate._id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="buildright-estimate-${estimate._id}.pdf"`);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const estimate = await CostEstimate.findById(req.params.id).lean();
      assertOwner(estimate, req.user);
      res.json({ ok: true, estimate });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export async function attachEstimateToProject(estimate, projectId, user) {
  if (!projectId) return;
  const project = await Project.findById(projectId);
  assertOwner(project, user);
  project.estimateId = estimate._id;
  project.estimatedBudget = estimate.result.total;
  await project.save();
}
