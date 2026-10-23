import { AuditLog, CostEstimate, DesignSpecification, Order, Project, RepairProject } from '../models/index.js';
import DesignProject from '../models/DesignProject.js';

export function createDashboardRouter({ Router, requireUser, requireDatabase }) {
  const router = Router();
  router.get('/', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const ownerId = req.user.id;
      const [projects, estimates, designs, activity, orders, repairs] = await Promise.all([
        Project.find({ ownerId }).sort({ updatedAt: -1 }).limit(12).lean(),
        CostEstimate.find({ ownerId }).sort({ createdAt: -1 }).limit(12).lean(),
        DesignProject.find({ ownerId }).sort({ updatedAt: -1 }).limit(12).lean(),
        AuditLog.find({ actorId: ownerId }).sort({ createdAt: -1 }).limit(12).lean(),
        Order.find({ ownerId }).sort({ createdAt: -1 }).limit(8).select('orderNumber status total createdAt').lean(),
        RepairProject.find({ ownerId }).sort({ updatedAt: -1 }).limit(8).select('title progress estimate.total updatedAt').lean(),
      ]);
      const specifications = await DesignSpecification.countDocuments({ ownerId });
      const spent = estimates.reduce((sum, item) => sum + (item.result?.total || 0), 0);
      res.json({
        ok: true,
        counts: {
          projects: projects.length,
          estimates: estimates.length,
          designs: designs.length,
          specifications,
          orders: orders.length,
          repairs: repairs.length,
        },
        totals: { estimated: spent },
        projects,
        estimates,
        designs,
        orders,
        repairs,
        activity,
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
