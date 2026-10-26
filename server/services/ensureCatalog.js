import { MarketplaceProduct, ProductCategory, RepairPricingRule, RepairService, User } from '../models/index.js';
import { MARKET_CATEGORIES, MARKET_PRODUCTS } from '../data/marketplaceSeed.js';
import { DEFAULT_LABOR_RULES, LABOR_RATE_SOURCE, REPAIR_SERVICES } from '../../shared/repairCatalog.js';
import { hashPassword } from '../routes/auth.js';

const globalForCatalog = globalThis;

/** Upsert seed marketplace catalog when the live DB has no active products. */
export async function ensureMarketplaceCatalog() {
  if (globalForCatalog.__buildrightCatalogReady) return;

  const activeCount = await MarketplaceProduct.countDocuments({ active: true, stock: { $gt: 0 } });
  if (activeCount > 0) {
    globalForCatalog.__buildrightCatalogReady = true;
    return;
  }

  if (!globalForCatalog.__buildrightCatalogPromise) {
    globalForCatalog.__buildrightCatalogPromise = (async () => {
      for (const category of MARKET_CATEGORIES) {
        await ProductCategory.updateOne({ slug: category.slug }, { $setOnInsert: category }, { upsert: true });
      }

      const categories = await ProductCategory.find({ slug: { $in: MARKET_CATEGORIES.map((item) => item.slug) } }).lean();
      const categoryIds = new Map(categories.map((item) => [item.slug, item._id]));

      let supplier = await User.findOne({ role: 'supplier' });
      if (!supplier) {
        supplier = await User.create({
          name: 'Margalla Materials',
          email: 'supplier@buildright.local',
          passwordHash: hashPassword('ChangeMe-Supplier-2026'),
          role: 'supplier',
          accountStatus: 'active',
        });
      }

      for (const product of MARKET_PRODUCTS) {
        // Keep insert-only fields out of $set — Mongo rejects the same path in both
        // $set and $setOnInsert when the upsert creates a new document (empty live DB).
        const {
          active: _active,
          stock: _stock,
          pricePkr,
          roles,
          unit,
          quality,
          brand,
          ...insertFields
        } = product;

        await MarketplaceProduct.updateOne(
          { sku: product.sku },
          {
            $setOnInsert: {
              ...insertFields,
              categoryId: categoryIds.get(product.categorySlug),
              supplierId: supplier._id,
              priceUpdatedAt: new Date('2026-10-01T00:00:00Z'),
            },
            $set: {
              active: true,
              stock: Math.max(product.stock || 0, 1),
              pricePkr,
              roles,
              unit,
              quality,
              brand,
            },
          },
          { upsert: true },
        );
      }

      console.info(`BuildRight marketplace catalog ensured (${MARKET_PRODUCTS.length} products).`);
      globalForCatalog.__buildrightCatalogReady = true;
    })().catch((error) => {
      globalForCatalog.__buildrightCatalogPromise = null;
      throw error;
    });
  }

  await globalForCatalog.__buildrightCatalogPromise;
}

/** Upsert seed repair services when the live DB has none (common after deploy without npm run seed). */
export async function ensureRepairCatalog() {
  if (globalForCatalog.__buildrightRepairReady) return;

  const activeCount = await RepairService.countDocuments({ active: true });
  if (activeCount > 0) {
    globalForCatalog.__buildrightRepairReady = true;
    return;
  }

  if (!globalForCatalog.__buildrightRepairPromise) {
    globalForCatalog.__buildrightRepairPromise = (async () => {
      for (const service of REPAIR_SERVICES) {
        await RepairService.updateOne(
          { slug: service.slug },
          {
            $setOnInsert: { ...service, seeded: true },
            $set: { active: true },
          },
          { upsert: true },
        );
      }

      for (const [serviceSlug, rule] of Object.entries(DEFAULT_LABOR_RULES)) {
        await RepairPricingRule.updateOne(
          { serviceSlug },
          {
            $setOnInsert: {
              serviceSlug,
              ...rule,
              source: LABOR_RATE_SOURCE,
              illustrative: true,
            },
          },
          { upsert: true },
        );
      }

      console.info(`BuildRight repair catalog ensured (${REPAIR_SERVICES.length} services).`);
      globalForCatalog.__buildrightRepairReady = true;
    })().catch((error) => {
      globalForCatalog.__buildrightRepairPromise = null;
      throw error;
    });
  }

  await globalForCatalog.__buildrightRepairPromise;
}
