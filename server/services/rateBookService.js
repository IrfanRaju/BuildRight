import mongoose from 'mongoose';
import { illustrativeRateBook, LOCATION_FACTORS, QUALITY_FACTORS, RATE_SOURCE } from '../../shared/rateBook.js';
import { LaborRate, MaterialRate, SystemSetting } from '../models/index.js';

export async function loadRateBook() {
  if (mongoose.connection.readyState !== 1) return illustrativeRateBook();
  const [materials, labor, settings] = await Promise.all([
    MaterialRate.find({}).sort({ category: 1, name: 1 }).lean(),
    LaborRate.find({}).lean(),
    SystemSetting.findOne({ key: 'rates' }).lean(),
  ]);
  if (!materials.length) return illustrativeRateBook();
  const updatedAt = materials.reduce((latest, item) => {
    const stamp = new Date(item.updatedAt || item.effectiveFrom || 0).toISOString();
    return stamp > latest ? stamp : latest;
  }, '1970-01-01T00:00:00.000Z');
  return {
    illustrative: materials.some((item) => item.illustrative !== false),
    source: settings?.value?.source || RATE_SOURCE,
    updatedAt,
    locationFactors: settings?.value?.locationFactors || LOCATION_FACTORS,
    qualityFactors: settings?.value?.qualityFactors || QUALITY_FACTORS,
    materials,
    labor: labor.filter((item) => item.kind !== 'equipment'),
    equipment: labor.filter((item) => item.kind === 'equipment'),
    defaults: settings?.value?.defaults || illustrativeRateBook().defaults,
  };
}
