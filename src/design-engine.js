import { applySpecificationEdits, buildDxf, buildElevationSvg, buildIfc, buildPlanSvg as renderPlanSvg, buildSectionSvg, designQuantities, resizeRoom } from './cad/drawing.js';

const allowedTypes = ['House', 'Plaza', 'Shop', 'University', 'Office', 'Apartment', 'Road', 'Tunnel', 'Commercial Building', 'School', 'Hospital', 'Parking', 'Warehouse', 'Hotel', 'Restaurant', 'Factory', 'Landscape', 'Bridge'];
const allowedStyles = ['Modern', 'Contemporary', 'Traditional', 'Minimalist'];
const numberWords = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createDesignFromPrompt(prompt, previous = {}) {
  const text = prompt.toLowerCase();
  const config = {
    title: previous.title || titleFromPrompt(prompt),
    projectType: previous.projectType || 'House',
    width: previous.width || 18,
    depth: previous.depth || 14,
    floors: previous.floors || 2,
    unit: previous.unit || 'meters',
    style: previous.style || 'Modern',
    location: previous.location || 'Islamabad',
    budget: previous.budget || '',
    shopsPerFloor: previous.shopsPerFloor || 4,
    officesPerFloor: previous.officesPerFloor || 4,
    windowStyle: previous.windowStyle || 'Large glass',
    stairsPosition: previous.stairsPosition || 'right',
    costTier: previous.costTier || 'Premium',
    parking: previous.parking || false,
    garden: previous.garden || false,
    view: previous.view || 'Exterior',
    exteriorMaterial: previous.exteriorMaterial || 'concrete',
    lighting: previous.lighting || 'day',
    balconies: previous.balconies || false,
    roofUtility: previous.roofUtility || false,
  };

  const startsNewBrief = /^(?:design|create|build|plan|generate)\b/.test(text.trim());
  const typeChange = text.match(/\b(?:change|convert|switch)\b.{0,40}\b(?:to|into)\s+(?:a\s+)?(house|plaza|shop|university|office|apartment|road|tunnel|commercial building)\b/);
  const explicitType = [
    [/\bbridge\b/, 'Bridge'],
    [/\bwarehouse\b/, 'Warehouse'],
    [/\bfactory\b/, 'Factory'],
    [/\bhotel\b/, 'Hotel'],
    [/\brestaurant\b/, 'Restaurant'],
    [/\blandscape\b/, 'Landscape'],
    [/\bplaza\b/, 'Plaza'],
    [/\bhospital\b/, 'Hospital'],
    [/\bschool\b/, 'School'],
    [/\b(?:university|campus)\b/, 'University'],
    [/\bapartments?\b/, 'Apartment'],
    [/\boffice (?:building|tower|complex)\b/, 'Office'],
    [/\bcommercial building\b/, 'Commercial Building'],
    [/\b(?:shop|retail) building\b/, 'Shop'],
    [/\bparking (?:layout|lot|area)\b/, 'Parking'],
    [/\btunnel\b/, 'Tunnel'],
    [/\broad\b/, 'Road'],
    [/\b(?:house|villa)\b/, 'House'],
  ].find(([pattern]) => pattern.test(text))?.[1];
  const changeType = typeChange?.[1]?.replace(/\b\w/g, (character) => character.toUpperCase());
  const requestedType = changeType || explicitType;
  if (requestedType && (!previous.projectType || startsNewBrief || requestedType === previous.projectType || changeType)) {
    config.projectType = requestedType === 'Commercial Building' ? requestedType : requestedType[0].toUpperCase() + requestedType.slice(1);
  }

  const floorMatch = text.match(/(?:^|\D)(\d{1,2})\s*(?:-|to)?\s*(\d{1,2})?\s*(?:story|storey|floor)/);
  const floors = floorMatch ? Number(floorMatch[2] || floorMatch[1]) : text.match(/(?:add|make it|third|fourth)\s+(?:a\s+)?(third|fourth|\d+)\s+floor/);
  if (typeof floors === 'number' && Number.isFinite(floors)) config.floors = floors;
  else if (floors?.[1]) config.floors = floors[1] === 'third' ? 3 : floors[1] === 'fourth' ? 4 : Number(floors[1]);
  else if (/\bthird floor\b/.test(text)) config.floors = 3;
  else if (/\bfourth floor\b/.test(text)) config.floors = 4;
  else {
    const wordFloors = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)[-\s](?:story|storey|stories|storeys|floor)/);
    if (wordFloors) config.floors = numberWords[wordFloors[1]];
  }

  const dimensionMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:x|×|\*|by)\s*(\d+(?:\.\d+)?)(?:\s*(m|meter|meters|ft|feet|sq\.?\s*ft))?/);
  if (dimensionMatch) {
    config.width = Number(dimensionMatch[1]);
    config.depth = Number(dimensionMatch[2]);
    const unit = dimensionMatch[3]?.toLowerCase();
    if (unit?.startsWith('f')) config.unit = 'feet';
    else if (unit) config.unit = 'meters';
  }
  const assumptions = [];
  const questions = [];
  const marlaSize = text.match(/(\d+(?:\.\d+)?)\s*-?\s*marla/);
  const kanalSize = text.match(/(\d+(?:\.\d+)?)\s*-?\s*kanal/);
  if (!dimensionMatch && marlaSize) {
    const sqft = Number(marlaSize[1]) * 272.25;
    const depth = Math.sqrt(sqft / 1.25);
    config.depth = Math.round(depth * 10) / 10;
    config.width = Math.round(depth * 1.25 * 10) / 10;
    config.unit = 'feet';
    config.plotArea = Number(marlaSize[1]);
    config.plotUnit = 'marla';
    assumptions.push(`${marlaSize[1]} marla was converted at 272.25 sq ft per marla into an indicative ${config.width} × ${config.depth} ft footprint.`);
  } else if (!dimensionMatch && kanalSize) {
    const sqft = Number(kanalSize[1]) * 5445;
    const depth = Math.sqrt(sqft / 1.25);
    config.depth = Math.round(depth * 10) / 10;
    config.width = Math.round(depth * 1.25 * 10) / 10;
    config.unit = 'feet';
    config.plotArea = Number(kanalSize[1]);
    config.plotUnit = 'kanal';
    assumptions.push(`${kanalSize[1]} kanal was converted at 5,445 sq ft per kanal into an indicative ${config.width} × ${config.depth} ft footprint.`);
  } else if (/\bmarla\b/.test(text)) config.unit = 'marla';
  else if (/\bkanal\b/.test(text)) config.unit = 'kanal';
  if (/\bsquare meters?\b|\bsqm\b/.test(text)) config.unit = 'meters';
  if (/\bsquare feet\b|\bsq\.?\s*ft\b/.test(text)) config.unit = 'feet';

  const styleMatch = [...allowedStyles].reverse().find((style) => text.includes(style.toLowerCase()));
  if (styleMatch) config.style = styleMatch;
  if (text.includes('glass')) config.windowStyle = 'Large glass';
  if (text.includes('sliding')) config.windowStyle = 'Sliding';
  if (text.includes('parking')) config.parking = true;
  if (/\brooftop\b|\butility area\b/.test(text)) config.roofUtility = true;
  if (/\brenovation\b/.test(text)) config.renovation = true;
  if (text.includes('garden') || text.includes('landscap')) config.garden = true;
  if (text.includes('gilgit')) config.location = 'Gilgit-Baltistan';
  else if (text.includes('karachi')) config.location = 'Karachi';
  else if (text.includes('lahore')) config.location = 'Lahore';
  else if (text.includes('rawalpindi')) config.location = 'Rawalpindi';
  else if (text.includes('peshawar')) config.location = 'Peshawar';
  else if (text.includes('islamabad')) config.location = 'Islamabad';

  const unitCounts = text.matchAll(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(more\s+)?(shops?|offices?|classrooms?)\b/g);
  for (const unitCount of unitCounts) {
    const count = Number(unitCount[1]) || numberWords[unitCount[1]];
    const field = unitCount[3].startsWith('shop') ? 'shopsPerFloor' : 'officesPerFloor';
    const nextCount = unitCount[2] ? config[field] + count : count;
    config[field] = clamp(nextCount, 1, 12);
  }
  if (text.includes('interior')) config.view = 'Interior';
  if (text.includes('exterior')) config.view = 'Exterior';
  if (/window.{0,30}(?:larger|bigger|increase)/.test(text) || /(?:larger|bigger)\s+windows?/.test(text)) config.windowStyle = 'Large glass';
  if (/window.{0,30}small/.test(text)) config.windowStyle = 'Minimal';
  if (/staircase.{0,30}left|stairs?.{0,30}left/.test(text)) config.stairsPosition = 'left';
  else if (/staircase.{0,30}center|stairs?.{0,30}center/.test(text)) config.stairsPosition = 'center';
  else if (/change.{0,30}(?:staircase|stairs)|(?:staircase|stairs).{0,30}change/.test(text)) config.stairsPosition = config.stairsPosition === 'left' ? 'right' : 'left';
  if (text.includes('affordable') || text.includes('budget')) config.costTier = 'Economy';
  const counted = (pattern) => {
    const match = text.match(pattern);
    if (!match) return null;
    const value = Number(match[1]) || numberWords[match[1]];
    return Number.isFinite(value) ? value : null;
  };
  const bedrooms = counted(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+bedrooms?\b/);
  const bathrooms = counted(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:attached\s+)?bathrooms?\b/);
  if (bedrooms) config.bedrooms = clamp(bedrooms, 1, 12);
  if (bathrooms) config.bathrooms = clamp(bathrooms, 1, 12);
  else if (/attached bathrooms?/.test(text) && config.bedrooms) config.bathrooms = config.bedrooms;
  if (/\bbalcon/.test(text)) config.balconies = true;
  if (!dimensionMatch && !marlaSize && !kanalSize && !previous.width) {
    assumptions.push('No plot dimensions were provided, so a default 18 × 14 metre footprint was assumed.');
    questions.push('What are the plot width and depth, or the plot size in marla or kanal?');
  }

  config.layoutArchetype = previous.layoutArchetype || pickLayoutArchetype(text, config);
  config.width = clamp(Number(config.width) || 18, 6, 120);
  config.depth = clamp(Number(config.depth) || 14, 6, 120);
  config.floors = clamp(Number(config.floors) || 1, 1, 20);
  config.floorLayouts = Array.from({ length: config.floors }, (_, index) => makeRooms(config, index));
  config.rooms = config.floorLayouts[0];
  config.assumptions = assumptions;
  if (config.projectType === 'House' || config.projectType === 'Apartment') {
    assumptions.push(`Layout archetype: ${config.layoutArchetype.replace(/-/g, ' ')} (varied from the prompt, not a flat equal grid).`);
  }
  config.questions = questions;
  if (config.projectType === 'Bridge') assumptions.push('Bridge engineering is not generated. This is a linear deck concept, not a structural bridge design.');
  if (config.projectType === 'Landscape') assumptions.push('This is a site-zone concept, not a planting or grading plan.');
  if (config.renovation) assumptions.push('Renovation quantities assume the existing structure remains. No structural survey was provided.');
  applySpecificationEdits(config, text, previous);

  return config;
}

function titleFromPrompt(prompt) {
  const normalized = prompt.trim().replace(/\s+/g, ' ');
  return normalized ? `${normalized.slice(0, 36)}${normalized.length > 36 ? '…' : ''}` : 'Untitled Design';
}

/** Stable 0..n-1 pick from a string — same brief → same archetype, different briefs → different plans. */
function hashPick(seed, modulo) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % Math.max(1, modulo);
}

const HOUSE_ARCHETYPES = [
  'central-hall',
  'open-plan',
  'courtyard',
  'l-shape',
  'front-public',
  'split-wing',
  'linear-spine',
  'compact-core',
];

function pickLayoutArchetype(text, config) {
  if (/\bcourtyard\b|\batrium\b/.test(text)) return 'courtyard';
  if (/\bl[-\s]?shape\b|\bl shaped\b/.test(text)) return 'l-shape';
  if (/\bopen[\s-]?plan\b/.test(text)) return 'open-plan';
  if (/\bcentral (?:hall|corridor)\b|\btraditional\b/.test(text)) return 'central-hall';
  if (/\bsplit\b|\bwings?\b/.test(text)) return 'split-wing';
  if (config.style === 'Minimalist') return 'open-plan';
  if (config.style === 'Traditional') return 'central-hall';
  if (config.style === 'Contemporary') return 'front-public';
  const seed = `${config.projectType}|${config.style}|${config.bedrooms || 0}|${config.floors}|${text.slice(0, 80)}`;
  return HOUSE_ARCHETYPES[hashPick(seed, HOUSE_ARCHETYPES.length)];
}

function roomWeight(name) {
  const lower = name.toLowerCase();
  if (/living|lobby|dining|hall|storage hall/.test(lower)) return 2.4;
  if (/bedroom|guest|ward|classroom|shop|office|kitchen/.test(lower)) return 1.6;
  if (/parking|balcony|loading/.test(lower)) return 1.3;
  if (/bath|wash|stair|lift|elev|corridor|entry|service|emergency/.test(lower)) return 0.7;
  return 1;
}

function layoutNames(config, names, archetype = 'grid') {
  if (['House', 'Apartment'].includes(config.projectType) && archetype !== 'grid') {
    return layoutByArchetype(config, names, archetype);
  }
  return layoutWeightedGrid(config, names);
}

function layoutWeightedGrid(config, names) {
  let columns = 1;
  let bestScore = 0;
  for (let candidate = 1; candidate <= names.length; candidate += 1) {
    const rows = Math.ceil(names.length / candidate);
    const score = Math.min(config.width / candidate, config.depth / rows);
    if (score > bestScore) {
      bestScore = score;
      columns = candidate;
    }
  }
  const rows = Math.ceil(names.length / columns);
  const grid = Array.from({ length: rows }, () => Array.from({ length: columns }, () => null));
  names.forEach((name, index) => {
    grid[Math.floor(index / columns)][index % columns] = name;
  });
  const colWeights = Array.from({ length: columns }, (_, col) => {
    let sum = 0;
    let count = 0;
    for (let row = 0; row < rows; row += 1) {
      if (grid[row][col]) {
        sum += roomWeight(grid[row][col]);
        count += 1;
      }
    }
    return count ? sum / count : 1;
  });
  const rowWeights = Array.from({ length: rows }, (_, row) => {
    let sum = 0;
    let count = 0;
    for (let col = 0; col < columns; col += 1) {
      if (grid[row][col]) {
        sum += roomWeight(grid[row][col]);
        count += 1;
      }
    }
    return count ? sum / count : 1;
  });
  const colTotal = colWeights.reduce((a, b) => a + b, 0) || 1;
  const rowTotal = rowWeights.reduce((a, b) => a + b, 0) || 1;
  const colWidths = colWeights.map((weight) => (weight / colTotal) * config.width);
  const rowDepths = rowWeights.map((weight) => (weight / rowTotal) * config.depth);
  const rooms = [];
  let id = 1;
  let y = 0;
  for (let row = 0; row < rows; row += 1) {
    let x = 0;
    for (let col = 0; col < columns; col += 1) {
      const name = grid[row][col];
      if (name) {
        const onPerimeter = col === 0 || col === columns - 1 || row === 0 || row === rows - 1;
        rooms.push({
          id: `${id}`,
          name,
          x,
          y,
          width: colWidths[col],
          depth: rowDepths[row],
          door: name !== 'Balcony',
          window: onPerimeter || name === 'Balcony',
        });
        id += 1;
      }
      x += colWidths[col];
    }
    y += rowDepths[row];
  }
  return rooms;
}

function sortRoomsForArchetype(names, archetype) {
  const score = (name) => {
    const lower = name.toLowerCase();
    if (archetype === 'front-public' || archetype === 'open-plan') {
      if (/living|dining|lobby|entry/.test(lower)) return 0;
      if (/kitchen/.test(lower)) return 1;
      if (/bedroom/.test(lower)) return 3;
      if (/bath/.test(lower)) return 4;
      return 2;
    }
    if (archetype === 'central-hall' || archetype === 'linear-spine') {
      if (/stair|corridor|hall|entry/.test(lower)) return 0;
      if (/living|dining|kitchen/.test(lower)) return 1;
      if (/bedroom/.test(lower)) return 2;
      return 3;
    }
    if (/living|dining|kitchen/.test(lower)) return 0;
    if (/bedroom/.test(lower)) return 1;
    return 2;
  };
  return [...names].sort((a, b) => score(a) - score(b) || a.localeCompare(b));
}

function roomBox(id, name, x, y, width, depth, footprint) {
  const onPerimeter = x <= 0.05 || y <= 0.05 || x + width >= footprint.width - 0.05 || y + depth >= footprint.depth - 0.05;
  return {
    id: String(id),
    name,
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    width: Math.round(width * 100) / 100,
    depth: Math.round(depth * 100) / 100,
    door: name !== 'Balcony',
    window: onPerimeter || /balcony|living|bedroom/i.test(name),
  };
}

function packStrip(names, x, y, width, depth, startId, footprint, axis = 'x') {
  const weights = names.map(roomWeight);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const rooms = [];
  let cursor = 0;
  let id = startId;
  names.forEach((name, index) => {
    const share = weights[index] / total;
    if (axis === 'x') {
      const w = width * share;
      rooms.push(roomBox(id, name, x + cursor, y, w, depth, footprint));
      cursor += w;
    } else {
      const d = depth * share;
      rooms.push(roomBox(id, name, x, y + cursor, width, d, footprint));
      cursor += d;
    }
    id += 1;
  });
  return { rooms, nextId: id };
}

function layoutByArchetype(config, names, archetype) {
  const ordered = sortRoomsForArchetype(names, archetype);
  const footprint = { width: config.width, depth: config.depth };
  const publicRooms = ordered.filter((name) => /living|dining|kitchen|lobby|entry|hall/i.test(name));
  const privateRooms = ordered.filter((name) => /bedroom|bath|guest/i.test(name));
  const serviceRooms = ordered.filter((name) => !publicRooms.includes(name) && !privateRooms.includes(name));
  const W = config.width;
  const D = config.depth;

  if (archetype === 'courtyard' && ordered.length >= 4) {
    const courtW = W * 0.28;
    const courtD = D * 0.28;
    const courtX = (W - courtW) / 2;
    const courtY = (D - courtD) / 2;
    const band = ordered.filter((name) => !/stair|corridor/i.test(name));
    const top = band.slice(0, Math.ceil(band.length / 4));
    const right = band.slice(top.length, top.length + Math.ceil(band.length / 4));
    const bottom = band.slice(top.length + right.length, top.length + right.length + Math.ceil(band.length / 4));
    const left = band.slice(top.length + right.length + bottom.length);
    const services = ordered.filter((name) => /stair|corridor/i.test(name));
    let id = 1;
    const rooms = [roomBox(id, 'Courtyard', courtX, courtY, courtW, courtD, footprint)];
    id += 1;
    let pack = packStrip(top.length ? top : ['Living Room'], 0, 0, W, courtY, id, footprint, 'x');
    rooms.push(...pack.rooms);
    id = pack.nextId;
    pack = packStrip(right.length ? right : privateRooms.slice(0, 1), courtX + courtW, courtY, W - courtX - courtW, courtD, id, footprint, 'y');
    rooms.push(...pack.rooms);
    id = pack.nextId;
    pack = packStrip(bottom.length ? bottom : publicRooms.slice(0, 1), 0, courtY + courtD, W, D - courtY - courtD, id, footprint, 'x');
    rooms.push(...pack.rooms);
    id = pack.nextId;
    pack = packStrip([...left, ...services].length ? [...left, ...services] : serviceRooms, 0, courtY, courtX, courtD, id, footprint, 'y');
    rooms.push(...pack.rooms);
    return rooms;
  }

  if (archetype === 'l-shape' && ordered.length >= 3) {
    const wingW = W * 0.55;
    const wingD = D * 0.45;
    const main = ordered.slice(0, Math.ceil(ordered.length * 0.55));
    const wing = ordered.slice(main.length);
    let pack = packStrip(main, 0, 0, W, wingD, 1, footprint, 'x');
    const rooms = [...pack.rooms];
    pack = packStrip(wing.length ? wing : ['Bedroom 1'], 0, wingD, wingW, D - wingD, pack.nextId, footprint, 'y');
    rooms.push(...pack.rooms);
    return rooms;
  }

  if (archetype === 'open-plan') {
    const living = ordered.find((name) => /living/i.test(name)) || ordered[0];
    const rest = ordered.filter((name) => name !== living);
    const livingDepth = D * 0.42;
    const rooms = [roomBox(1, living, 0, 0, W, livingDepth, footprint)];
    const pack = packStrip(rest, 0, livingDepth, W, D - livingDepth, 2, footprint, 'x');
    return [...rooms, ...pack.rooms];
  }

  if (archetype === 'central-hall' || archetype === 'linear-spine' || archetype === 'compact-core') {
    const hallName = ordered.find((name) => /stair|corridor|hall|entry/i.test(name)) || 'Hall';
    const rest = ordered.filter((name) => name !== hallName);
    const hallW = Math.min(W * 0.22, archetype === 'compact-core' ? W * 0.18 : W * 0.28);
    const hallX = (W - hallW) / 2;
    const left = rest.slice(0, Math.ceil(rest.length / 2));
    const right = rest.slice(left.length);
    const rooms = [roomBox(1, hallName, hallX, 0, hallW, D, footprint)];
    let pack = packStrip(left.length ? left : ['Living Room'], 0, 0, hallX, D, 2, footprint, 'y');
    rooms.push(...pack.rooms);
    pack = packStrip(right.length ? right : ['Bedroom 1'], hallX + hallW, 0, W - hallX - hallW, D, pack.nextId, footprint, 'y');
    rooms.push(...pack.rooms);
    return rooms;
  }

  if (archetype === 'split-wing') {
    const mid = Math.ceil(ordered.length / 2);
    const left = ordered.slice(0, mid);
    const right = ordered.slice(mid);
    let pack = packStrip(left, 0, 0, W * 0.48, D, 1, footprint, 'y');
    const rooms = [...pack.rooms];
    rooms.push(roomBox(pack.nextId, 'Circulation', W * 0.48, 0, W * 0.04, D, footprint));
    pack = packStrip(right.length ? right : ['Bedroom 1'], W * 0.52, 0, W * 0.48, D, pack.nextId + 1, footprint, 'y');
    rooms.push(...pack.rooms);
    return rooms;
  }

  // front-public: public strip at front, private at rear
  const front = publicRooms.length ? publicRooms : ordered.slice(0, Math.ceil(ordered.length / 2));
  const rear = [...privateRooms, ...serviceRooms].filter((name) => !front.includes(name));
  const rearList = rear.length ? rear : ordered.slice(front.length);
  const frontDepth = D * 0.4;
  let pack = packStrip(front, 0, 0, W, frontDepth, 1, footprint, 'x');
  const rooms = [...pack.rooms];
  pack = packStrip(rearList.length ? rearList : ['Bedroom 1'], 0, frontDepth, W, D - frontDepth, pack.nextId, footprint, 'x');
  rooms.push(...pack.rooms);
  return rooms;
}

function houseRoomNames(config, floorIndex = 0) {
  const bedCount = config.bedrooms || 2;
  const bathCount = config.bathrooms || 1;
  const names = floorIndex === 0
    ? ['Living Room', 'Kitchen', 'Dining Room']
    : ['Family Lounge', 'Study'];
  for (let index = 1; index <= bedCount; index += 1) names.push(`Bedroom ${index}`);
  for (let index = 1; index <= bathCount; index += 1) names.push(`Bathroom ${index}`);
  if (config.floors > 1) names.push('Staircase');
  if (config.balconies) names.push('Balcony');
  if (config.parking && floorIndex === 0) names.push('Parking');
  return names;
}

function makeRooms(config, floorIndex = 0) {
  if (['Road', 'Tunnel', 'Parking', 'Landscape', 'Bridge'].includes(config.projectType)) {
    return Array.from({ length: 4 }, (_, index) => ({
      id: `${index + 1}`,
      name: config.projectType === 'Road' ? `Road section ${index + 1}` : config.projectType === 'Parking' ? `Parking bay ${index + 1}` : config.projectType === 'Bridge' ? `Deck segment ${index + 1}` : config.projectType === 'Landscape' ? `Landscape zone ${index + 1}` : `Tunnel section ${index + 1}`,
      x: (config.width / 4) * index,
      y: 0,
      width: config.width / 4,
      depth: config.depth,
      door: false,
      window: false,
    }));
  }

  if (config.projectType === 'House' || config.projectType === 'Apartment') {
    return layoutNames(config, houseRoomNames(config, floorIndex), config.layoutArchetype || 'front-public');
  }

  if (config.projectType === 'Warehouse' || config.projectType === 'Factory') {
    return layoutNames(config, ['Loading bay', 'Storage hall', 'Office', 'Washroom', 'Circulation']);
  }
  if (config.projectType === 'Hotel') {
    return layoutNames(config, ['Lobby', 'Guest room 1', 'Guest room 2', 'Guest room 3', 'Corridor', 'Staircase', 'Lift', 'Washroom']);
  }
  if (config.projectType === 'Restaurant') {
    return layoutNames(config, ['Dining', 'Kitchen', 'Service', 'Washroom', 'Entry']);
  }

  const isCommercial = ['Plaza', 'Shop', 'Office', 'Commercial Building', 'University', 'School', 'Hospital'].includes(config.projectType);
  const commercialRoomPrefix = config.projectType === 'Shop' || (config.projectType === 'Plaza' && floorIndex === 0)
    ? 'Shop'
    : config.projectType === 'University' || config.projectType === 'School'
      ? 'Classroom'
      : config.projectType === 'Hospital'
        ? 'Ward'
        : 'Office';
  const names = isCommercial
    ? [
      ...Array.from({ length: commercialRoomPrefix === 'Shop' ? config.shopsPerFloor : config.officesPerFloor }, (_, index) => `${commercialRoomPrefix} ${index + 1}`),
      'Corridor',
      'Staircase',
      'Elevator',
      'Washroom',
      'Emergency Exit',
    ]
    : ['Living Room', 'Kitchen', 'Bedroom 1', 'Bathroom', 'Bedroom 2', 'Dining Room'];

  return layoutNames(config, names);
}

export function validateDesign(config) {
  if (!config || typeof config !== 'object') throw new Error('Please provide design details.');
  if (!Number.isFinite(Number(config.width)) || Number(config.width) < 6 || Number(config.width) > 120) {
    throw new Error('Building width must be between 6 and 120 metres/feet.');
  }
  if (!Number.isFinite(Number(config.depth)) || Number(config.depth) < 6 || Number(config.depth) > 120) {
    throw new Error('Building depth must be between 6 and 120 metres/feet.');
  }
  if (!Number.isInteger(Number(config.floors)) || Number(config.floors) < 1 || Number(config.floors) > 20) {
    throw new Error('Floor count must be a whole number from 1 to 20.');
  }
}

export function buildPlanSvg(config, floor = 0) {
  validateDesign(config);
  return renderPlanSvg(config, floor);
}

export { buildDxf, buildElevationSvg, buildIfc, buildSectionSvg, designQuantities, resizeRoom };
