import { Cart, MarketplaceProduct, Order, ProductCategory, SystemSetting } from '../models/index.js';
import { httpError, pagination, slugify } from '../lib/http.js';
import { containsRegex } from '../lib/search.js';
import { recordAudit } from '../services/database.js';
import { renderOrderInvoice } from '../services/pdf.js';
import { assertOwner } from '../middleware/auth.js';
import {
  CANCELLATION_RULES,
  DEFAULT_COMMERCE,
  allowedStatusChange,
  canCustomerCancel,
  orderTotals,
  restoresStock,
} from '../../shared/commerce.js';
import { PRODUCT_UNITS, QUANTITY_CALCULATORS, runQuantityCalculator } from '../../shared/quantityEngine.js';
import { priceMaterialLines } from '../../shared/repairEngine.js';

const PRICE_NOTICE = DEFAULT_COMMERCE.priceNotice;

async function commerceSettings() {
  const stored = await SystemSetting.findOne({ key: 'commerce' }).lean();
  return { ...DEFAULT_COMMERCE, ...(stored?.value || {}) };
}

function presentProduct(product) {
  const stock = Number(product.stock) || 0;
  return {
    ...product,
    inStock: stock > 0,
    availability: stock > 0 ? `${stock} ${product.unit} in stock` : 'Out of stock',
    priceNotice: PRICE_NOTICE,
  };
}

function cleanSpecs(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((item) => ({
    label: String(item?.label || '').trim().slice(0, 40),
    value: String(item?.value || '').trim().slice(0, 80),
  })).filter((item) => item.label && item.value);
}

function cleanImages(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter((item) => /^https:\/\//.test(item) && item.length <= 500).slice(0, 4);
}

function cleanProduct(body, user, existing) {
  const name = String(body.name || '').trim();
  const sku = String(body.sku || '').trim().toUpperCase();
  const categorySlug = slugify(body.categorySlug || '');
  const unit = String(body.unit || '');
  const pricePkr = Number(body.pricePkr);
  const stock = Number(body.stock);
  const details = [];
  if (name.length < 2 || name.length > 140) details.push('Product name must be 2 to 140 characters.');
  if (!/^[A-Z0-9-]{3,40}$/.test(sku)) details.push('SKU must be 3 to 40 letters, numbers, or hyphens.');
  if (!categorySlug) details.push('Choose a category.');
  if (!PRODUCT_UNITS.includes(unit)) details.push('Choose a supported unit.');
  if (!Number.isFinite(pricePkr) || pricePkr < 0) details.push('Enter a price in PKR.');
  if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) details.push('Stock must be a whole number from 0 to 1,000,000.');
  if (details.length) throw httpError(400, 'Check the product details.', details);
  const priceChanged = !existing || Number(existing.pricePkr) !== pricePkr;
  return {
    sku,
    slug: existing?.slug || slugify(name),
    name,
    categorySlug,
    brand: String(body.brand || '').trim().slice(0, 80),
    description: String(body.description || '').trim().slice(0, 2000),
    specifications: cleanSpecs(body.specifications),
    unit,
    pricePkr,
    stock,
    supplierName: String(body.supplierName || '').trim().slice(0, 140),
    supplierId: user.role === 'supplier' ? user.id : (body.supplierId || existing?.supplierId || null),
    deliveryDays: Math.min(60, Math.max(0, Math.round(Number(body.deliveryDays) || 3))),
    images: cleanImages(body.images),
    roles: Array.isArray(body.roles) ? body.roles.map((role) => String(role).slice(0, 40)).slice(0, 6) : [],
    quality: ['economy', 'standard', 'premium', 'luxury'].includes(body.quality) ? body.quality : 'standard',
    priceSource: user.role === 'supplier' ? 'supplier' : 'admin',
    priceUpdatedAt: priceChanged ? new Date() : existing.priceUpdatedAt,
    illustrative: user.role === 'supplier' ? false : Boolean(body.illustrative),
    active: body.active !== false,
    seeded: existing?.seeded || false,
  };
}

function assertProductManager(product, user) {
  if (user.role === 'admin') return;
  if (user.role === 'supplier' && product.supplierId && String(product.supplierId) === String(user.id)) return;
  throw httpError(403, 'You can only manage products linked to your supplier account.');
}

async function presentCart(cart) {
  const ids = (cart?.items || []).map((item) => item.productId);
  const products = await MarketplaceProduct.find({ _id: { $in: ids }, active: true }).lean();
  const byId = new Map(products.map((product) => [String(product._id), product]));
  const items = (cart?.items || []).map((item) => {
    const product = byId.get(String(item.productId));
    if (!product) return null;
    return { product: presentProduct(product), quantity: item.quantity, lineTotal: Math.round(product.pricePkr * item.quantity) };
  }).filter(Boolean);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return { items, subtotal };
}

export function createMarketplaceRouter({ Router, requireUser, requireAdmin, requireDatabase }) {
  const router = Router();
  const requireSupplier = (req, res, next) => requireUser(req, res, (error) => {
    if (error) return next(error);
    if (!['admin', 'supplier'].includes(req.user.role)) return next(httpError(403, 'Supplier or administrator access is required.'));
    return next();
  });

  router.get('/categories', requireDatabase, async (_req, res, next) => {
    try {
      const categories = await ProductCategory.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean();
      res.json({ ok: true, categories });
    } catch (error) {
      next(error);
    }
  });

  router.post('/categories', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const name = String(req.body?.name || '').trim();
      if (name.length < 2) throw httpError(400, 'Enter a category name.');
      const category = await ProductCategory.create({
        name,
        slug: slugify(req.body?.slug || name),
        description: String(req.body?.description || '').trim().slice(0, 400),
        sortOrder: Number(req.body?.sortOrder) || 0,
        active: true,
      });
      res.status(201).json({ ok: true, category });
    } catch (error) {
      next(error);
    }
  });

  router.put('/categories/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const name = String(req.body?.name || '').trim();
      if (name.length < 2) throw httpError(400, 'Enter a category name.');
      const category = await ProductCategory.findById(req.params.id);
      if (!category) throw httpError(404, 'Category was not found.');
      const previous = category.slug;
      category.name = name;
      category.slug = slugify(req.body?.slug || name);
      category.description = String(req.body?.description || '').trim().slice(0, 400);
      category.sortOrder = Number(req.body?.sortOrder) || 0;
      category.active = req.body?.active !== false;
      await category.save();
      if (previous !== category.slug) await MarketplaceProduct.updateMany({ categorySlug: previous }, { categorySlug: category.slug });
      res.json({ ok: true, category });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/categories/:id', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const category = await ProductCategory.findById(req.params.id);
      if (!category) throw httpError(404, 'Category was not found.');
      const used = await MarketplaceProduct.countDocuments({ categorySlug: category.slug });
      if (used) throw httpError(409, 'Move or remove the products in this category before deleting it.');
      await category.deleteOne();
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get('/products', requireDatabase, async (req, res, next) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const filter = { active: true };
      if (req.query.category && req.query.category !== 'All') filter.categorySlug = slugify(req.query.category);
      if (req.query.brand) filter.brand = String(req.query.brand).slice(0, 80);
      if (req.query.quality) filter.quality = String(req.query.quality);
      const regex = containsRegex(req.query.q);
      if (regex) {
        const matchedCategories = await ProductCategory.find({ $or: [{ name: regex }, { slug: regex }] }).select('slug').lean();
        filter.$or = [
          { name: regex },
          { brand: regex },
          { sku: regex },
          { description: regex },
          { supplierName: regex },
          { roles: regex },
          { categorySlug: regex },
          { 'specifications.value': regex },
          { 'specifications.label': regex },
        ];
        if (matchedCategories.length) filter.$or.push({ categorySlug: { $in: matchedCategories.map((category) => category.slug) } });
      }
      if (req.query.ids) {
        const ids = String(req.query.ids).split(',').map((id) => id.trim()).filter(Boolean).slice(0, 4);
        filter._id = { $in: ids };
      }
      const minPrice = Number(req.query.minPrice);
      const maxPrice = Number(req.query.maxPrice);
      if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
        filter.pricePkr = {};
        if (Number.isFinite(minPrice)) filter.pricePkr.$gte = minPrice;
        if (Number.isFinite(maxPrice)) filter.pricePkr.$lte = maxPrice;
      }
      const sort = req.query.sort === 'price-asc' ? { pricePkr: 1 } : req.query.sort === 'price-desc' ? { pricePkr: -1 } : req.query.sort === 'updated' ? { priceUpdatedAt: -1 } : { name: 1 };
      const [products, total, brands] = await Promise.all([
        MarketplaceProduct.find(filter).sort(sort).skip(skip).limit(limit).lean(),
        MarketplaceProduct.countDocuments(filter),
        MarketplaceProduct.distinct('brand', { active: true, ...(filter.categorySlug ? { categorySlug: filter.categorySlug } : {}) }),
      ]);
      res.json({
        ok: true,
        products: products.map(presentProduct),
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
        brands: brands.filter(Boolean).sort(),
        priceNotice: PRICE_NOTICE,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/products/:slug', requireDatabase, async (req, res, next) => {
    try {
      const product = await MarketplaceProduct.findOne({ slug: req.params.slug, active: true }).lean();
      if (!product) throw httpError(404, 'Product was not found.');
      const related = await MarketplaceProduct.find({ active: true, categorySlug: product.categorySlug, _id: { $ne: product._id } }).limit(4).lean();
      res.json({ ok: true, product: presentProduct(product), related: related.map(presentProduct), priceNotice: PRICE_NOTICE });
    } catch (error) {
      next(error);
    }
  });

  router.post('/products', requireSupplier, requireDatabase, async (req, res, next) => {
    try {
      const payload = cleanProduct(req.body || {}, req.user, null);
      const category = await ProductCategory.findOne({ slug: payload.categorySlug, active: true });
      if (!category) throw httpError(400, 'That category is not available.');
      payload.categoryId = category._id;
      if (await MarketplaceProduct.exists({ slug: payload.slug })) payload.slug = `${payload.slug}-${payload.sku.toLowerCase()}`;
      const product = await MarketplaceProduct.create(payload);
      await recordAudit(req, 'marketplace.product.create', 'MarketplaceProduct', product._id);
      res.status(201).json({ ok: true, product: presentProduct(product.toObject()) });
    } catch (error) {
      next(error);
    }
  });

  router.put('/products/:id', requireSupplier, requireDatabase, async (req, res, next) => {
    try {
      const existing = await MarketplaceProduct.findById(req.params.id);
      if (!existing) throw httpError(404, 'Product was not found.');
      assertProductManager(existing, req.user);
      const payload = cleanProduct(req.body || {}, req.user, existing);
      const category = await ProductCategory.findOne({ slug: payload.categorySlug });
      if (!category) throw httpError(400, 'That category is not available.');
      payload.categoryId = category._id;
      payload.slug = existing.slug;
      Object.assign(existing, payload);
      await existing.save();
      await recordAudit(req, 'marketplace.product.update', 'MarketplaceProduct', existing._id, { pricePkr: existing.pricePkr });
      res.json({ ok: true, product: presentProduct(existing.toObject()) });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/products/:id', requireSupplier, requireDatabase, async (req, res, next) => {
    try {
      const product = await MarketplaceProduct.findById(req.params.id);
      if (!product) throw httpError(404, 'Product was not found.');
      assertProductManager(product, req.user);
      const ordered = await Order.exists({ 'items.productId': product._id });
      if (ordered) {
        product.active = false;
        await product.save();
        res.json({ ok: true, removed: false, product: presentProduct(product.toObject()), message: 'The product is hidden because it appears on existing orders.' });
        return;
      }
      await product.deleteOne();
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get('/supplier/products', requireSupplier, requireDatabase, async (req, res, next) => {
    try {
      const filter = req.user.role === 'admin' ? {} : { supplierId: req.user.id };
      const products = await MarketplaceProduct.find(filter).sort({ updatedAt: -1 }).limit(100).lean();
      res.json({ ok: true, products: products.map(presentProduct) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/calculate', requireDatabase, async (req, res, next) => {
    try {
      const result = runQuantityCalculator(req.body?.calculator, req.body?.input || {});
      if (!result.ok) throw httpError(400, result.error);
      const products = await MarketplaceProduct.find({ active: true, stock: { $gt: 0 } }).lean();
      const lines = priceMaterialLines(result.lines, products, req.body?.input?.quality || 'standard');
      const materialCost = lines.reduce((sum, line) => sum + line.lineTotal, 0);
      res.json({ ok: true, ...result, lines, materialCost, priceNotice: PRICE_NOTICE });
    } catch (error) {
      next(error);
    }
  });

  router.get('/meta', requireDatabase, async (_req, res, next) => {
    try {
      const settings = await commerceSettings();
      res.json({
        ok: true,
        priceNotice: PRICE_NOTICE,
        cancellationRules: CANCELLATION_RULES,
        units: PRODUCT_UNITS,
        settings: {
          deliveryBasePkr: settings.deliveryBasePkr,
          deliveryPerKmPkr: settings.deliveryPerKmPkr,
          freeDeliveryOver: settings.freeDeliveryOver,
          taxPercent: settings.taxPercent,
          taxLabel: settings.taxLabel,
          cityDistancesKm: settings.cityDistancesKm,
        },
        calculators: QUANTITY_CALCULATORS.map(({ id, title, text, fields }) => ({ id, title, text, fields })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/cart', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const cart = await Cart.findOne({ ownerId: req.user.id }).lean();
      res.json({ ok: true, ...(await presentCart(cart)), priceNotice: PRICE_NOTICE });
    } catch (error) {
      next(error);
    }
  });

  router.post('/cart/items', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const quantity = Math.round(Number(req.body?.quantity) || 1);
      const product = await MarketplaceProduct.findOne({ _id: req.body?.productId, active: true });
      if (!product) throw httpError(404, 'Product was not found.');
      if (quantity < 1 || quantity > 100000) throw httpError(400, 'Enter a valid quantity.');
      const cart = await Cart.findOne({ ownerId: req.user.id }) || new Cart({ ownerId: req.user.id, items: [] });
      const current = cart.items.find((item) => String(item.productId) === String(product._id));
      const nextQuantity = (current?.quantity || 0) + quantity;
      if (nextQuantity > product.stock) throw httpError(409, `Only ${product.stock} ${product.unit} of ${product.name} are in stock.`);
      if (current) current.quantity = nextQuantity;
      else cart.items.push({ productId: product._id, quantity });
      await cart.save();
      res.json({ ok: true, ...(await presentCart(cart)) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/cart/merge', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const incoming = Array.isArray(req.body?.items) ? req.body.items.slice(0, 40) : [];
      const cart = await Cart.findOne({ ownerId: req.user.id }) || new Cart({ ownerId: req.user.id, items: [] });
      for (const item of incoming) {
        const product = await MarketplaceProduct.findOne({ _id: item.productId, active: true });
        if (!product) continue;
        const quantity = Math.min(product.stock, Math.max(1, Math.round(Number(item.quantity) || 1)));
        if (quantity < 1) continue;
        const current = cart.items.find((line) => String(line.productId) === String(product._id));
        if (current) current.quantity = Math.min(product.stock, current.quantity + quantity);
        else cart.items.push({ productId: product._id, quantity });
      }
      await cart.save();
      res.json({ ok: true, ...(await presentCart(cart)) });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/cart/items/:productId', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const quantity = Math.round(Number(req.body?.quantity));
      const cart = await Cart.findOne({ ownerId: req.user.id });
      if (!cart) throw httpError(404, 'Your cart is empty.');
      const line = cart.items.find((item) => String(item.productId) === req.params.productId);
      if (!line) throw httpError(404, 'That product is not in your cart.');
      if (quantity <= 0) cart.items = cart.items.filter((item) => String(item.productId) !== req.params.productId);
      else {
        const product = await MarketplaceProduct.findById(req.params.productId);
        if (!product || quantity > product.stock) throw httpError(409, 'That quantity is no longer in stock.');
        line.quantity = quantity;
      }
      await cart.save();
      res.json({ ok: true, ...(await presentCart(cart)) });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/cart/items/:productId', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const cart = await Cart.findOne({ ownerId: req.user.id });
      if (cart) {
        cart.items = cart.items.filter((item) => String(item.productId) !== req.params.productId);
        await cart.save();
      }
      res.json({ ok: true, ...(await presentCart(cart)) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/checkout', requireUser, requireDatabase, async (req, res, next) => {
    const decremented = [];
    try {
      const cart = await Cart.findOne({ ownerId: req.user.id });
      if (!cart?.items?.length) throw httpError(400, 'Your cart is empty.');
      const address = req.body?.address || {};
      const name = String(address.name || '').trim();
      const phone = String(address.phone || '').trim();
      const line1 = String(address.line1 || '').trim();
      const city = String(address.city || '').trim();
      const instructions = String(address.instructions || '').trim().slice(0, 500);
      const details = [];
      if (name.length < 2) details.push('Enter the contact name.');
      if (!/^[0-9+\-\s]{7,20}$/.test(phone)) details.push('Enter a contact phone number.');
      if (line1.length < 5) details.push('Enter the delivery address.');
      if (city.length < 2) details.push('Enter the delivery city.');
      if (details.length) throw httpError(400, 'Check the delivery details.', details);

      const items = [];
      for (const line of cart.items) {
        const product = await MarketplaceProduct.findOneAndUpdate(
          { _id: line.productId, active: true, stock: { $gte: line.quantity } },
          { $inc: { stock: -line.quantity } },
          { new: false },
        );
        if (!product) throw httpError(409, 'A cart item is out of stock or no longer available. Refresh the cart and try again.');
        decremented.push({ productId: product._id, quantity: line.quantity });
        items.push({
          productId: product._id,
          name: product.name,
          brand: product.brand,
          unit: product.unit,
          quantity: line.quantity,
          unitPrice: product.pricePkr,
          lineTotal: Math.round(product.pricePkr * line.quantity),
          supplierId: product.supplierId,
          supplierName: product.supplierName,
        });
      }
      const settings = await commerceSettings();
      const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      const distanceKm = Number(req.body?.distanceKm);
      const totals = orderTotals({ subtotal, distanceKm: Number.isFinite(distanceKm) ? distanceKm : settings.cityDistancesKm?.[city], settings });
      const order = await Order.create({
        orderNumber: `BR-${Date.now().toString(36).toUpperCase()}`,
        ownerId: req.user.id,
        items,
        subtotal: totals.subtotal,
        deliveryCharge: totals.delivery,
        tax: totals.tax,
        total: totals.total,
        distanceKm: Number.isFinite(distanceKm) ? distanceKm : settings.cityDistancesKm?.[city] || settings.defaultDistanceKm,
        address: { name, phone, line1, city, instructions },
        status: 'Pending',
        statusHistory: [{ status: 'Pending', note: 'Order placed. Prices were taken from the catalog at checkout.', at: new Date(), by: req.user.email }],
        priceNotice: PRICE_NOTICE,
      });
      cart.items = [];
      await cart.save();
      await recordAudit(req, 'marketplace.order.create', 'Order', order._id, { total: order.total });
      res.status(201).json({ ok: true, order, cancellationRules: CANCELLATION_RULES, priceNotice: PRICE_NOTICE });
    } catch (error) {
      for (const item of decremented) {
        await MarketplaceProduct.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } }).catch(() => {});
      }
      next(error);
    }
  });

  router.get('/orders', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const filter = req.user.role === 'admin' ? {} : req.user.role === 'supplier' ? { 'items.supplierId': req.user.id } : { ownerId: req.user.id };
      const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(50).lean();
      const visible = orders.map((order) => req.user.role === 'supplier'
        ? { ...order, items: order.items.filter((item) => String(item.supplierId || '') === String(req.user.id)) }
        : order);
      res.json({ ok: true, orders: visible, cancellationRules: CANCELLATION_RULES });
    } catch (error) {
      next(error);
    }
  });

  router.get('/orders/:id', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.id).lean();
      if (!order) throw httpError(404, 'Order was not found.');
      const supplierOwnsLine = req.user.role === 'supplier' && order.items.some((item) => String(item.supplierId || '') === String(req.user.id));
      if (!supplierOwnsLine) assertOwner(order, req.user);
      res.json({ ok: true, order, cancellationRules: CANCELLATION_RULES, priceNotice: order.priceNotice || PRICE_NOTICE });
    } catch (error) {
      next(error);
    }
  });

  router.get('/orders/:id/invoice', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.id);
      assertOwner(order, req.user);
      const pdf = await renderOrderInvoice(order.toObject());
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="buildright-invoice-${order.orderNumber}.pdf"`);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  });

  router.post('/orders/:id/cancel', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.id);
      assertOwner(order, req.user);
      if (req.user.role !== 'admin' && !canCustomerCancel(order.status)) {
        throw httpError(400, CANCELLATION_RULES);
      }
      if (!allowedStatusChange(order.status, 'Cancelled') && order.status !== 'Pending' && order.status !== 'Confirmed') {
        throw httpError(400, 'This order can no longer be cancelled.');
      }
      await cancelOrder(order, String(req.body?.reason || 'Cancelled by customer').slice(0, 240), req.user.email);
      await recordAudit(req, 'marketplace.order.cancel', 'Order', order._id);
      res.json({ ok: true, order });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/orders/:id/status', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const order = await Order.findById(req.params.id);
      if (!order) throw httpError(404, 'Order was not found.');
      const status = String(req.body?.status || '');
      if (!allowedStatusChange(order.status, status)) throw httpError(400, `Move the order one step forward from ${order.status}, or cancel it.`);
      if (status === 'Cancelled') await cancelOrder(order, String(req.body?.note || 'Cancelled by administrator').slice(0, 240), req.user.email);
      else {
        order.status = status;
        order.statusHistory.push({ status, note: String(req.body?.note || '').slice(0, 240), at: new Date(), by: req.user.email });
        await order.save();
      }
      await recordAudit(req, 'marketplace.order.status', 'Order', order._id, { status });
      res.json({ ok: true, order });
    } catch (error) {
      next(error);
    }
  });

  router.put('/settings', requireAdmin, requireDatabase, async (req, res, next) => {
    try {
      const current = await commerceSettings();
      const body = req.body || {};
      const value = {
        ...current,
        deliveryBasePkr: numberOr(body.deliveryBasePkr, current.deliveryBasePkr),
        deliveryPerKmPkr: numberOr(body.deliveryPerKmPkr, current.deliveryPerKmPkr),
        freeDeliveryOver: numberOr(body.freeDeliveryOver, current.freeDeliveryOver),
        taxPercent: numberOr(body.taxPercent, current.taxPercent),
        contingencyPercent: numberOr(body.contingencyPercent, current.contingencyPercent),
        taxLabel: String(body.taxLabel || current.taxLabel).slice(0, 160),
      };
      const settings = await SystemSetting.findOneAndUpdate({ key: 'commerce' }, { value }, { new: true, upsert: true });
      res.json({ ok: true, settings: settings.value });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

async function cancelOrder(order, reason, by) {
  if (restoresStock(order.status)) {
    for (const item of order.items) {
      await MarketplaceProduct.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } });
    }
  }
  order.status = 'Cancelled';
  order.cancellationReason = reason;
  order.statusHistory.push({ status: 'Cancelled', note: reason, at: new Date(), by });
  await order.save();
}
