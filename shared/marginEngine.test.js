import test from 'node:test';
import assert from 'node:assert/strict';
import { projectSizeBand, resolveMarginPercent } from './marginEngine.js';

test('project size bands', () => {
  assert.equal(projectSizeBand(900), 'small');
  assert.equal(projectSizeBand(2000), 'medium');
  assert.equal(projectSizeBand(6000), 'large');
});

test('manual margin wins unless autoMargin is set', () => {
  const manual = resolveMarginPercent({ marginPercent: 7 }, [{ name: 'rule', marginPercent: 12, priority: 1, active: true }]);
  assert.equal(manual.marginPercent, 7);
  const auto = resolveMarginPercent(
    { autoMargin: true, projectType: 'House', quality: 'standard', coveredAreaSqFt: 1000, floors: 1 },
    [{ name: 'small', projectType: 'House', quality: '*', projectSize: 'small', minCoveredArea: 0, maxCoveredArea: 1500, marginPercent: 8, priority: 10, active: true }],
  );
  assert.equal(auto.marginPercent, 8);
  assert.match(auto.source, /small/);
});

test('lower priority number wins when multiple rules match', () => {
  const result = resolveMarginPercent(
    { autoMargin: true, projectType: 'House', quality: 'luxury', coveredAreaSqFt: 2000, floors: 2, projectSize: 'medium' },
    [
      { name: 'generic', projectType: '*', quality: '*', projectSize: 'any', marginPercent: 9, priority: 50, active: true },
      { name: 'luxury', projectType: '*', quality: 'luxury', projectSize: 'any', marginPercent: 14, priority: 5, active: true },
    ],
  );
  assert.equal(result.marginPercent, 14);
});
