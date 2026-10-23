/** Illustrative Pakistan planning rates. Not live market prices and not a quotation. */
export const RATE_SOURCE = 'BuildRight illustrative sample — verify with local suppliers before use';
export const RATE_UPDATED_AT = '2026-01-15T00:00:00.000Z';

export const LOCATION_FACTORS = {
  Islamabad: 1,
  Rawalpindi: 0.98,
  Lahore: 1.03,
  Karachi: 1.07,
  Peshawar: 0.96,
  Multan: 0.94,
  Faisalabad: 0.95,
  'Gilgit-Baltistan': 1.18,
};

export const QUALITY_FACTORS = {
  economy: 0.84,
  standard: 1,
  premium: 1.2,
  luxury: 1.52,
};

/** Quantity per built-up square foot. Conceptual rules for a framed RCC building, not a certified bill of quantities. */
export const QUANTITY_RULES = [
  { code: 'cement-grey', name: 'Cement (grey structure)', category: 'Binders', unit: 'bag', scope: 'grey', perSqFt: 0.4 },
  { code: 'steel', name: 'Steel reinforcement', category: 'Structural', unit: 'kg', scope: 'grey', perSqFt: 3.75 },
  { code: 'sand-grey', name: 'Sand (grey structure)', category: 'Aggregates', unit: 'cft', scope: 'grey', perSqFt: 1.5 },
  { code: 'crush', name: 'Crush / aggregate', category: 'Aggregates', unit: 'cft', scope: 'grey', perSqFt: 2.1 },
  { code: 'bricks', name: 'Bricks', category: 'Masonry', unit: 'nos', scope: 'grey', perSqFt: 7.5 },
  { code: 'cement-finish', name: 'Cement (finishing)', category: 'Binders', unit: 'bag', scope: 'finishing', perSqFt: 0.1 },
  { code: 'sand-finish', name: 'Sand (finishing)', category: 'Aggregates', unit: 'cft', scope: 'finishing', perSqFt: 0.4 },
  { code: 'tiles', name: 'Floor and wall tiles', category: 'Finishing', unit: 'sq ft', scope: 'finishing', perSqFt: 0.85 },
  { code: 'paint', name: 'Paint', category: 'Finishing', unit: 'gallon', scope: 'finishing', perSqFt: 0.015 },
  { code: 'doors', name: 'Doors', category: 'Finishing', unit: 'nos', scope: 'finishing', perSqFt: 0.004 },
  { code: 'windows', name: 'Windows', category: 'Finishing', unit: 'nos', scope: 'finishing', perSqFt: 0.008 },
  { code: 'electrical', name: 'Electrical allowance', category: 'Electrical', unit: 'sq ft', scope: 'finishing', perSqFt: 1 },
  { code: 'plumbing', name: 'Plumbing allowance', category: 'Plumbing', unit: 'sq ft', scope: 'finishing', perSqFt: 1 },
];

const BASE_RATES = {
  'cement-grey': 1400,
  steel: 270,
  'sand-grey': 65,
  crush: 85,
  bricks: 18,
  'cement-finish': 1400,
  'sand-finish': 65,
  tiles: 250,
  paint: 3800,
  doors: 18000,
  windows: 15000,
  electrical: 160,
  plumbing: 120,
};

export function illustrativeRateBook() {
  return {
    illustrative: true,
    source: RATE_SOURCE,
    updatedAt: RATE_UPDATED_AT,
    locationFactors: { ...LOCATION_FACTORS },
    qualityFactors: { ...QUALITY_FACTORS },
    materials: QUANTITY_RULES.map((rule) => ({
      code: rule.code,
      name: rule.name,
      category: rule.category,
      unit: rule.unit,
      scope: rule.scope,
      perSqFt: rule.perSqFt,
      rate: BASE_RATES[rule.code],
      quality: 'standard',
      location: 'Islamabad',
      supplier: 'Sample supplier entry',
    })),
    labor: [
      { scope: 'grey', quality: 'standard', location: 'Islamabad', ratePerSqFt: 480 },
      { scope: 'finishing', quality: 'standard', location: 'Islamabad', ratePerSqFt: 420 },
    ],
    equipment: [
      { scope: 'grey', quality: 'standard', location: 'Islamabad', ratePerSqFt: 90 },
      { scope: 'finishing', quality: 'standard', location: 'Islamabad', ratePerSqFt: 35 },
    ],
    defaults: { overheadPercent: 8, contingencyPercent: 5, marginPercent: 0, taxPercent: 0 },
  };
}
