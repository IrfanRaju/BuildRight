export const REPAIR_SERVICES = [
  { slug: 'house-painting', title: 'House Painting', summary: 'Interior walls, exterior walls, ceilings, doors, and window painting.', calculator: 'paint', keywords: ['paint', 'primer', 'interior', 'exterior', 'ceiling'], tasks: ['Interior walls', 'Exterior walls', 'Ceilings', 'Doors and windows'] },
  { slug: 'wall-repair', title: 'Wall Repair', summary: 'Cracks, damaged plaster, peeling paint, holes, and surface preparation.', calculator: 'plaster', keywords: ['wall cracks', 'plaster', 'holes', 'peeling paint'], tasks: ['Cracks', 'Damaged plaster', 'Peeling paint', 'Holes'] },
  { slug: 'roof-repair', title: 'Roof Repair', summary: 'Roof leakage, waterproofing, damaged roofing, and water seepage.', calculator: 'waterproofing', keywords: ['roof leakage', 'seepage', 'waterproofing'], tasks: ['Leakage', 'Waterproofing', 'Damaged roofing', 'Seepage'] },
  { slug: 'bathroom-repair', title: 'Bathroom Repair', summary: 'Leaking taps, broken tiles, damaged fittings, and waterproofing.', calculator: 'bathroom', keywords: ['bathroom', 'taps', 'tiles'], tasks: ['Leaking taps', 'Broken tiles', 'Fittings', 'Waterproofing'] },
  { slug: 'kitchen-improvement', title: 'Kitchen Improvement', summary: 'Cabinet repairs, repainting, sink replacement, countertops, and minor upgrades.', calculator: 'kitchen', keywords: ['kitchen', 'cabinets', 'countertop'], tasks: ['Cabinets', 'Repainting', 'Sink', 'Countertop'] },
  { slug: 'floor-repair', title: 'Floor Repair', summary: 'Broken tiles, damaged flooring, tile replacement, and grout repair.', calculator: 'tiles', keywords: ['flooring', 'tiles', 'grout'], tasks: ['Broken tiles', 'Tile replacement', 'Grout repair'] },
  { slug: 'plumbing-repair', title: 'Plumbing Repair', summary: 'Leaking pipes, blocked drains, faulty taps, and water supply problems.', calculator: 'plumbing', keywords: ['plumbing', 'pipes', 'drains', 'taps'], tasks: ['Leaking pipes', 'Blocked drains', 'Faulty taps'] },
  { slug: 'electrical-repair', title: 'Electrical Repair', summary: 'Damaged switches, faulty sockets, light replacement, and basic electrical maintenance.', calculator: 'electrical', keywords: ['electrical', 'switches', 'sockets', 'lights'], tasks: ['Switches', 'Sockets', 'Lights'] },
  { slug: 'door-window-repair', title: 'Door & Window Repair', summary: 'Broken locks, damaged hinges, frame repairs, and window replacement.', calculator: 'openings', keywords: ['doors', 'windows', 'locks', 'hinges'], tasks: ['Locks', 'Hinges', 'Frames', 'Windows'] },
  { slug: 'ceiling-repair', title: 'Ceiling Repair', summary: 'Cracks, damaged plaster, paint damage, and false-ceiling repairs.', calculator: 'ceiling', keywords: ['ceiling', 'false ceiling', 'cracks'], tasks: ['Cracks', 'Plaster', 'Paint', 'False ceiling'] },
  { slug: 'exterior-improvement', title: 'Exterior Improvement', summary: 'Boundary-wall painting, facade repainting, minor plaster repairs, and surface cleaning.', calculator: 'exterior', keywords: ['exterior', 'facade', 'boundary wall'], tasks: ['Boundary wall', 'Facade', 'Minor plaster', 'Cleaning'] },
  { slug: 'general-maintenance', title: 'General Maintenance', summary: 'Small household repairs and routine building maintenance.', calculator: 'general', keywords: ['maintenance', 'household repairs'], tasks: ['Small repairs', 'Routine maintenance'] },
];

export const SERVICE_FIELDS = {
  paint: [
    { key: 'wallAreaSqFt', label: 'Interior wall area', unit: 'sq ft' },
    { key: 'ceilingAreaSqFt', label: 'Ceiling area', unit: 'sq ft' },
    { key: 'exteriorWallSqFt', label: 'Exterior wall area', unit: 'sq ft' },
    { key: 'coats', label: 'Coats', defaultValue: 2 },
    { key: 'doors', label: 'Doors' },
    { key: 'windows', label: 'Windows' },
  ],
  plaster: [
    { key: 'lengthFt', label: 'Wall length', unit: 'ft' },
    { key: 'heightFt', label: 'Wall height', unit: 'ft' },
    { key: 'walls', label: 'Walls' },
    { key: 'areaSqFt', label: 'Or damaged area', unit: 'sq ft' },
  ],
  waterproofing: [
    { key: 'roofAreaSqFt', label: 'Roof or wall area', unit: 'sq ft' },
    { key: 'coats', label: 'Coats', defaultValue: 2 },
  ],
  bathroom: [
    { key: 'floorAreaSqFt', label: 'Bathroom floor area', unit: 'sq ft' },
    { key: 'taps', label: 'Taps to replace' },
    { key: 'coats', label: 'Waterproofing coats', defaultValue: 2 },
  ],
  kitchen: [
    { key: 'cabinetCount', label: 'Cabinets to repair' },
    { key: 'paintAreaSqFt', label: 'Area to repaint', unit: 'sq ft' },
    { key: 'counterSqFt', label: 'Countertop area', unit: 'sq ft' },
  ],
  tiles: [
    { key: 'floorAreaSqFt', label: 'Floor area', unit: 'sq ft' },
    { key: 'tileLengthIn', label: 'Tile length', unit: 'in', defaultValue: 24 },
    { key: 'tileWidthIn', label: 'Tile width', unit: 'in', defaultValue: 24 },
  ],
  plumbing: [
    { key: 'pipeLengthM', label: 'Pipe length', unit: 'm' },
    { key: 'fittings', label: 'Fittings' },
    { key: 'taps', label: 'Taps' },
  ],
  electrical: [
    { key: 'points', label: 'Switches, sockets, or lights' },
  ],
  openings: [
    { key: 'doors', label: 'Doors' },
    { key: 'windows', label: 'Windows' },
  ],
  ceiling: [
    { key: 'areaSqFt', label: 'Ceiling area', unit: 'sq ft' },
  ],
  exterior: [
    { key: 'exteriorWallSqFt', label: 'Exterior area', unit: 'sq ft' },
    { key: 'coats', label: 'Paint coats', defaultValue: 2 },
  ],
  general: [
    { key: 'taskCount', label: 'Number of small tasks', defaultValue: 1 },
    { key: 'areaSqFt', label: 'Area involved, if any', unit: 'sq ft' },
  ],
};

export const DEFAULT_LABOR_RULES = {
  'house-painting': { laborUnit: 'sq ft', labor: { economy: 18, standard: 28, premium: 42, luxury: 60 }, equipment: { economy: 3, standard: 4, premium: 6, luxury: 8 } },
  'wall-repair': { laborUnit: 'sq ft', labor: { economy: 30, standard: 48, premium: 70, luxury: 95 }, equipment: { economy: 6, standard: 10, premium: 14, luxury: 18 } },
  'roof-repair': { laborUnit: 'sq ft', labor: { economy: 40, standard: 65, premium: 90, luxury: 120 }, equipment: { economy: 8, standard: 14, premium: 20, luxury: 28 } },
  'bathroom-repair': { laborUnit: 'sq ft', labor: { economy: 35, standard: 55, premium: 80, luxury: 110 }, equipment: { economy: 8, standard: 12, premium: 18, luxury: 24 } },
  'kitchen-improvement': { laborUnit: 'cabinet', labor: { economy: 1500, standard: 2500, premium: 4000, luxury: 6000 }, equipment: { economy: 200, standard: 350, premium: 500, luxury: 800 } },
  'floor-repair': { laborUnit: 'sq ft', labor: { economy: 25, standard: 40, premium: 60, luxury: 85 }, equipment: { economy: 4, standard: 7, premium: 10, luxury: 14 } },
  'plumbing-repair': { laborUnit: 'point', labor: { economy: 800, standard: 1500, premium: 2200, luxury: 3000 }, equipment: { economy: 150, standard: 250, premium: 400, luxury: 600 } },
  'electrical-repair': { laborUnit: 'point', labor: { economy: 500, standard: 900, premium: 1400, luxury: 2000 }, equipment: { economy: 100, standard: 180, premium: 280, luxury: 400 } },
  'door-window-repair': { laborUnit: 'opening', labor: { economy: 700, standard: 1200, premium: 1800, luxury: 2500 }, equipment: { economy: 80, standard: 150, premium: 220, luxury: 300 } },
  'ceiling-repair': { laborUnit: 'sq ft', labor: { economy: 22, standard: 36, premium: 52, luxury: 75 }, equipment: { economy: 4, standard: 6, premium: 9, luxury: 12 } },
  'exterior-improvement': { laborUnit: 'sq ft', labor: { economy: 16, standard: 26, premium: 38, luxury: 55 }, equipment: { economy: 3, standard: 5, premium: 7, luxury: 10 } },
  'general-maintenance': { laborUnit: 'task', labor: { economy: 1500, standard: 2500, premium: 4000, luxury: 6000 }, equipment: { economy: 200, standard: 350, premium: 500, luxury: 700 } },
};

export const LABOR_RATE_SOURCE = 'Illustrative Islamabad repair planning rates for BuildRight, reviewed October 2026. Not a contractor quotation.';
