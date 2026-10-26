import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../server/services/database.js';
import { ensureMarketplaceCatalog } from '../server/services/ensureCatalog.js';
import { MarketplaceProduct } from '../server/models/index.js';
import { loadEnv } from '../server/lib/http.js';
import { priceMaterialLines } from '../shared/repairEngine.js';
import { runQuantityCalculator } from '../shared/quantityEngine.js';

const env = loadEnv();
await connectDatabase(env.mongoUri);
await ensureMarketplaceCatalog();

const products = await MarketplaceProduct.find({ active: true, stock: { $gt: 0 } }).lean();
console.log('active products', products.length);

const plaster = runQuantityCalculator('plaster', { lengthFt: 12, heightFt: 10, walls: 4, thicknessMm: 12, quality: 'standard' });
const lines = priceMaterialLines(plaster.lines, products, 'standard');
const cost = lines.reduce((sum, line) => sum + line.lineTotal, 0);
console.log(JSON.stringify({
  unmatched: lines.filter((line) => line.unmatched).map((line) => line.name),
  materialCost: cost,
  sample: lines.map((line) => ({ name: line.name, brand: line.brand, unitPrice: line.unitPrice, lineTotal: line.lineTotal })),
}, null, 2));

await mongoose.disconnect();
