import test from 'node:test';
import assert from 'node:assert/strict';
import { paintMaterials, plasterMaterials, plumbingMaterials, tileMaterials, waterproofingMaterials } from './quantityEngine.js';
import { allowedStatusChange, canCustomerCancel, orderTotals } from './commerce.js';

test('12mm 1:4 plaster for 100 sq ft estimates cement and sand', () => {
  const result = plasterMaterials({ areaSqFt: 100, thicknessMm: 12, mixCement: 1, mixSand: 4, wastage: 0 });
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.lines[0].quantity - 0.85) < 0.02);
  assert.ok(Math.abs(result.lines[1].quantity - 4.19) < 0.05);
  assert.equal(result.estimate, true);
});

test('paint estimate uses coats, coverage, and wastage', () => {
  const result = paintMaterials({ wallAreaSqFt: 200, coats: 2, quality: 'standard', surface: 'interior', wastage: 0.1, condition: 'minor' });
  assert.equal(result.ok, true);
  const paint = result.lines.find((line) => line.role === 'interior-paint');
  assert.ok(Math.abs(paint.quantity - 5.18) < 0.05);
});

test('tile estimate adds wastage and adhesive', () => {
  const result = tileMaterials({ floorAreaSqFt: 120, tileLengthIn: 24, tileWidthIn: 24, wastage: 0.1 });
  assert.equal(result.lines.find((line) => line.role === 'tile').quantity, 33);
  assert.ok(result.lines.find((line) => line.role === 'adhesive').quantity > 40);
});

test('plumbing and waterproofing need dimensions', () => {
  assert.equal(plumbingMaterials({}).ok, false);
  const pipes = plumbingMaterials({ pipeLengthM: 20, fittings: 8, wastage: 0.1 });
  assert.equal(pipes.lines.find((line) => line.role === 'pipe').quantity, 22);
  const roof = waterproofingMaterials({ roofAreaSqFt: 200, coats: 2, wastage: 0 });
  assert.ok(Math.abs(roof.lines[0].quantity - 33.33) < 0.05);
});

test('order totals and cancellation rules stay explicit', () => {
  const totals = orderTotals({ subtotal: 10000, distanceKm: 8, settings: { deliveryBasePkr: 800, deliveryPerKmPkr: 25, taxPercent: 18, freeDeliveryOver: 75000 } });
  assert.equal(totals.delivery, 1000);
  assert.equal(totals.tax, 1800);
  assert.equal(totals.total, 12800);
  assert.equal(canCustomerCancel('Pending'), true);
  assert.equal(canCustomerCancel('Processing'), false);
  assert.equal(allowedStatusChange('Pending', 'Confirmed'), true);
  assert.equal(allowedStatusChange('Pending', 'Delivered'), false);
  assert.equal(allowedStatusChange('Confirmed', 'Cancelled'), true);
});
