import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin', 'supplier', 'provider'], default: 'user', index: true },
  accountStatus: { type: String, enum: ['active', 'suspended', 'disabled'], default: 'active', index: true },
  disabled: { type: Boolean, default: false },
  resetTokenHash: { type: String, select: false },
  resetTokenExpires: { type: Date, select: false },
}, { timestamps: true });

/** Dedicated admin accounts (synced with User role=admin for JWT login). */
const adminSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'superadmin'], default: 'admin', index: true },
  accountStatus: { type: String, enum: ['active', 'suspended', 'disabled'], default: 'active', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

const projectSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  projectType: { type: String, required: true, maxlength: 80 },
  category: { type: String, enum: ['residential', 'commercial', 'corporate', 'institutional', 'infrastructure'], default: 'residential', index: true },
  location: { type: String, default: 'Islamabad', maxlength: 80 },
  area: { type: Number, min: 0 },
  areaUnit: { type: String, default: 'sq ft', maxlength: 20 },
  floors: { type: Number, min: 0, max: 80 },
  description: { type: String, default: '', maxlength: 2000 },
  estimatedBudget: { type: Number, min: 0 },
  imageUrl: { type: String, default: '', maxlength: 500 },
  visibility: { type: String, enum: ['private', 'public'], default: 'private', index: true },
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  isSample: { type: Boolean, default: false },
  designProjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'DesignProject' },
  estimateId: { type: mongoose.Schema.Types.ObjectId, ref: 'CostEstimate' },
}, { timestamps: true });

const designSpecificationSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  prompt: { type: String, required: true, maxlength: 5000 },
  specification: { type: mongoose.Schema.Types.Mixed, required: true },
  questions: { type: [String], default: [] },
  assumptions: { type: [String], default: [] },
}, { timestamps: true });

const costEstimateSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  title: { type: String, required: true, maxlength: 140 },
  input: { type: mongoose.Schema.Types.Mixed, required: true },
  result: { type: mongoose.Schema.Types.Mixed, required: true },
  rateSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });
costEstimateSchema.index({ ownerId: 1, createdAt: -1 });

const materialRateSchema = new mongoose.Schema({
  code: { type: String, required: true, index: true },
  name: { type: String, required: true, maxlength: 120 },
  category: { type: String, required: true, index: true },
  brand: { type: String, default: '', maxlength: 80 },
  description: { type: String, default: '', maxlength: 2000 },
  unit: { type: String, required: true },
  scope: { type: String, enum: ['grey', 'finishing'], required: true },
  perSqFt: { type: Number, required: true, min: 0 },
  rate: { type: Number, required: true, min: 0 },
  previousPrice: { type: Number, default: null, min: 0 },
  stockQuantity: { type: Number, default: 0, min: 0 },
  availability: { type: String, enum: ['in_stock', 'limited', 'out_of_stock', 'made_to_order'], default: 'in_stock', index: true },
  imageUrl: { type: String, default: '', maxlength: 500 },
  galleryImages: { type: [String], default: [] },
  quality: { type: String, default: 'standard' },
  location: { type: String, default: 'Islamabad', index: true },
  /** When true, the stored rate already includes regional/transport costs for that city. */
  priceIncludesTransport: { type: Boolean, default: false },
  supplier: { type: String, default: '', maxlength: 160 },
  source: { type: String, required: true, maxlength: 240 },
  illustrative: { type: Boolean, default: true },
  effectiveFrom: { type: Date, default: Date.now },
  lastPriceUpdate: { type: Date, default: Date.now },
}, { timestamps: true });
materialRateSchema.index({ code: 1, location: 1, quality: 1 });

const laborRateSchema = new mongoose.Schema({
  kind: { type: String, enum: ['labor', 'equipment'], default: 'labor' },
  skill: {
    type: String,
    enum: ['mason', 'laborer', 'steel_fixer', 'carpenter', 'electrician', 'plumber', 'painter', 'tile_worker', 'general', 'equipment'],
    default: 'general',
    index: true,
  },
  unit: { type: String, enum: ['daily', 'hourly', 'per_sq_ft'], default: 'per_sq_ft' },
  scope: { type: String, enum: ['grey', 'finishing', 'any'], default: 'any' },
  quality: { type: String, default: 'standard' },
  location: { type: String, default: 'Islamabad', index: true },
  rate: { type: Number, min: 0, default: null },
  ratePerSqFt: { type: Number, required: true, min: 0 },
  source: { type: String, required: true },
  illustrative: { type: Boolean, default: true },
  effectiveFrom: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
}, { timestamps: true });
laborRateSchema.index({ location: 1, skill: 1, kind: 1 });

const contractorSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 120 },
  role: { type: String, required: true, maxlength: 80 },
  specialties: { type: [String], default: [] },
  locations: { type: [String], default: [] },
  summary: { type: String, default: '', maxlength: 1000 },
  email: { type: String, default: '', maxlength: 160 },
  phone: { type: String, default: '', maxlength: 40 },
  imageUrl: { type: String, default: '', maxlength: 500 },
  verificationStatus: { type: String, enum: ['unverified', 'verified'], default: 'unverified' },
  sample: { type: Boolean, default: true },
}, { timestamps: true });

const articleSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 180 },
  slug: { type: String, required: true, unique: true, index: true },
  category: { type: String, required: true, index: true },
  excerpt: { type: String, required: true, maxlength: 400 },
  body: { type: String, required: true, maxlength: 20000 },
  imageUrl: { type: String, default: '', maxlength: 500 },
  published: { type: Boolean, default: true },
}, { timestamps: true });

const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 80 },
  email: { type: String, required: true, maxlength: 160 },
  subject: { type: String, required: true, maxlength: 140 },
  message: { type: String, required: true, maxlength: 4000 },
  status: { type: String, enum: ['new', 'reviewed'], default: 'new', index: true },
}, { timestamps: true });

const generationJobSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  prompt: { type: String, required: true, maxlength: 5000 },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending', index: true },
  provider: { type: String, default: 'procedural' },
  resultSummary: { type: String, default: '' },
  error: { type: String, default: '' },
}, { timestamps: true });

const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true, index: true },
  entity: { type: String, required: true },
  entityId: { type: String, default: '' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: '' },
}, { timestamps: true });

const systemSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

const productCategorySchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, maxlength: 80 },
  description: { type: String, default: '', maxlength: 400 },
  sortOrder: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  seeded: { type: Boolean, default: false },
}, { timestamps: true });

const marketplaceProductSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true, index: true },
  slug: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, maxlength: 140 },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductCategory', index: true },
  categorySlug: { type: String, required: true, index: true },
  brand: { type: String, default: '', maxlength: 80, index: true },
  description: { type: String, default: '', maxlength: 2000 },
  specifications: { type: [{ label: String, value: String }], default: [] },
  unit: { type: String, enum: ['bag', 'piece', 'kg', 'ton', 'liter', 'meter', 'sq ft', 'cft'], required: true },
  pricePkr: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  supplierName: { type: String, default: '', maxlength: 140 },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  deliveryDays: { type: Number, default: 3, min: 0, max: 60 },
  images: { type: [String], default: [] },
  roles: { type: [String], default: [], index: true },
  quality: { type: String, enum: ['economy', 'standard', 'premium', 'luxury'], default: 'standard' },
  priceSource: { type: String, enum: ['admin', 'supplier'], default: 'admin' },
  priceUpdatedAt: { type: Date, default: Date.now },
  illustrative: { type: Boolean, default: true },
  active: { type: Boolean, default: true, index: true },
  seeded: { type: Boolean, default: false },
}, { timestamps: true });

const cartSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  items: {
    type: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketplaceProduct', required: true },
      quantity: { type: Number, required: true, min: 1 },
    }],
    default: [],
  },
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: {
    type: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketplaceProduct' },
      name: String,
      brand: String,
      unit: String,
      quantity: Number,
      unitPrice: Number,
      lineTotal: Number,
      supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      supplierName: String,
    }],
    default: [],
  },
  subtotal: { type: Number, required: true, min: 0 },
  deliveryCharge: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  distanceKm: { type: Number, default: 0 },
  address: {
    name: String,
    phone: String,
    line1: String,
    city: String,
    instructions: { type: String, default: '' },
  },
  status: { type: String, enum: ['Pending', 'Confirmed', 'Processing', 'Dispatched', 'Out for Delivery', 'Delivered', 'Cancelled'], default: 'Pending', index: true },
  statusHistory: { type: [{ status: String, note: String, at: Date, by: String }], default: [] },
  cancellationReason: { type: String, default: '' },
  priceNotice: { type: String, default: '' },
}, { timestamps: true });
orderSchema.index({ ownerId: 1, createdAt: -1 });

const repairServiceSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, maxlength: 80 },
  summary: { type: String, default: '', maxlength: 400 },
  calculator: { type: String, required: true },
  keywords: { type: [String], default: [] },
  tasks: { type: [String], default: [] },
  imageUrl: { type: String, default: '', maxlength: 500 },
  galleryImages: { type: [String], default: [] },
  active: { type: Boolean, default: true },
  seeded: { type: Boolean, default: false },
}, { timestamps: true });

const repairPricingRuleSchema = new mongoose.Schema({
  serviceSlug: { type: String, required: true, unique: true, index: true },
  laborUnit: { type: String, default: 'sq ft' },
  labor: { economy: Number, standard: Number, premium: Number, luxury: Number },
  equipment: { economy: Number, standard: Number, premium: Number, luxury: Number },
  source: { type: String, default: '' },
  illustrative: { type: Boolean, default: true },
}, { timestamps: true });

const repairProjectSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 140 },
  buildingType: { type: String, default: 'House', maxlength: 40 },
  location: { type: String, default: 'Islamabad', maxlength: 80 },
  budget: { type: Number, default: 0, min: 0 },
  startDate: { type: String, default: '' },
  tasks: { type: [mongoose.Schema.Types.Mixed], default: [] },
  estimate: { type: mongoose.Schema.Types.Mixed, default: null },
  photos: { type: [{ dataUrl: String, caption: String, kind: { type: String, enum: ['existing', 'completion', 'concept'] } }], default: [] },
  notes: { type: String, default: '', maxlength: 4000 },
  progress: { type: String, enum: ['Planning', 'Materials ordered', 'In progress', 'Completed'], default: 'Planning', index: true },
  orderIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Order', default: [] },
  visual: { color: { type: String, default: '#F4E4C8' }, finish: { type: String, default: 'Matte' }, style: { type: String, default: 'Modern' } },
}, { timestamps: true });

const serviceProviderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  name: { type: String, required: true, maxlength: 120 },
  trades: { type: [String], default: [] },
  phone: { type: String, default: '', maxlength: 40 },
  email: { type: String, default: '', maxlength: 160 },
  cities: { type: [String], default: [] },
  active: { type: Boolean, default: true },
  sample: { type: Boolean, default: false },
}, { timestamps: true });

const serviceRequestSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'RepairProject', default: null },
  trade: { type: String, required: true, maxlength: 80 },
  description: { type: String, default: '', maxlength: 2000 },
  location: { type: String, default: '', maxlength: 80 },
  preferredDate: { type: String, default: '' },
  status: { type: String, enum: ['requested', 'assigned', 'accepted', 'declined', 'confirmed', 'completed', 'cancelled'], default: 'requested', index: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceProvider', default: null },
  history: { type: [{ status: String, note: String, at: Date }], default: [] },
}, { timestamps: true });

const regionalRateSchema = new mongoose.Schema({
  city: { type: String, required: true, unique: true, trim: true, maxlength: 80, index: true },
  region: { type: String, default: '', maxlength: 80 },
  multiplier: { type: Number, required: true, min: 0.5, max: 3, default: 1 },
  transportAdjustment: { type: Number, default: 0, min: 0, max: 1 },
  notes: { type: String, default: '', maxlength: 500 },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true });

const marginRuleSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 120 },
  projectType: { type: String, default: '*', maxlength: 80, index: true },
  quality: { type: String, default: '*', maxlength: 40 },
  minCoveredArea: { type: Number, default: 0, min: 0 },
  maxCoveredArea: { type: Number, default: null },
  minFloors: { type: Number, default: 1, min: 1 },
  maxFloors: { type: Number, default: null },
  projectSize: { type: String, enum: ['small', 'medium', 'large', 'any'], default: 'any' },
  marginPercent: { type: Number, required: true, min: 0, max: 40 },
  priority: { type: Number, default: 100, index: true },
  active: { type: Boolean, default: true, index: true },
  notes: { type: String, default: '', maxlength: 400 },
}, { timestamps: true });

const quantityRuleSchema = new mongoose.Schema({
  code: { type: String, required: true, index: true },
  name: { type: String, required: true, maxlength: 120 },
  category: { type: String, required: true, maxlength: 60 },
  unit: { type: String, required: true, maxlength: 30 },
  scope: { type: String, enum: ['grey', 'finishing'], required: true },
  buildingType: { type: String, default: '*', maxlength: 80, index: true },
  constructionType: { type: String, default: '*', maxlength: 80 },
  quality: { type: String, default: '*', maxlength: 40 },
  perSqFt: { type: Number, required: true, min: 0 },
  floorFactor: { type: Number, default: 0, min: -1, max: 1 },
  notes: { type: String, default: '', maxlength: 400 },
  active: { type: Boolean, default: true },
}, { timestamps: true });
quantityRuleSchema.index({ code: 1, buildingType: 1, quality: 1 });

const buildingTemplateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, maxlength: 60 },
  name: { type: String, required: true, maxlength: 120 },
  buildingType: { type: String, required: true, maxlength: 80, index: true },
  constructionType: { type: String, default: 'Framed RCC', maxlength: 80 },
  description: { type: String, default: '', maxlength: 1000 },
  quantityMultipliers: { type: Map, of: Number, default: {} },
  laborIntensity: { type: Number, default: 1, min: 0.5, max: 2 },
  timelineFactor: { type: Number, default: 1, min: 0.5, max: 2 },
  phases: {
    type: [{
      key: String,
      label: String,
      shareOfDuration: Number,
      canOverlapPrev: { type: Boolean, default: false },
      overlapRatio: { type: Number, default: 0 },
    }],
    default: [],
  },
  active: { type: Boolean, default: true },
}, { timestamps: true });

const priceHistorySchema = new mongoose.Schema({
  entityType: { type: String, enum: ['Material', 'MaterialRate', 'MarketplaceProduct', 'LaborRate', 'RegionalRate'], required: true, index: true },
  entityId: { type: String, required: true, index: true },
  field: { type: String, default: 'rate', maxlength: 40 },
  previousValue: { type: Number, default: null },
  newValue: { type: Number, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  changedByEmail: { type: String, default: '', maxlength: 160 },
  note: { type: String, default: '', maxlength: 240 },
}, { timestamps: true });
priceHistorySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

const uploadedImageSchema = new mongoose.Schema({
  url: { type: String, required: true, maxlength: 500 },
  publicId: { type: String, default: '', maxlength: 200 },
  originalName: { type: String, default: '', maxlength: 200 },
  mimeType: { type: String, default: '', maxlength: 80 },
  bytes: { type: Number, default: 0 },
  width: { type: Number, default: null },
  height: { type: Number, default: null },
  provider: { type: String, enum: ['cloudinary', 'local'], default: 'local' },
  entityType: { type: String, default: '', maxlength: 60 },
  entityId: { type: String, default: '', maxlength: 60 },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

function model(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}

export const User = model('User', userSchema);
export const Admin = model('Admin', adminSchema);
export const Project = model('Project', projectSchema);
export const DesignSpecification = model('DesignSpecification', designSpecificationSchema);
export const CostEstimate = model('CostEstimate', costEstimateSchema);
/** Alias used by the FYP Material inventory/admin checklist — same collection as MaterialRate. */
export const MaterialRate = model('MaterialRate', materialRateSchema);
export const Material = MaterialRate;
export const Estimate = CostEstimate;
export const LaborRate = model('LaborRate', laborRateSchema);
export const Contractor = model('Contractor', contractorSchema);
export const Article = model('Article', articleSchema);
export const ContactMessage = model('ContactMessage', contactMessageSchema);
export const GenerationJob = model('GenerationJob', generationJobSchema);
export const AuditLog = model('AuditLog', auditLogSchema);
export const SystemSetting = model('SystemSetting', systemSettingSchema);
export const ProductCategory = model('ProductCategory', productCategorySchema);
export const MarketplaceProduct = model('MarketplaceProduct', marketplaceProductSchema);
export const Cart = model('Cart', cartSchema);
export const Order = model('Order', orderSchema);
export const RepairService = model('RepairService', repairServiceSchema);
export const RepairPricingRule = model('RepairPricingRule', repairPricingRuleSchema);
export const RepairProject = model('RepairProject', repairProjectSchema);
export const ServiceProvider = model('ServiceProvider', serviceProviderSchema);
export const ServiceRequest = model('ServiceRequest', serviceRequestSchema);
export const RegionalRate = model('RegionalRate', regionalRateSchema);
export const MarginRule = model('MarginRule', marginRuleSchema);
export const QuantityRule = model('QuantityRule', quantityRuleSchema);
export const BuildingTemplate = model('BuildingTemplate', buildingTemplateSchema);
export const PriceHistory = model('PriceHistory', priceHistorySchema);
export const UploadedImage = model('UploadedImage', uploadedImageSchema);
