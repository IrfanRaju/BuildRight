import { DEFAULT_COMMERCE, REPAIR_DISCLAIMER, deliveryCharge, moneyRound } from './commerce.js';
import { DEFAULT_LABOR_RULES, REPAIR_SERVICES } from './repairCatalog.js';
import { paintMaterials, plasterMaterials, plumbingMaterials, tileMaterials, waterproofingMaterials } from './quantityEngine.js';

const QUALITIES = ['economy', 'standard', 'premium', 'luxury'];

function combineLines(groups) {
  const map = new Map();
  for (const line of groups) {
    const key = `${line.role}|${line.unit}|${line.name}`;
    const current = map.get(key);
    if (!current) map.set(key, { ...line });
    else {
      current.netQuantity = roundSum(current.netQuantity, line.netQuantity);
      current.wastageQuantity = roundSum(current.wastageQuantity, line.wastageQuantity);
      current.quantity = line.unit === 'piece' ? current.quantity + line.quantity : roundSum(current.quantity, line.quantity);
    }
  }
  return [...map.values()];
}

function roundSum(left, right) {
  return Math.round((Number(left) + Number(right)) * 100) / 100;
}

function planMaterials(calculator, input) {
  if (calculator === 'paint') return paintMaterials({ ...input, surface: input.exteriorWallSqFt && !input.wallAreaSqFt && !input.ceilingAreaSqFt ? 'exterior' : input.exteriorWallSqFt ? 'both' : 'interior' });
  if (calculator === 'plaster') return plasterMaterials(input);
  if (calculator === 'waterproofing') return waterproofingMaterials(input);
  if (calculator === 'tiles') return tileMaterials(input);
  if (calculator === 'plumbing') return plumbingMaterials(input);
  if (calculator === 'bathroom') {
    const tiles = tileMaterials(input);
    const waterproof = waterproofingMaterials({ roofAreaSqFt: input.floorAreaSqFt, coats: input.coats });
    const taps = plumbingMaterials({ taps: input.taps });
    const groups = [tiles, waterproof, taps].filter((item) => item.ok);
    if (!groups.length) return { ok: false, error: 'Enter a bathroom area or the number of taps.' };
    return { ok: true, lines: combineLines(groups.flatMap((item) => item.lines)), laborQuantity: tiles.ok ? tiles.laborQuantity : Math.max(1, Number(input.taps) || 1), laborUnit: 'sq ft', coatFactor: 1, summary: { floorAreaSqFt: input.floorAreaSqFt || 0 } };
  }
  if (calculator === 'kitchen') {
    const lines = [];
    if (Number(input.paintAreaSqFt) > 0) {
      const paint = paintMaterials({ wallAreaSqFt: input.paintAreaSqFt, coats: input.coats || 2, quality: input.quality, condition: input.condition });
      if (paint.ok) lines.push(...paint.lines);
    }
    const cabinets = Math.max(0, Math.round(Number(input.cabinetCount) || 0));
    if (cabinets > 0) lines.push({ role: 'plywood', name: 'Repair panels', netQuantity: Math.ceil(cabinets / 2), wastageQuantity: 0, quantity: Math.ceil(cabinets / 2), unit: 'piece' });
    if (Number(input.counterSqFt) > 0) lines.push({ role: 'countertop', name: 'Countertop', netQuantity: Number(input.counterSqFt), wastageQuantity: 0, quantity: Math.round(Number(input.counterSqFt) * 100) / 100, unit: 'sq ft' });
    if (!lines.length) return { ok: false, error: 'Enter cabinets, a paint area, or a countertop area.' };
    return { ok: true, lines, laborQuantity: Math.max(1, cabinets), laborUnit: 'cabinet', coatFactor: 1, summary: { cabinets } };
  }
  if (calculator === 'electrical') {
    const points = Math.max(0, Math.round(Number(input.points) || 0));
    if (points <= 0) return { ok: false, error: 'Enter the number of switches, sockets, or lights.' };
    return {
      ok: true,
      lines: [
        { role: 'switch', name: 'Switches', netQuantity: points, wastageQuantity: 0, quantity: points, unit: 'piece' },
        { role: 'socket', name: 'Sockets', netQuantity: Math.ceil(points / 2), wastageQuantity: 0, quantity: Math.ceil(points / 2), unit: 'piece' },
        { role: 'wire', name: 'Wire', netQuantity: points * 8, wastageQuantity: Math.round(points * 8 * 0.1 * 100) / 100, quantity: Math.round(points * 8 * 1.1 * 100) / 100, unit: 'meter' },
      ],
      laborQuantity: points,
      laborUnit: 'point',
      coatFactor: 1,
      summary: { points },
    };
  }
  if (calculator === 'openings') {
    const doors = Math.max(0, Math.round(Number(input.doors) || 0));
    const windows = Math.max(0, Math.round(Number(input.windows) || 0));
    if (doors + windows <= 0) return { ok: false, error: 'Enter the number of doors or windows.' };
    return {
      ok: true,
      lines: [
        { role: 'lock', name: 'Locks', netQuantity: Math.max(doors, 0), wastageQuantity: 0, quantity: doors, unit: 'piece' },
        { role: 'hinge', name: 'Hinges', netQuantity: (doors + windows) * 2, wastageQuantity: 0, quantity: (doors + windows) * 2, unit: 'piece' },
      ].filter((line) => line.quantity > 0),
      laborQuantity: doors + windows,
      laborUnit: 'opening',
      coatFactor: 1,
      summary: { doors, windows },
    };
  }
  if (calculator === 'ceiling') return plasterMaterials({ areaSqFt: input.areaSqFt, thicknessMm: 12 });
  if (calculator === 'exterior') {
    const paint = paintMaterials({ exteriorWallSqFt: input.exteriorWallSqFt, coats: input.coats || 2, surface: 'exterior', quality: input.quality, condition: input.condition });
    if (!paint.ok) return paint;
    if (input.condition === 'major') {
      const plaster = plasterMaterials({ areaSqFt: Number(input.exteriorWallSqFt) * 0.3 });
      if (plaster.ok) paint.lines.push(...plaster.lines);
    }
    return paint;
  }
  if (calculator === 'general') {
    const tasks = Math.max(1, Math.round(Number(input.taskCount) || 1));
    const lines = [
      { role: 'brush', name: 'Paint brushes', netQuantity: 1, wastageQuantity: 0, quantity: 1, unit: 'piece' },
      { role: 'putty', name: 'Wall putty', netQuantity: 2, wastageQuantity: 0, quantity: 2, unit: 'kg' },
    ];
    return { ok: true, lines, laborQuantity: tasks, laborUnit: 'task', coatFactor: 1, summary: { tasks } };
  }
  return { ok: false, error: 'This repair service does not have a calculator yet.' };
}

export function priceMaterialLines(lines, products, preferredQuality = 'standard') {
  return lines.map((line) => {
    const options = (products || []).filter((product) => product.active !== false && product.unit === line.unit && (product.roles || []).includes(line.role) && product.stock > 0);
    const preferred = options.find((product) => product.quality === preferredQuality) || options.find((product) => product.quality === 'standard') || options[0] || null;
    const unitPrice = preferred ? Number(preferred.pricePkr) || 0 : 0;
    const quantity = Number(line.quantity) || 0;
    return {
      ...line,
      quantity,
      productId: preferred?._id ? String(preferred._id) : '',
      productName: preferred?.name || '',
      brand: preferred?.brand || '',
      unitPrice,
      lineTotal: moneyRound(quantity * unitPrice),
      priceUpdatedAt: preferred?.priceUpdatedAt || preferred?.updatedAt || null,
      unmatched: !preferred,
      options: options.slice(0, 8).map((product) => ({
        _id: String(product._id),
        name: product.name,
        brand: product.brand,
        pricePkr: product.pricePkr,
        unit: product.unit,
        stock: product.stock,
        quality: product.quality,
        priceUpdatedAt: product.priceUpdatedAt || product.updatedAt,
      })),
    };
  });
}

function rateFor(table, quality) {
  if (!table) return 0;
  return Number(table[quality] ?? table.standard ?? 0) || 0;
}

export function estimateRepairTask({ service, input = {}, rule, products = [], settings = DEFAULT_COMMERCE }) {
  const selected = service || REPAIR_SERVICES.find((item) => item.slug === input.serviceSlug);
  if (!selected) return { ok: false, error: 'Choose a repair service.' };
  const quality = QUALITIES.includes(input.quality) ? input.quality : 'standard';
  const condition = ['minor', 'moderate', 'major'].includes(input.condition) ? input.condition : 'moderate';
  const plan = planMaterials(selected.calculator, { ...input, quality, condition });
  if (!plan.ok) return plan;
  const materials = priceMaterialLines(plan.lines, products, quality);
  const materialCost = materials.reduce((sum, line) => sum + line.lineTotal, 0);
  const pricing = rule || DEFAULT_LABOR_RULES[selected.slug] || { labor: {}, equipment: {} };
  const factor = Number(settings.conditionFactors?.[condition] ?? DEFAULT_COMMERCE.conditionFactors[condition] ?? 1);
  const coatFactor = Number(plan.coatFactor) > 0 ? Number(plan.coatFactor) : 1;
  const laborCost = moneyRound(plan.laborQuantity * rateFor(pricing.labor, quality) * factor * coatFactor);
  const equipmentCost = moneyRound(plan.laborQuantity * rateFor(pricing.equipment, quality));
  return {
    ok: true,
    estimate: true,
    serviceSlug: selected.slug,
    title: selected.title,
    quality,
    condition,
    summary: plan.summary,
    laborQuantity: plan.laborQuantity,
    laborUnit: pricing.laborUnit || plan.laborUnit,
    materials,
    materialCost,
    laborCost,
    equipmentCost,
    unmatched: materials.filter((line) => line.unmatched).map((line) => line.name),
  };
}

export function estimateRepairProject({ tasks = [], products = [], rules = {}, settings = DEFAULT_COMMERCE, distanceKm, services }) {
  const catalog = services?.length ? services : REPAIR_SERVICES;
  const estimated = [];
  for (const task of tasks) {
    const service = catalog.find((item) => item.slug === task.serviceSlug);
    const result = estimateRepairTask({ service, input: task, rule: rules[task.serviceSlug], products, settings });
    if (!result.ok) return result;
    estimated.push(result);
  }
  if (!estimated.length) return { ok: false, error: 'Select at least one repair task.' };
  const materialCost = estimated.reduce((sum, task) => sum + task.materialCost, 0);
  const laborCost = estimated.reduce((sum, task) => sum + task.laborCost, 0);
  const equipmentCost = estimated.reduce((sum, task) => sum + task.equipmentCost, 0);
  const delivery = deliveryCharge(materialCost, distanceKm, settings);
  const taxable = materialCost + equipmentCost + delivery;
  const tax = moneyRound(taxable * ((Number(settings.taxPercent) || 0) / 100));
  const beforeContingency = materialCost + laborCost + equipmentCost + delivery + tax;
  const contingency = moneyRound(beforeContingency * ((Number(settings.contingencyPercent) || 0) / 100));
  const materials = combinePriced(estimated.flatMap((task) => task.materials));
  return {
    ok: true,
    estimate: true,
    disclaimer: REPAIR_DISCLAIMER,
    tasks: estimated,
    materials,
    materialCost,
    laborCost,
    equipmentCost,
    delivery,
    tax,
    taxLabel: settings.taxLabel || DEFAULT_COMMERCE.taxLabel,
    contingency,
    contingencyPercent: Number(settings.contingencyPercent) || 0,
    total: beforeContingency + contingency,
    purchaseTotal: materialCost + delivery + moneyRound((materialCost + delivery) * ((Number(settings.taxPercent) || 0) / 100)),
    laborSeparate: true,
  };
}

export function retotalRepair(estimate, settings = DEFAULT_COMMERCE, distanceKm) {
  const materialCost = (estimate.materials || []).reduce((sum, line) => sum + moneyRound((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)), 0);
  const materials = (estimate.materials || []).map((line) => ({ ...line, lineTotal: moneyRound((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)) }));
  const laborCost = moneyRound(estimate.laborCost);
  const equipmentCost = moneyRound(estimate.equipmentCost);
  const delivery = deliveryCharge(materialCost, distanceKm, settings);
  const taxable = materialCost + equipmentCost + delivery;
  const tax = moneyRound(taxable * ((Number(settings.taxPercent) || 0) / 100));
  const beforeContingency = materialCost + laborCost + equipmentCost + delivery + tax;
  const contingency = moneyRound(beforeContingency * ((Number(settings.contingencyPercent) || 0) / 100));
  return {
    ...estimate,
    materials,
    materialCost,
    laborCost,
    equipmentCost,
    delivery,
    tax,
    contingency,
    total: beforeContingency + contingency,
    purchaseTotal: materialCost + delivery + moneyRound((materialCost + delivery) * ((Number(settings.taxPercent) || 0) / 100)),
  };
}

function combinePriced(lines) {
  const map = new Map();
  for (const line of lines) {
    const key = line.productId || `${line.role}|${line.name}|${line.unit}`;
    const current = map.get(key);
    if (!current) map.set(key, { ...line, options: line.options || [] });
    else {
      current.quantity = roundSum(current.quantity, line.quantity);
      current.netQuantity = roundSum(current.netQuantity, line.netQuantity);
      current.wastageQuantity = roundSum(current.wastageQuantity, line.wastageQuantity);
      current.lineTotal = moneyRound(current.quantity * current.unitPrice);
    }
  }
  return [...map.values()];
}
