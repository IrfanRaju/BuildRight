import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateRepairProject } from './repairEngine.js';

const products = [
  { _id: 'paint', name: 'Interior emulsion', brand: 'Sample', roles: ['interior-paint'], unit: 'liter', pricePkr: 1000, stock: 40, quality: 'standard', active: true },
  { _id: 'primer', name: 'Primer', brand: 'Sample', roles: ['primer'], unit: 'liter', pricePkr: 700, stock: 20, quality: 'standard', active: true },
  { _id: 'putty', name: 'Putty', brand: 'Sample', roles: ['putty'], unit: 'kg', pricePkr: 80, stock: 50, quality: 'standard', active: true },
  { _id: 'brush', name: 'Brush', brand: 'Sample', roles: ['brush'], unit: 'piece', pricePkr: 300, stock: 10, quality: 'standard', active: true },
  { _id: 'roller', name: 'Roller', brand: 'Sample', roles: ['roller'], unit: 'piece', pricePkr: 600, stock: 10, quality: 'standard', active: true },
  { _id: 'paper', name: 'Sandpaper', brand: 'Sample', roles: ['sandpaper'], unit: 'piece', pricePkr: 40, stock: 30, quality: 'standard', active: true },
  { _id: 'chem', name: 'Waterproofing', brand: 'Sample', roles: ['waterproofing'], unit: 'liter', pricePkr: 900, stock: 40, quality: 'standard', active: true },
  { _id: 'seal', name: 'Sealant', brand: 'Sample', roles: ['sealant'], unit: 'piece', pricePkr: 700, stock: 10, quality: 'standard', active: true },
];

test('house painting separates material cost from labor', () => {
  const result = estimateRepairProject({
    tasks: [{ serviceSlug: 'house-painting', wallAreaSqFt: 200, ceilingAreaSqFt: 80, coats: 2, quality: 'standard', condition: 'minor' }],
    products,
    distanceKm: 0,
    settings: { deliveryBasePkr: 0, deliveryPerKmPkr: 0, taxPercent: 0, contingencyPercent: 0, conditionFactors: { minor: 1, moderate: 1, major: 1 }, freeDeliveryOver: 0 },
  });
  assert.equal(result.ok, true);
  assert.ok(result.materialCost > 0);
  assert.ok(result.laborCost > 0);
  assert.equal(result.total, result.materialCost + result.laborCost + result.equipmentCost);
  assert.equal(result.laborSeparate, true);
  assert.match(result.disclaimer, /site conditions/);
});

test('roof repair prices waterproofing from the selected area', () => {
  const result = estimateRepairProject({
    tasks: [{ serviceSlug: 'roof-repair', roofAreaSqFt: 100, coats: 2, quality: 'standard', condition: 'moderate' }],
    products,
    distanceKm: 8,
    settings: { deliveryBasePkr: 500, deliveryPerKmPkr: 0, taxPercent: 10, contingencyPercent: 5, conditionFactors: { minor: 1, moderate: 1, major: 1 }, freeDeliveryOver: 0, defaultDistanceKm: 8 },
  });
  assert.equal(result.ok, true);
  assert.ok(result.tasks[0].materials.some((line) => line.role === 'waterproofing' && line.lineTotal > 0));
  assert.equal(result.delivery, 500);
  assert.ok(result.tax > 0);
  assert.ok(result.contingency > 0);
});
