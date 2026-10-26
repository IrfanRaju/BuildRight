import { MarketplaceProduct, ProductCategory, User } from '../models/index.js';
import { MARKET_CATEGORIES, MARKET_PRODUCTS } from '../data/marketplaceSeed.js';
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
        await MarketplaceProduct.updateOne(
          { sku: product.sku },
          {
            $setOnInsert: {
              ...product,
              categoryId: categoryIds.get(product.categorySlug),
              supplierId: supplier._id,
              priceUpdatedAt: new Date('2026-10-01T00:00:00Z'),
            },
            $set: {
              active: true,
              stock: Math.max(product.stock || 0, 1),
              pricePkr: product.pricePkr,
              roles: product.roles,
              unit: product.unit,
              quality: product.quality,
              brand: product.brand,
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
