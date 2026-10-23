import 'dotenv/config';
import mongoose from 'mongoose';
import { illustrativeRateBook, LOCATION_FACTORS, QUALITY_FACTORS, RATE_SOURCE, RATE_UPDATED_AT } from '../shared/rateBook.js';
import { hashPassword } from './routes/auth.js';
import { DEFAULT_COMMERCE } from '../shared/commerce.js';
import { DEFAULT_LABOR_RULES, LABOR_RATE_SOURCE, REPAIR_SERVICES } from '../shared/repairCatalog.js';
import { MARKET_CATEGORIES, MARKET_PRODUCTS } from './data/marketplaceSeed.js';
import {
  Article,
  Contractor,
  LaborRate,
  MarketplaceProduct,
  MaterialRate,
  ProductCategory,
  Project,
  RepairPricingRule,
  RepairService,
  ServiceProvider,
  SystemSetting,
  User,
} from './models/index.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/buildright';
const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@buildright.local').toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe-Admin-2026';
const supplierEmail = (process.env.SEED_SUPPLIER_EMAIL || 'supplier@buildright.local').toLowerCase();
const supplierPassword = process.env.SEED_SUPPLIER_PASSWORD || 'ChangeMe-Supplier-2026';
const providerEmail = (process.env.SEED_PROVIDER_EMAIL || 'provider@buildright.local').toLowerCase();
const providerPassword = process.env.SEED_PROVIDER_PASSWORD || 'ChangeMe-Provider-2026';

await mongoose.connect(uri);
const book = illustrativeRateBook();

await Promise.all([
  MaterialRate.deleteMany({ illustrative: true }),
  LaborRate.deleteMany({ illustrative: true }),
  Contractor.deleteMany({ sample: true }),
  Project.deleteMany({ isSample: true }),
  Article.deleteMany({ slug: { $in: ['plan-a-house-before-you-build', 'how-to-read-a-planning-estimate', 'choosing-a-construction-quality-level', 'what-a-concept-floor-plan-is'] } }),
]);

await MaterialRate.insertMany(book.materials.map((item) => ({
  ...item,
  source: RATE_SOURCE,
  illustrative: true,
  effectiveFrom: new Date(RATE_UPDATED_AT),
})));
await LaborRate.insertMany([
  ...book.labor.map((item) => ({ ...item, kind: 'labor', source: RATE_SOURCE, illustrative: true, effectiveFrom: new Date(RATE_UPDATED_AT) })),
  ...book.equipment.map((item) => ({ ...item, kind: 'equipment', source: RATE_SOURCE, illustrative: true, effectiveFrom: new Date(RATE_UPDATED_AT) })),
]);
await SystemSetting.findOneAndUpdate(
  { key: 'rates' },
  { value: { source: RATE_SOURCE, locationFactors: LOCATION_FACTORS, qualityFactors: QUALITY_FACTORS, defaults: book.defaults } },
  { upsert: true },
);

const admin = await User.findOne({ email: adminEmail });
if (!admin) {
  await User.create({ name: 'BuildRight Admin', email: adminEmail, passwordHash: hashPassword(adminPassword), role: 'admin' });
}
const supplier = await User.findOne({ email: supplierEmail }) || await User.create({ name: 'Margalla Materials', email: supplierEmail, passwordHash: hashPassword(supplierPassword), role: 'supplier' });
const providerUser = await User.findOne({ email: providerEmail }) || await User.create({ name: 'Sample Painter', email: providerEmail, passwordHash: hashPassword(providerPassword), role: 'provider' });

for (const category of MARKET_CATEGORIES) {
  await ProductCategory.updateOne({ slug: category.slug }, { $setOnInsert: category }, { upsert: true });
}
const categories = await ProductCategory.find({ slug: { $in: MARKET_CATEGORIES.map((category) => category.slug) } }).lean();
const categoryIds = new Map(categories.map((category) => [category.slug, category._id]));
for (const product of MARKET_PRODUCTS) {
  await MarketplaceProduct.updateOne(
    { sku: product.sku },
    { $setOnInsert: { ...product, categoryId: categoryIds.get(product.categorySlug), supplierId: supplier._id, priceUpdatedAt: new Date('2026-10-01T00:00:00Z') } },
    { upsert: true },
  );
}
for (const service of REPAIR_SERVICES) {
  await RepairService.updateOne({ slug: service.slug }, { $setOnInsert: { ...service, active: true, seeded: true } }, { upsert: true });
}
for (const [serviceSlug, rule] of Object.entries(DEFAULT_LABOR_RULES)) {
  await RepairPricingRule.updateOne(
    { serviceSlug },
    { $setOnInsert: { serviceSlug, ...rule, source: LABOR_RATE_SOURCE, illustrative: true } },
    { upsert: true },
  );
}
const commerce = await SystemSetting.findOne({ key: 'commerce' });
if (!commerce) await SystemSetting.create({ key: 'commerce', value: DEFAULT_COMMERCE });
const providers = [
  { userId: providerUser._id, name: 'Sample Painter', trades: ['Painter', 'Wall repair'], phone: '+92 300 0000011', email: providerEmail, cities: ['Islamabad', 'Rawalpindi'], active: true, sample: true },
  { name: 'Sample Plumber', trades: ['Plumber'], phone: '+92 300 0000012', email: 'plumber@example.com', cities: ['Lahore'], active: true, sample: true },
  { name: 'Sample Electrician', trades: ['Electrician'], phone: '+92 300 0000013', email: 'electrician@example.com', cities: ['Karachi'], active: true, sample: true },
  { name: 'Sample Repair Contractor', trades: ['General repair', 'Roof repair'], phone: '+92 300 0000014', email: 'repairs@example.com', cities: ['Peshawar', 'Islamabad'], active: true, sample: true },
];
for (const provider of providers) {
  await ServiceProvider.updateOne({ email: provider.email }, { $setOnInsert: provider }, { upsert: true });
}

await Contractor.insertMany([
  { name: 'Sample Architect Studio', role: 'Architect', specialties: ['Houses', 'Interior planning'], locations: ['Islamabad', 'Rawalpindi'], summary: 'Sample directory profile for the BuildRight demonstration. This is not a verified practice.', email: 'architect@example.com', phone: '+92 300 0000001', verificationStatus: 'unverified', sample: true },
  { name: 'Sample Civil Works', role: 'Contractor', specialties: ['Grey structure', 'Turnkey houses'], locations: ['Lahore'], summary: 'Sample contractor listing. Verification has not been completed.', email: 'contractor@example.com', phone: '+92 300 0000002', verificationStatus: 'unverified', sample: true },
  { name: 'Sample Structure Office', role: 'Engineer', specialties: ['RCC frames', 'Quantity review'], locations: ['Karachi'], summary: 'Sample engineer profile for browsing the directory.', email: 'engineer@example.com', phone: '+92 300 0000003', verificationStatus: 'unverified', sample: true },
  { name: 'Sample Site Coordination', role: 'Construction service', specialties: ['Scheduling', 'Renovation planning'], locations: ['Peshawar', 'Islamabad'], summary: 'Sample service provider. Contact details are placeholders.', email: 'planning@example.com', phone: '+92 300 0000004', verificationStatus: 'unverified', sample: true },
]);

await Project.insertMany([
  { title: 'Lakeside Villa concept', projectType: 'House', category: 'residential', location: 'Islamabad', area: 3400, areaUnit: 'sq ft', floors: 2, description: 'Sample residential concept card. The budget is illustrative and this is not a completed client project.', estimatedBudget: 18600000, imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80', visibility: 'public', isSample: true, status: 'active' },
  { title: 'Civic Plaza concept', projectType: 'Plaza', category: 'commercial', location: 'Lahore', area: 11500, areaUnit: 'sq ft', floors: 4, description: 'Sample commercial plaza used to show gallery filters.', estimatedBudget: 47200000, imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80', visibility: 'public', isSample: true, status: 'active' },
  { title: 'Green Horizon office concept', projectType: 'Office', category: 'corporate', location: 'Karachi', area: 9200, areaUnit: 'sq ft', floors: 6, description: 'Sample corporate office concept with an illustrative budget.', estimatedBudget: 31800000, imageUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80', visibility: 'public', isSample: true, status: 'active' },
  { title: 'Learning court concept', projectType: 'School', category: 'institutional', location: 'Peshawar', area: 14000, areaUnit: 'sq ft', floors: 3, description: 'Sample institutional project for the gallery.', estimatedBudget: 54000000, imageUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1200&q=80', visibility: 'public', isSample: true, status: 'active' },
  { title: 'Ridge access road concept', projectType: 'Road', category: 'infrastructure', location: 'Gilgit-Baltistan', area: 600, areaUnit: 'm', floors: 1, description: 'Sample infrastructure card. Road geometry is a concept layout, not a highway design.', estimatedBudget: 12000000, imageUrl: 'https://images.unsplash.com/photo-1465447142348-e9952c393450?auto=format&fit=crop&w=1200&q=80', visibility: 'public', isSample: true, status: 'active' },
]);

await Article.insertMany([
  { title: 'Plan a house before you build', slug: 'plan-a-house-before-you-build', category: 'Construction planning', excerpt: 'A practical sequence for turning a plot and a room list into a concept plan and a first budget.', body: 'Start with the plot size, the number of floors, and the rooms you actually need. BuildRight can turn that brief into a concept floor plan and a matching 3D preview, then price the same area in the cost estimator.\n\nKeep the first pass conceptual. Confirm structural spans, soil conditions, and local bylaws with a qualified engineer before construction.\n\nUse the estimate assumptions panel to see which rates are illustrative and which inputs drive the total.', imageUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80', published: true },
  { title: 'How to read a planning estimate', slug: 'how-to-read-a-planning-estimate', category: 'Budgeting', excerpt: 'What the material, labor, overhead, and contingency lines mean, and what they leave out.', body: 'A BuildRight estimate adds material cost, labor, and equipment, then applies overhead once. Contractor margin and contingency are each calculated from that same base. They are not stacked on top of each other, and tax is not charged on the contingency allowance.\n\nThe quantity rules are per square foot of built-up area. They are planning factors, not a site-measured bill of quantities.\n\nSaved estimates keep the rate snapshot used at the time, so a later price change does not rewrite an older report.', imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80', published: true },
  { title: 'Choosing a construction quality level', slug: 'choosing-a-construction-quality-level', category: 'Material selection', excerpt: 'Economy, standard, premium, and luxury change the rate factor. They do not change the geometry.', body: 'Quality levels scale the Islamabad standard sample rates. Economy is below the base, luxury is well above it. If an administrator stores an exact rate for a city and quality, that exact rate is used instead of the factor.\n\nPick the level that matches the finishes you expect, then compare two saved estimates side by side before you commit.', imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80', published: true },
  { title: 'What a concept floor plan is', slug: 'what-a-concept-floor-plan-is', category: 'Architectural design', excerpt: 'The design studio draws dimensions from a structured specification. It is not a permit set.', body: 'The studio reads your description, records assumptions, and builds rooms with a geometry engine. The same specification drives the SVG plan and the Three.js model.\n\nRoads, parking, and tunnels use their own templates. They are not forced through the house room generator.\n\nExport PNG or SVG for the plan and GLB for the model when you want to keep a copy. Have a designer or engineer develop anything that will be built.', imageUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80', published: true },
]);

console.info(`Seed complete. Admin: ${adminEmail} · Supplier: ${supplierEmail} · Provider: ${providerEmail}`);
if (!process.env.SEED_ADMIN_PASSWORD) console.info('Development passwords use the ChangeMe-* defaults. Change them before any shared deployment.');
await mongoose.disconnect();
