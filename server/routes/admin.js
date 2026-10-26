import {
  Article,
  AuditLog,
  ContactMessage,
  CostEstimate,
  GenerationJob,
  LaborRate,
  MarketplaceProduct,
  MaterialRate,
  Order,
  PriceHistory,
  Project,
  RegionalRate,
  RepairProject,
  RepairService,
  ServiceRequest,
  SystemSetting,
  User,
} from '../models/index.js';
import { httpError, pagination } from '../lib/http.js';
import { LOCATION_FACTORS, QUALITY_FACTORS } from '../../shared/rateBook.js';

export function createAdminRouter({ Router, requireAdmin, requireDatabase }) {
  const router = Router();
  router.use(requireAdmin, requireDatabase);

  router.get('/overview', async (_req, res, next) => {
    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [
        users, projects, estimates, messages, jobs, articles, products, orders, repairProjects, openRequests,
        materials, activeServices, regionalCoverage, recentPriceUpdates,
      ] = await Promise.all([
        User.countDocuments(),
        Project.countDocuments(),
        CostEstimate.countDocuments(),
        ContactMessage.countDocuments({ status: 'new' }),
        GenerationJob.countDocuments(),
        Article.countDocuments(),
        MarketplaceProduct.countDocuments({ active: true }),
        Order.countDocuments(),
        RepairProject.countDocuments(),
        ServiceRequest.countDocuments({ status: { $in: ['requested', 'assigned', 'accepted'] } }),
        MaterialRate.countDocuments(),
        RepairService.countDocuments({ active: true }),
        RegionalRate.countDocuments({ active: true }),
        MaterialRate.countDocuments({ lastPriceUpdate: { $gte: weekAgo } }),
      ]);
      const [recentJobs, statusRows, revenueRows, priceHistory, recentActivity, recentEstimates] = await Promise.all([
        GenerationJob.find({}).sort({ createdAt: -1 }).limit(8).lean(),
        Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Order.aggregate([{ $match: { status: { $ne: 'Cancelled' } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
        PriceHistory.find({}).sort({ createdAt: -1 }).limit(20).lean(),
        AuditLog.find({}).sort({ createdAt: -1 }).limit(15).lean(),
        CostEstimate.find({}).sort({ createdAt: -1 }).limit(8).select('title result.total createdAt input.location').lean(),
      ]);
      const priceChart = await PriceHistory.aggregate([
        { $match: { field: { $in: ['rate', 'ratePerSqFt', 'multiplier'] }, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            changes: { $sum: 1 },
            avgNew: { $avg: '$newValue' },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ]);
      res.json({
        ok: true,
        counts: {
          users,
          projects,
          estimates,
          messages,
          jobs,
          articles,
          products,
          orders,
          repairProjects,
          openRequests,
          materials,
          activeServices,
          regionalCoverage,
          recentPriceUpdates,
          laborRates: await LaborRate.countDocuments(),
        },
        recentJobs,
        recentEstimates,
        priceHistory,
        recentActivity,
        priceChart: priceChart.map((row) => ({ date: row._id, changes: row.changes, avgNew: row.avgNew })),
        ordersByStatus: statusRows.map((row) => ({ status: row._id, count: row.count })),
        orderValue: revenueRows[0]?.total || 0,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/estimates', async (req, res, next) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const [estimates, total] = await Promise.all([
        CostEstimate.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        CostEstimate.countDocuments(),
      ]);
      res.json({ ok: true, estimates, page, total });
    } catch (error) {
      next(error);
    }
  });

  router.get('/users', async (req, res, next) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const [users, total] = await Promise.all([
        User.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        User.countDocuments(),
      ]);
      res.json({ ok: true, users, page, total });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/users/:id', async (req, res, next) => {
    try {
      const update = {};
      if (req.body?.role) {
        if (!['user', 'admin', 'supplier', 'provider'].includes(req.body.role)) throw httpError(400, 'Role must be user, supplier, provider, or admin.');
        update.role = req.body.role;
      }
      if (typeof req.body?.disabled === 'boolean') update.disabled = req.body.disabled;
      const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
      if (!user) throw httpError(404, 'User was not found.');
      res.json({ ok: true, user: { id: user._id, name: user.name, email: user.email, role: user.role, disabled: user.disabled } });
    } catch (error) {
      next(error);
    }
  });

  router.get('/messages', async (_req, res, next) => {
    try {
      const messages = await ContactMessage.find({}).sort({ createdAt: -1 }).limit(100).lean();
      res.json({ ok: true, messages });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/messages/:id', async (req, res, next) => {
    try {
      const message = await ContactMessage.findByIdAndUpdate(req.params.id, { status: 'reviewed' }, { new: true });
      if (!message) throw httpError(404, 'Message was not found.');
      res.json({ ok: true, message });
    } catch (error) {
      next(error);
    }
  });

  router.get('/jobs', async (_req, res, next) => {
    try {
      const jobs = await GenerationJob.find({}).sort({ createdAt: -1 }).limit(50).lean();
      res.json({ ok: true, jobs });
    } catch (error) {
      next(error);
    }
  });

  router.get('/audit', async (_req, res, next) => {
    try {
      const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(50).lean();
      res.json({ ok: true, logs });
    } catch (error) {
      next(error);
    }
  });

  router.get('/settings', async (_req, res, next) => {
    try {
      const settings = await SystemSetting.findOne({ key: 'rates' }).lean();
      res.json({ ok: true, settings: settings?.value || { locationFactors: LOCATION_FACTORS, qualityFactors: QUALITY_FACTORS } });
    } catch (error) {
      next(error);
    }
  });

  router.put('/settings', async (req, res, next) => {
    try {
      const current = await SystemSetting.findOne({ key: 'rates' });
      const value = { ...(current?.value || {}), ...(req.body || {}) };
      const settings = await SystemSetting.findOneAndUpdate({ key: 'rates' }, { value }, { new: true, upsert: true });
      res.json({ ok: true, settings: settings.value });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
