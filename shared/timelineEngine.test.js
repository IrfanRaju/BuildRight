import test from 'node:test';
import assert from 'node:assert/strict';
import { predictTimeline } from './timelineEngine.js';

test('timeline includes foundation through finishing with optional overlap', () => {
  const result = predictTimeline({
    coveredAreaSqFt: 1800,
    floors: 2,
    category: 'turnkey',
    quality: 'standard',
    startDate: '2026-04-01',
  });
  assert.ok(result.totalMonths > 0);
  assert.equal(result.phases[0].key, 'foundation');
  assert.ok(result.phases.some((phase) => phase.key === 'finishing'));
  assert.equal(result.startDate, '2026-04-01');
  assert.ok(result.completionDate);
  assert.ok(result.phases.some((phase) => phase.overlapsPrevious));
});
