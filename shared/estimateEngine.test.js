import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEstimate, toSquareFeet, MARLA_SQFT } from './estimateEngine.js';

const book = {
  illustrative: true,
  source: 'test',
  updatedAt: '2026-01-15T00:00:00.000Z',
  locationFactors: { Islamabad: 1, Lahore: 2 },
  qualityFactors: { economy: 1, standard: 1, premium: 1, luxury: 1 },
  materials: [
    { code: 'cement-grey', name: 'Cement', category: 'Binders', unit: 'bag', scope: 'grey', perSqFt: 1, rate: 10, quality: 'standard', location: 'Islamabad' },
    { code: 'tiles', name: 'Tiles', category: 'Finishing', unit: 'sq ft', scope: 'finishing', perSqFt: 1, rate: 5, quality: 'standard', location: 'Islamabad' },
  ],
  labor: [
    { scope: 'grey', quality: 'standard', location: 'Islamabad', ratePerSqFt: 2 },
    { scope: 'finishing', quality: 'standard', location: 'Islamabad', ratePerSqFt: 1 },
  ],
  equipment: [
    { scope: 'grey', quality: 'standard', location: 'Islamabad', ratePerSqFt: 1 },
    { scope: 'finishing', quality: 'standard', location: 'Islamabad', ratePerSqFt: 1 },
  ],
  defaults: { overheadPercent: 0, contingencyPercent: 0, marginPercent: 0, taxPercent: 0 },
};

const baseInput = {
  location: 'Islamabad',
  category: 'turnkey',
  quality: 'standard',
  plotArea: 2000,
  plotUnit: 'sq ft',
  coveredArea: 100,
  coveredUnit: 'sq ft',
  floors: 1,
  overheadPercent: 10,
  contingencyPercent: 10,
  marginPercent: 10,
  taxPercent: 10,
  inflationPercent: 0,
};

test('converts marla and kanal using documented factors', () => {
  assert.equal(toSquareFeet(10, 'marla'), 10 * MARLA_SQFT);
  assert.equal(toSquareFeet(1, 'kanal'), 20 * MARLA_SQFT);
});

test('does not apply margin, contingency, or tax to each other', () => {
  const result = calculateEstimate(baseInput, book);
  assert.equal(result.materialCost, 1500);
  assert.equal(result.laborCost, 300);
  assert.equal(result.equipmentCost, 200);
  const direct = 2000;
  assert.equal(result.overhead, 200);
  assert.equal(result.contractorMargin, 220);
  assert.equal(result.contingency, 220);
  assert.equal(result.tax, 242);
  assert.equal(result.total, direct + 200 + 220 + 220 + 242);
});

test('grey estimates exclude finishing quantities and costs', () => {
  const result = calculateEstimate({ ...baseInput, category: 'grey', overheadPercent: 0, contingencyPercent: 0, marginPercent: 0, taxPercent: 0 }, book);
  assert.equal(result.lines.some((line) => line.scope === 'finishing'), false);
  assert.equal(result.finishing, null);
  assert.equal(result.materialCost, 1000);
  assert.ok(result.grey);
});

test('location factor changes the rate once', () => {
  const islamabad = calculateEstimate({ ...baseInput, overheadPercent: 0, contingencyPercent: 0, marginPercent: 0, taxPercent: 0 }, book);
  const lahore = calculateEstimate({ ...baseInput, location: 'Lahore', overheadPercent: 0, contingencyPercent: 0, marginPercent: 0, taxPercent: 0 }, book);
  assert.equal(lahore.materialCost, islamabad.materialCost * 2);
});

test('manual labor replaces calculated labor instead of stacking', () => {
  const result = calculateEstimate({ ...baseInput, category: 'finishing', laborOverride: 50, overheadPercent: 0, contingencyPercent: 0, marginPercent: 0, taxPercent: 0 }, book);
  assert.equal(result.laborCost, 50);
  assert.equal(result.materialCost, 500);
});

test('rejects covered area that far exceeds the plot', () => {
  assert.throws(() => calculateEstimate({ ...baseInput, plotArea: 100, coveredArea: 200 }, book), /Covered area/);
});
