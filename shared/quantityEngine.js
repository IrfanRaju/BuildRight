const BAG_VOLUME_M3 = 0.035;
const CFT_PER_M3 = 35.3147;
const SQM_PER_SQFT = 0.092903;

export const ESTIMATE_LABEL = 'Estimate only. Actual quantities depend on site conditions, thickness, workmanship, and wastage.';

export const PRODUCT_UNITS = ['bag', 'piece', 'kg', 'ton', 'liter', 'meter', 'sq ft', 'cft'];

export const PAINT_COVERAGE_SQFT = { economy: 70, standard: 85, premium: 100, luxury: 120 };

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function positive(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function wastageRate(value, fallback = 0.1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(0.3, Math.max(0, number));
}

function materialLine(role, name, net, unit, wastage) {
  const safeNet = Math.max(0, net);
  const wastageQuantity = safeNet * wastage;
  const total = safeNet + wastageQuantity;
  const quantity = unit === 'piece' ? Math.ceil(total - 1e-9) : round(total);
  return {
    role,
    name,
    netQuantity: unit === 'piece' ? Math.ceil(safeNet - 1e-9) : round(safeNet),
    wastageQuantity: round(wastageQuantity),
    quantity,
    unit,
  };
}

function wallArea(input) {
  if (positive(input.areaSqFt)) return positive(input.areaSqFt);
  const walls = Math.max(1, Math.round(positive(input.walls, 1)));
  return positive(input.lengthFt) * positive(input.heightFt) * walls;
}

export function plasterMaterials(input = {}) {
  const areaSqFt = wallArea(input);
  if (areaSqFt <= 0) return { ok: false, error: 'Enter a wall area, or the length, height, and number of walls.' };
  const thicknessMm = Math.min(40, positive(input.thicknessMm, 12));
  const cementParts = positive(input.mixCement, 1);
  const sandParts = positive(input.mixSand, 4);
  const wastage = wastageRate(input.wastage, 0.1);
  const dryM3 = areaSqFt * SQM_PER_SQFT * (thicknessMm / 1000) * 1.33;
  const parts = cementParts + sandParts;
  return {
    ok: true,
    estimate: true,
    kind: 'plaster',
    disclaimer: ESTIMATE_LABEL,
    laborQuantity: round(areaSqFt),
    laborUnit: 'sq ft',
    summary: { areaSqFt: round(areaSqFt), thicknessMm, mix: `${cementParts}:${sandParts}`, wastagePercent: Math.round(wastage * 100) },
    lines: [
      materialLine('cement', 'Cement', (dryM3 * (cementParts / parts)) / BAG_VOLUME_M3, 'bag', wastage),
      materialLine('sand', 'Sand', dryM3 * (sandParts / parts) * CFT_PER_M3, 'cft', wastage),
    ],
  };
}

export function paintMaterials(input = {}) {
  const surface = ['interior', 'exterior', 'both'].includes(input.surface) ? input.surface : 'interior';
  const wall = positive(input.wallAreaSqFt);
  const ceiling = positive(input.ceilingAreaSqFt);
  const exterior = positive(input.exteriorWallSqFt);
  const doors = positive(input.doors);
  const windows = positive(input.windows);
  const coats = Math.min(5, Math.max(1, Math.round(positive(input.coats, 2))));
  const openings = doors * 21 + windows * 12;
  const interiorArea = (surface === 'exterior' ? 0 : wall + ceiling) + (surface === 'exterior' ? 0 : openings);
  const exteriorArea = (surface === 'interior' ? 0 : exterior) + (surface === 'exterior' ? openings : 0);
  const paintable = interiorArea + exteriorArea;
  if (paintable <= 0) return { ok: false, error: 'Enter a wall, ceiling, or exterior area to estimate paint.' };
  const quality = PAINT_COVERAGE_SQFT[input.quality] ? input.quality : 'standard';
  const coverage = PAINT_COVERAGE_SQFT[quality];
  const wastage = wastageRate(input.wastage, 0.1);
  const condition = ['minor', 'moderate', 'major'].includes(input.condition) ? input.condition : 'moderate';
  const puttyPerSqFt = { minor: 1 / 15, moderate: 1 / 10, major: 1 / 6 }[condition];
  const lines = [];
  if (interiorArea > 0) lines.push(materialLine('interior-paint', 'Interior paint', (interiorArea * coats) / coverage, 'liter', wastage));
  if (exteriorArea > 0) lines.push(materialLine('exterior-paint', 'Exterior paint', (exteriorArea * coats) / coverage, 'liter', wastage));
  lines.push(materialLine('primer', 'Primer', paintable / 110, 'liter', wastage));
  const puttyArea = surface === 'exterior' ? exterior : wall;
  if (puttyArea > 0) lines.push(materialLine('putty', 'Wall putty', puttyArea * puttyPerSqFt, 'kg', wastage));
  lines.push(materialLine('sandpaper', 'Sandpaper', Math.max(1, paintable / 150), 'piece', 0));
  lines.push(materialLine('brush', 'Paint brushes', paintable > 400 ? 3 : 2, 'piece', 0));
  lines.push(materialLine('roller', 'Paint rollers', paintable > 250 ? 2 : 1, 'piece', 0));
  return {
    ok: true,
    estimate: true,
    kind: 'paint',
    disclaimer: ESTIMATE_LABEL,
    laborQuantity: round(paintable),
    laborUnit: 'sq ft',
    coatFactor: coats / 2,
    summary: { paintableSqFt: round(paintable), coats, quality, coverageSqFtPerLiter: coverage, wastagePercent: Math.round(wastage * 100), condition },
    lines,
  };
}

export function tileMaterials(input = {}) {
  const areaSqFt = positive(input.floorAreaSqFt) || positive(input.areaSqFt);
  if (areaSqFt <= 0) return { ok: false, error: 'Enter the floor or wall area to estimate tiles.' };
  const tileSqFt = (positive(input.tileLengthIn, 24) * positive(input.tileWidthIn, 24)) / 144;
  if (tileSqFt <= 0) return { ok: false, error: 'Enter a tile size.' };
  const wastage = wastageRate(input.wastage, 0.1);
  const areaSqM = areaSqFt * SQM_PER_SQFT;
  return {
    ok: true,
    estimate: true,
    kind: 'tiles',
    disclaimer: ESTIMATE_LABEL,
    laborQuantity: round(areaSqFt),
    laborUnit: 'sq ft',
    summary: { areaSqFt: round(areaSqFt), tileSqFt: round(tileSqFt), wastagePercent: Math.round(wastage * 100) },
    lines: [
      materialLine('tile', 'Tiles', areaSqFt / tileSqFt, 'piece', wastage),
      materialLine('adhesive', 'Tile adhesive', areaSqM * 4, 'kg', wastage),
      materialLine('grout', 'Tile grout', areaSqM * 0.45, 'kg', wastage),
    ],
  };
}

export function plumbingMaterials(input = {}) {
  const length = positive(input.pipeLengthM);
  const fittings = positive(input.fittings);
  const taps = positive(input.taps);
  if (length + fittings + taps <= 0) return { ok: false, error: 'Enter a pipe length, fitting count, or number of taps.' };
  const wastage = wastageRate(input.wastage, 0.1);
  const lines = [];
  if (length > 0) lines.push(materialLine('pipe', 'Water pipe', length, 'meter', wastage));
  if (fittings > 0) lines.push(materialLine('fitting', 'Pipe fittings', fittings, 'piece', 0));
  if (taps > 0) lines.push(materialLine('tap', 'Taps', taps, 'piece', 0));
  return {
    ok: true,
    estimate: true,
    kind: 'plumbing',
    disclaimer: ESTIMATE_LABEL,
    laborQuantity: Math.max(1, fittings + taps),
    laborUnit: 'point',
    summary: { pipeLengthM: round(length), fittings, taps, wastagePercent: Math.round(wastage * 100) },
    lines,
  };
}

export function waterproofingMaterials(input = {}) {
  const areaSqFt = positive(input.roofAreaSqFt) || positive(input.areaSqFt);
  if (areaSqFt <= 0) return { ok: false, error: 'Enter the roof or wall area to estimate waterproofing.' };
  const coats = Math.min(4, Math.max(1, Math.round(positive(input.coats, 2))));
  const coverage = positive(input.coverageSqFtPerLiter, 12);
  const wastage = wastageRate(input.wastage, 0.1);
  return {
    ok: true,
    estimate: true,
    kind: 'waterproofing',
    disclaimer: ESTIMATE_LABEL,
    laborQuantity: round(areaSqFt),
    laborUnit: 'sq ft',
    summary: { areaSqFt: round(areaSqFt), coats, coverageSqFtPerLiter: coverage, repairType: String(input.repairType || 'waterproofing'), wastagePercent: Math.round(wastage * 100) },
    lines: [
      materialLine('waterproofing', 'Waterproofing chemical', (areaSqFt * coats) / coverage, 'liter', wastage),
      materialLine('sealant', 'Sealant', Math.max(1, areaSqFt / 120), 'piece', 0),
    ],
  };
}

export const QUANTITY_CALCULATORS = [
  {
    id: 'plaster',
    title: 'Cement, sand, and plaster',
    text: 'Wall repairs and new plaster from area or wall dimensions.',
    run: plasterMaterials,
    fields: [
      { key: 'lengthFt', label: 'Wall length', unit: 'ft' },
      { key: 'heightFt', label: 'Wall height', unit: 'ft' },
      { key: 'walls', label: 'Number of walls', unit: '' },
      { key: 'areaSqFt', label: 'Or total wall area', unit: 'sq ft' },
      { key: 'thicknessMm', label: 'Plaster thickness', unit: 'mm', defaultValue: 12 },
    ],
  },
  {
    id: 'paint',
    title: 'Paint and primer',
    text: 'Rooms, walls, ceilings, and house exteriors.',
    run: paintMaterials,
    fields: [
      { key: 'wallAreaSqFt', label: 'Interior wall area', unit: 'sq ft' },
      { key: 'ceilingAreaSqFt', label: 'Ceiling area', unit: 'sq ft' },
      { key: 'exteriorWallSqFt', label: 'Exterior wall area', unit: 'sq ft' },
      { key: 'coats', label: 'Number of coats', unit: '', defaultValue: 2 },
      { key: 'doors', label: 'Doors', unit: '' },
      { key: 'windows', label: 'Windows', unit: '' },
    ],
  },
  {
    id: 'tiles',
    title: 'Tiles and adhesive',
    text: 'Floors and bathrooms, including grout and wastage.',
    run: tileMaterials,
    fields: [
      { key: 'floorAreaSqFt', label: 'Floor or wall area', unit: 'sq ft' },
      { key: 'tileLengthIn', label: 'Tile length', unit: 'in', defaultValue: 24 },
      { key: 'tileWidthIn', label: 'Tile width', unit: 'in', defaultValue: 24 },
    ],
  },
  {
    id: 'plumbing',
    title: 'Pipes and fittings',
    text: 'Plumbing repairs from measured pipe runs and fitting counts.',
    run: plumbingMaterials,
    fields: [
      { key: 'pipeLengthM', label: 'Pipe length', unit: 'm' },
      { key: 'fittings', label: 'Fittings', unit: '' },
      { key: 'taps', label: 'Taps', unit: '' },
    ],
  },
  {
    id: 'waterproofing',
    title: 'Waterproofing',
    text: 'Roofs and walls from the area and number of coats.',
    run: waterproofingMaterials,
    fields: [
      { key: 'roofAreaSqFt', label: 'Roof or wall area', unit: 'sq ft' },
      { key: 'coats', label: 'Number of coats', unit: '', defaultValue: 2 },
    ],
  },
];

export function runQuantityCalculator(id, input) {
  const calculator = QUANTITY_CALCULATORS.find((item) => item.id === id);
  if (!calculator) return { ok: false, error: 'Choose a quantity calculator.' };
  return calculator.run(input || {});
}
