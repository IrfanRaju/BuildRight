import mongoose from 'mongoose';
import { illustrativeRateBook, LOCATION_FACTORS, QUALITY_FACTORS, RATE_SOURCE } from '../../shared/rateBook.js';
import {
  BuildingTemplate,
  LaborRate,
  MarginRule,
  MaterialRate,
  QuantityRule,
  RegionalRate,
  SystemSetting,
} from '../models/index.js';

export async function loadRateBook(estimateInput = {}) {
  if (mongoose.connection.readyState !== 1) return illustrativeRateBook();
  const buildingType = String(estimateInput.projectType || estimateInput.buildingType || 'House');
  const [materials, labor, settings, regionalRows, marginRules, quantityRules, template] = await Promise.all([
    MaterialRate.find({}).sort({ category: 1, name: 1 }).lean(),
    LaborRate.find({}).lean(),
    SystemSetting.findOne({ key: 'rates' }).lean(),
    RegionalRate.find({ active: true }).lean(),
    MarginRule.find({ active: true }).sort({ priority: 1 }).lean(),
    QuantityRule.find({ active: true }).lean(),
    BuildingTemplate.findOne({ buildingType, active: true }).lean()
      || BuildingTemplate.findOne({ key: 'house-rcc', active: true }).lean(),
  ]);
  if (!materials.length) return illustrativeRateBook();

  const updatedAt = materials.reduce((latest, item) => {
    const stamp = new Date(item.lastPriceUpdate || item.updatedAt || item.effectiveFrom || 0).toISOString();
    return stamp > latest ? stamp : latest;
  }, '1970-01-01T00:00:00.000Z');

  const regionalRates = {};
  const locationFactors = { ...(settings?.value?.locationFactors || LOCATION_FACTORS) };
  for (const row of regionalRows) {
    regionalRates[row.city] = {
      multiplier: row.multiplier,
      transportAdjustment: row.transportAdjustment || 0,
      region: row.region || '',
    };
    locationFactors[row.city] = row.multiplier;
  }

  let quantityMultipliers = {};
  if (template?.quantityMultipliers) {
    quantityMultipliers = template.quantityMultipliers instanceof Map
      ? Object.fromEntries(template.quantityMultipliers)
      : { ...template.quantityMultipliers };
  }

  return {
    illustrative: materials.some((item) => item.illustrative !== false),
    source: settings?.value?.source || RATE_SOURCE,
    updatedAt,
    locationFactors,
    regionalRates,
    qualityFactors: settings?.value?.qualityFactors || QUALITY_FACTORS,
    materials,
    labor: labor.filter((item) => item.kind !== 'equipment'),
    equipment: labor.filter((item) => item.kind === 'equipment'),
    marginRules,
    quantityRules,
    buildingTemplate: template ? { ...template, quantityMultipliers } : null,
    defaults: settings?.value?.defaults || illustrativeRateBook().defaults,
  };
}
