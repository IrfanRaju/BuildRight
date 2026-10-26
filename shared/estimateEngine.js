import { illustrativeRateBook } from './rateBook.js';
import { projectSizeBand, resolveMarginPercent } from './marginEngine.js';
import { predictTimeline } from './timelineEngine.js';

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

function locationMultiplier(book, location) {
  const regional = book.regionalRates?.[location];
  if (regional && Number.isFinite(regional.multiplier)) {
    return {
      factor: regional.multiplier,
      transport: Number(regional.transportAdjustment) || 0,
      provenance: `RegionalRate for ${location}`,
    };
  }
  return {
    factor: book.locationFactors?.[location] ?? 1,
    transport: 0,
    provenance: book.locationFactors?.[location] != null ? `Location factor for ${location}` : 'No regional multiplier (using 1.0)',
  };
}

function resolveRate(book, rows, matcher, quality, location, rateKey) {
  const exact = findRated(rows, (row) => matcher(row) && row.location === location && row.quality === quality);
  if (exact) {
    const includesTransport = exact.priceIncludesTransport === true;
    return {
      rate: exact[rateKey],
      provenance: includesTransport
        ? `Configured ${location} / ${quality} rate (already includes regional/transport — multiplier not reapplied)`
        : `Configured ${location} / ${quality} rate`,
      skipLocationFactor: true,
      priceIncludesTransport: includesTransport,
    };
  }
  const cityAnyQuality = findRated(rows, (row) => matcher(row) && row.location === location);
  if (cityAnyQuality) {
    const qualityFactor = book.qualityFactors?.[quality] ?? 1;
    const includesTransport = cityAnyQuality.priceIncludesTransport === true;
    return {
      rate: cityAnyQuality[rateKey] * qualityFactor,
      provenance: includesTransport
        ? `${location} rate × quality ${qualityFactor} (transport already in price)`
        : `${location} rate × quality factor ${qualityFactor}`,
      skipLocationFactor: true,
      priceIncludesTransport: includesTransport,
    };
  }
  const base = findRated(rows, (row) => matcher(row) && row.location === 'Islamabad' && row.quality === 'standard')
    || findRated(rows, matcher);
  if (!base) return null;
  const qualityFactor = book.qualityFactors?.[quality] ?? 1;
  const loc = locationMultiplier(book, location);
  const transportBump = 1 + loc.transport;
  return {
    rate: base[rateKey] * qualityFactor * loc.factor * transportBump,
    provenance: `Islamabad standard × quality ${qualityFactor} × ${loc.provenance} ${loc.factor}${loc.transport ? ` × transport ${transportBump}` : ''}`,
    skipLocationFactor: false,
    priceIncludesTransport: false,
  };
}

function resolveQuantityPerSqFt(book, rule, input) {
  const overrides = input.quantityOverrides || {};
  if (overrides[rule.code] != null && overrides[rule.code] !== '') {
    return { perSqFt: Number(overrides[rule.code]), source: 'Manual quantity override' };
  }
  const buildingType = String(input.projectType || input.buildingType || 'House');
  const quality = normalizeQuality(input.quality);
  const dbRules = book.quantityRules || [];
  const match = dbRules.find((row) => row.code === rule.code && row.active !== false
    && (row.buildingType === '*' || row.buildingType === buildingType)
    && (row.quality === '*' || row.quality === quality))
    || dbRules.find((row) => row.code === rule.code && row.active !== false && row.buildingType === '*');
  if (match) {
    const floors = Number(input.floors) || 1;
    const floorAdj = 1 + (Number(match.floorFactor) || 0) * Math.max(0, floors - 1);
    return { perSqFt: match.perSqFt * floorAdj, source: `QuantityRule ${match.code} (${match.buildingType}/${match.quality})` };
  }
  const template = book.buildingTemplate;
  const multiplier = template?.quantityMultipliers?.[rule.code] ?? template?.quantityMultipliers?.get?.(rule.code) ?? 1;
  return { perSqFt: rule.perSqFt * (Number(multiplier) || 1), source: 'Rate-book quantity coefficient' };
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
  const marginResolution = resolveMarginPercent(
    { ...input, coveredAreaSqFt: coveredPerFloor, builtUpSqFt, projectSize: projectSizeBand(builtUpSqFt) },
    book.marginRules || [],
    book.defaults?.marginPercent ?? 0,
  );
  const marginRate = percent(marginResolution.marginPercent, book.defaults?.marginPercent ?? 0);
  const taxRate = percent(input.taxPercent, book.defaults?.taxPercent ?? 0);
  const regional = locationMultiplier(book, location);

  const warnings = [];
  if (coveredPerFloor > plotSqFt) warnings.push('Covered area per floor is larger than the plot area.');
  if (!book.locationFactors?.[location] && !book.regionalRates?.[location]) {
    warnings.push(`No regional rate is configured for ${location}. Islamabad standard rates were used without a location adjustment.`);
  }

  const uniqueCodes = new Map();
  for (const rule of book.materials) {
    if (!scope[rule.scope]) continue;
    if (!uniqueCodes.has(rule.code)) uniqueCodes.set(rule.code, rule);
  }

  const lines = [];
  for (const rule of uniqueCodes.values()) {
    if (!scope[rule.scope]) continue;
    const resolved = resolveRate(book, book.materials, (row) => row.code === rule.code, quality, location, 'rate');
    if (!resolved) continue;
    const qty = resolveQuantityPerSqFt(book, rule, input);
    const quantity = quantityFor(builtUpSqFt * qty.perSqFt, rule.unit);
    const materialInflation = rule.scope === 'grey' || rule.scope === 'finishing' ? inflation : 0;
    const unitRate = resolved.rate * (1 + materialInflation);
    lines.push({
      code: rule.code,
      name: rule.name,
      category: rule.category,
      scope: rule.scope,
      unit: rule.unit,
      quantity,
      perSqFt: qty.perSqFt,
      quantitySource: qty.source,
      unitRate: money(unitRate),
      cost: money(quantity * unitRate),
      provenance: resolved.provenance,
      imageUrl: rule.imageUrl || '',
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

  const laborIntensity = Number(book.buildingTemplate?.laborIntensity) || 1;
  const laborAdjustmentNote = laborIntensity !== 1
    ? `Labor scaled by building template intensity ${laborIntensity}`
    : null;
  const greyLaborRaw = laborCost('grey');
  const finishingLaborRaw = laborCost('finishing');
  const greyLabor = { ...greyLaborRaw, cost: money(greyLaborRaw.cost * (input.laborOverride !== undefined && input.laborOverride !== '' && input.laborOverride !== null ? 1 : laborIntensity)) };
  const finishingLabor = { ...finishingLaborRaw, cost: money(finishingLaborRaw.cost * (input.laborOverride !== undefined && input.laborOverride !== '' && input.laborOverride !== null ? 1 : laborIntensity)) };
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

  const timeline = predictTimeline({
    coveredAreaSqFt: coveredPerFloor,
    floors,
    category,
    quality,
    buildingType: String(input.projectType || input.buildingType || 'House'),
    constructionMethod: String(input.structureType || 'Framed RCC'),
    startDate: input.startDate || '',
    workforceFactor: Number(input.workforceFactor) || 1,
    timelineFactor: book.buildingTemplate?.timelineFactor || 1,
    phases: book.buildingTemplate?.phases,
  });

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
      startDate: input.startDate || '',
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
    regionalAdjustment: {
      city: location,
      multiplier: regional.factor,
      transportAdjustment: regional.transport,
      appliedVia: regional.provenance,
      note: 'City-specific material/labor rows skip the regional multiplier to avoid double-counting.',
    },
    marginResolution: {
      percent: marginRate * 100,
      amount: contractorMargin,
      source: marginResolution.source,
      matchedRule: marginResolution.matchedRule,
    },
    lines,
    quantities: {
      cementBags: lines.filter((line) => line.code.startsWith('cement')).reduce((sum, line) => sum + line.quantity, 0),
      steelKg: lines.find((line) => line.code === 'steel')?.quantity || 0,
      sandCft: lines.filter((line) => line.code.startsWith('sand')).reduce((sum, line) => sum + line.quantity, 0),
      crushCft: lines.find((line) => line.code === 'crush')?.quantity || 0,
      bricks: lines.find((line) => line.code === 'bricks')?.quantity || 0,
      blocks: lines.find((line) => line.code === 'blocks')?.quantity || 0,
      paint: lines.find((line) => line.code === 'paint')?.quantity || 0,
      tiles: lines.find((line) => line.code === 'tiles')?.quantity || 0,
      electrical: lines.find((line) => line.code === 'electrical')?.quantity || 0,
      plumbing: lines.find((line) => line.code === 'plumbing')?.quantity || 0,
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
    laborProvenance: {
      grey: greyLabor.provenance,
      finishing: finishingLabor.provenance,
      intensity: laborAdjustmentNote,
    },
    equipmentProvenance: { grey: greyEquipment.provenance, finishing: finishingEquipment.provenance },
    timelineMonths: timeline.totalMonths,
    timelineLabel: timeline.timelineLabel,
    timeline,
    warnings,
    assumptions: [
      'Built-up area equals covered area per floor multiplied by the number of floors.',
      'Quantities use MongoDB QuantityRule / BuildingTemplate coefficients when present; otherwise rate-book per-square-foot rules.',
      'Contractor margin and contingency are each applied once to direct cost plus overhead. They are not applied to each other.',
      'Tax is applied once to direct cost, overhead, and contractor margin. Contingency is excluded from the tax base.',
      'A manual labor override replaces calculated labor instead of being added on top of it.',
      'Inflation, when set, adjusts material unit rates only.',
      'Regional multipliers apply only when a city-specific price is missing; prices marked priceIncludesTransport are never re-multiplied.',
      marginResolution.source,
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
      'Contractor margin = (direct cost + overhead) × margin percent (from MarginRule or form).',
      'Contingency = (direct cost + overhead) × contingency percent.',
      'Tax = (direct cost + overhead + contractor margin) × tax percent.',
      'Total = direct cost + overhead + contractor margin + contingency + tax.',
      'Regional multiplier is applied once via rate resolution — never stacked on city-local prices.',
    ],
  };
}
