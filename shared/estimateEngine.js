import { illustrativeRateBook } from './rateBook.js';

export const MARLA_SQFT = 272.25;
export const KANAL_SQFT = MARLA_SQFT * 20;

const CATEGORY_SCOPE = {
  grey: { grey: true, finishing: false },
  finishing: { grey: false, finishing: true },
  turnkey: { grey: true, finishing: true },
};

export function toSquareFeet(area, unit) {
  const value = Number(area);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Area must be a positive number.');
  }
  const key = String(unit || 'sq ft').toLowerCase().replace(/[^a-z]/g, '');
  if (key === 'sqft' || key === 'squarefeet' || key === 'ft') return value;
  if (key === 'marla') return value * MARLA_SQFT;
  if (key === 'kanal') return value * KANAL_SQFT;
  if (key === 'sqm' || key === 'squaremeters' || key === 'm') return value * 10.7639;
  throw new Error('Use sq ft, marla, kanal, or sq m for area units.');
}

function money(value) {
  return Math.round(Number(value) || 0);
}

function quantityFor(value, unit) {
  if (unit === 'bag' || unit === 'nos') return Math.ceil(value);
  return Math.round(value * 100) / 100;
}

function percent(value, fallback) {
  const number = value === undefined || value === '' || value === null ? fallback : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 40) {
    throw new Error('Overhead, margin, contingency, and tax must each be between 0 and 40 percent.');
  }
  return number / 100;
}

function normalizeQuality(quality) {
  const key = String(quality || 'standard').toLowerCase();
  if (!['economy', 'standard', 'premium', 'luxury'].includes(key)) {
    throw new Error('Material quality must be economy, standard, premium, or luxury.');
  }
  return key;
}

function normalizeCategory(category) {
  const key = String(category || 'turnkey').toLowerCase();
  if (key.includes('grey')) return 'grey';
  if (key.includes('finish') || key.includes('renovat')) return 'finishing';
  if (key.includes('turn') || key.includes('complete') || key.includes('full')) return 'turnkey';
  if (!CATEGORY_SCOPE[key]) throw new Error('Construction category must be grey, finishing, or turnkey.');
  return key;
}

function findRated(rows, predicate) {
  return rows.find(predicate);
}

function resolveRate(book, rows, matcher, quality, location, rateKey) {
  const exact = findRated(rows, (row) => matcher(row) && row.location === location && row.quality === quality);
  if (exact) {
    return { rate: exact[rateKey], provenance: `Configured ${location} / ${quality} rate` };
  }
  const base = findRated(rows, (row) => matcher(row) && row.location === 'Islamabad' && row.quality === 'standard')
    || findRated(rows, matcher);
  if (!base) return null;
  const qualityFactor = book.qualityFactors?.[quality] ?? 1;
  const locationFactor = book.locationFactors?.[location] ?? 1;
  return {
    rate: base[rateKey] * qualityFactor * locationFactor,
    provenance: `Islamabad standard rate adjusted by quality factor ${qualityFactor} and ${location} factor ${locationFactor}`,
  };
}

export function calculateEstimate(input = {}, rateBook = illustrativeRateBook()) {
  const book = rateBook?.materials ? rateBook : illustrativeRateBook();
  const quality = normalizeQuality(input.quality);
  const category = normalizeCategory(input.category || input.constructionType);
  const location = String(input.location || 'Islamabad');
  const floors = Number(input.floors);
  if (!Number.isInteger(floors) || floors < 1 || floors > 40) {
    throw new Error('Number of floors must be a whole number from 1 to 40.');
  }
  const plotSqFt = toSquareFeet(input.plotArea, input.plotUnit || input.unit || 'sq ft');
  const coveredPerFloor = toSquareFeet(input.coveredArea, input.coveredUnit || 'sq ft');
  if (coveredPerFloor > plotSqFt * 1.25) {
    throw new Error('Covered area per floor cannot exceed the plot area by more than 25 percent.');
  }
  const builtUpSqFt = coveredPerFloor * floors;
  const scope = CATEGORY_SCOPE[category];
  const inflation = percent(input.inflationPercent ?? 0, 0);
  const overheadRate = percent(input.overheadPercent, book.defaults?.overheadPercent ?? 8);
  const contingencyRate = percent(input.contingencyPercent, book.defaults?.contingencyPercent ?? 5);
  const marginRate = percent(input.marginPercent, book.defaults?.marginPercent ?? 0);
  const taxRate = percent(input.taxPercent, book.defaults?.taxPercent ?? 0);

  const warnings = [];
  if (coveredPerFloor > plotSqFt) warnings.push('Covered area per floor is larger than the plot area.');
  if (!book.locationFactors?.[location]) warnings.push(`No location factor is configured for ${location}. Islamabad standard rates were used without a location adjustment.`);

  const lines = [];
  for (const rule of book.materials) {
    if (!scope[rule.scope]) continue;
    const resolved = resolveRate(book, book.materials, (row) => row.code === rule.code, quality, location, 'rate');
    if (!resolved) continue;
    const quantity = quantityFor(builtUpSqFt * rule.perSqFt, rule.unit);
    const materialInflation = rule.scope === 'grey' || rule.scope === 'finishing' ? inflation : 0;
    const unitRate = resolved.rate * (1 + materialInflation);
    lines.push({
      code: rule.code,
      name: rule.name,
      category: rule.category,
      scope: rule.scope,
      unit: rule.unit,
      quantity,
      unitRate: money(unitRate),
      cost: money(quantity * unitRate),
      provenance: resolved.provenance,
    });
  }

  const sumScope = (scopeName, field) => lines.filter((line) => line.scope === scopeName).reduce((total, line) => total + line[field], 0);

  function laborCost(scopeName) {
    if (!scope[scopeName]) return { cost: 0, provenance: 'Not included in this category' };
    if (input.laborOverride !== undefined && input.laborOverride !== '' && input.laborOverride !== null && scopeName === 'grey' && !scope.finishing) {
      return { cost: money(input.laborOverride), provenance: 'Manual labor override replaced the calculated grey-structure labor cost' };
    }
    if (input.laborOverride !== undefined && input.laborOverride !== '' && input.laborOverride !== null && category === 'turnkey' && scopeName === 'grey') {
      return { cost: 0, provenance: 'Manual labor override is applied once on the finishing labor line for turnkey estimates' };
    }
    if (input.laborOverride !== undefined && input.laborOverride !== '' && input.laborOverride !== null && (category === 'finishing' || (category === 'turnkey' && scopeName === 'finishing'))) {
      return { cost: money(input.laborOverride), provenance: 'Manual labor override replaced calculated labor for this estimate' };
    }
    const resolved = resolveRate(book, book.labor || [], (row) => row.scope === scopeName, quality, location, 'ratePerSqFt');
    if (!resolved) return { cost: 0, provenance: 'No labor rate configured' };
    return { cost: money(builtUpSqFt * resolved.rate), provenance: resolved.provenance, ratePerSqFt: money(resolved.rate) };
  }

  function equipmentCost(scopeName) {
    if (!scope[scopeName]) return { cost: 0, provenance: 'Not included in this category' };
    const resolved = resolveRate(book, book.equipment || [], (row) => row.scope === scopeName, quality, location, 'ratePerSqFt');
    if (!resolved) return { cost: 0, provenance: 'No equipment rate configured' };
    return { cost: money(builtUpSqFt * resolved.rate), provenance: resolved.provenance, ratePerSqFt: money(resolved.rate) };
  }

  const greyLabor = laborCost('grey');
  const finishingLabor = laborCost('finishing');
  const greyEquipment = equipmentCost('grey');
  const finishingEquipment = equipmentCost('finishing');
  const greyMaterial = money(sumScope('grey', 'cost'));
  const finishingMaterial = money(sumScope('finishing', 'cost'));
  const materialCost = greyMaterial + finishingMaterial;
  const laborTotal = greyLabor.cost + finishingLabor.cost;
  const equipmentTotal = greyEquipment.cost + finishingEquipment.cost;
  const direct = materialCost + laborTotal + equipmentTotal;
  const overhead = money(direct * overheadRate);
  const marginBase = direct + overhead;
  const contractorMargin = money(marginBase * marginRate);
  const contingency = money(marginBase * contingencyRate);
  const tax = money((marginBase + contractorMargin) * taxRate);
  const total = direct + overhead + contractorMargin + contingency + tax;

  const portion = (material, labor, equipment) => {
    const directPortion = material + labor + equipment;
    const share = direct === 0 ? 0 : directPortion / direct;
    return {
      materialCost: material,
      laborCost: labor,
      equipmentCost: equipment,
      overhead: money(overhead * share),
      contractorMargin: money(contractorMargin * share),
      contingency: money(contingency * share),
      tax: money(tax * share),
      total: money(directPortion + (overhead + contractorMargin + contingency + tax) * share),
    };
  };

  const monthsBase = category === 'grey' ? 2 + floors * 1.4 : category === 'finishing' ? 1.2 + floors * 0.8 : 3 + floors * 1.8;
  const qualityBump = quality === 'luxury' ? 1.15 : quality === 'premium' ? 1.08 : quality === 'economy' ? 0.92 : 1;
  const timelineMonths = Math.round(monthsBase * qualityBump * 10) / 10;

  return {
    currency: 'PKR',
    illustrative: book.illustrative !== false,
    source: book.source,
    rateUpdatedAt: book.updatedAt,
    limitations: 'This is a conceptual planning estimate, not a certified engineering bill of quantities or a contractor tender.',
    input: {
      projectName: String(input.projectName || 'Untitled estimate').slice(0, 120),
      location,
      projectType: String(input.projectType || input.buildingType || 'House'),
      category,
      quality,
      plotArea: Number(input.plotArea),
      plotUnit: input.plotUnit || input.unit || 'sq ft',
      coveredArea: Number(input.coveredArea),
      coveredUnit: input.coveredUnit || 'sq ft',
      floors,
      structureType: String(input.structureType || 'Framed RCC'),
      preferences: String(input.preferences || '').slice(0, 500),
      additional: String(input.additional || '').slice(0, 500),
      overheadPercent: overheadRate * 100,
      contingencyPercent: contingencyRate * 100,
      marginPercent: marginRate * 100,
      taxPercent: taxRate * 100,
      inflationPercent: inflation * 100,
    },
    areas: {
      plotSqFt: Math.round(plotSqFt),
      coveredPerFloorSqFt: Math.round(coveredPerFloor),
      builtUpSqFt: Math.round(builtUpSqFt),
    },
    lines,
    quantities: {
      cementBags: lines.filter((line) => line.code.startsWith('cement')).reduce((sum, line) => sum + line.quantity, 0),
      steelKg: lines.find((line) => line.code === 'steel')?.quantity || 0,
      sandCft: lines.filter((line) => line.code.startsWith('sand')).reduce((sum, line) => sum + line.quantity, 0),
      crushCft: lines.find((line) => line.code === 'crush')?.quantity || 0,
      bricks: lines.find((line) => line.code === 'bricks')?.quantity || 0,
    },
    materialCost,
    laborCost: laborTotal,
    equipmentCost: equipmentTotal,
    overhead,
    contractorMargin,
    contingency,
    tax,
    total,
    costPerSqFt: builtUpSqFt ? money(total / builtUpSqFt) : 0,
    grey: scope.grey ? portion(greyMaterial, greyLabor.cost, greyEquipment.cost) : null,
    finishing: scope.finishing ? portion(finishingMaterial, finishingLabor.cost, finishingEquipment.cost) : null,
    laborProvenance: { grey: greyLabor.provenance, finishing: finishingLabor.provenance },
    equipmentProvenance: { grey: greyEquipment.provenance, finishing: finishingEquipment.provenance },
    timelineMonths,
    timelineLabel: `${timelineMonths} months (indicative)`,
    warnings,
    assumptions: [
      'Built-up area equals covered area per floor multiplied by the number of floors.',
      'Quantities use configurable per-square-foot rules for a framed concrete building.',
      'Contractor margin and contingency are each applied once to direct cost plus overhead. They are not applied to each other.',
      'Tax is applied once to direct cost, overhead, and contractor margin. Contingency is excluded from the tax base.',
      'A manual labor override replaces calculated labor instead of being added on top of it.',
      'Inflation, when set, adjusts material unit rates only.',
      book.illustrative !== false ? 'Rates are illustrative sample values until a verified price source is configured.' : 'Rates come from the configured database snapshot.',
    ],
    exclusions: [
      'Land purchase, legal fees, and authority approval charges',
      'Utility connection deposits and external development works',
      'Loose furniture, appliances, and specialist equipment',
      'Site-specific soil, structural, or seismic design changes',
    ],
    explanation: [
      'Direct cost = material cost + labor cost + equipment cost.',
      'Overhead = direct cost × overhead percent.',
      'Contractor margin = (direct cost + overhead) × margin percent.',
      'Contingency = (direct cost + overhead) × contingency percent.',
      'Tax = (direct cost + overhead + contractor margin) × tax percent.',
      'Total = direct cost + overhead + contractor margin + contingency + tax.',
    ],
  };
}
