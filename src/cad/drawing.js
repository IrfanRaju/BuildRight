const MIN_ROOM = { feet: 7, meters: 2.1 };

function round(value) {
  return Math.round(value * 1000) / 1000;
}

export function unitToMeters(value, unit) {
  if (unit === 'feet') return value * 0.3048;
  return value;
}

export function buildDrawing(config, floor = 0) {
  const rooms = (config.floorLayouts?.[floor] || config.rooms || []).map((room) => ({
    ...room,
    x: Number(room.x) || 0,
    y: Number(room.y) || 0,
    width: Number(room.width) || 0,
    depth: Number(room.depth) || 0,
  }));
  const unit = config.unit === 'feet' ? 'feet' : 'meters';
  const wallThickness = unit === 'feet' ? 0.75 : 0.23;
  const floorHeight = unit === 'feet' ? 11 : 3.2;
  const walls = [];
  const seen = new Set();
  const addWall = (x1, y1, x2, y2, kind) => {
    if (Math.hypot(x2 - x1, y2 - y1) < 0.05) return;
    const key = [x1, y1, x2, y2].map((value) => value.toFixed(3)).join(':');
    const reverse = [x2, y2, x1, y1].map((value) => value.toFixed(3)).join(':');
    if (seen.has(key) || seen.has(reverse)) return;
    seen.add(key);
    walls.push({ x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2), thickness: wallThickness, kind });
  };

  addWall(0, 0, config.width, 0, 'external');
  addWall(config.width, 0, config.width, config.depth, 'external');
  addWall(config.width, config.depth, 0, config.depth, 'external');
  addWall(0, config.depth, 0, 0, 'external');
  for (const room of rooms) {
    addWall(room.x, room.y, room.x + room.width, room.y, 'internal');
    addWall(room.x + room.width, room.y, room.x + room.width, room.y + room.depth, 'internal');
    addWall(room.x + room.width, room.y + room.depth, room.x, room.y + room.depth, 'internal');
    addWall(room.x, room.y + room.depth, room.x, room.y, 'internal');
  }

  const doorWidth = unit === 'feet' ? 3 : 0.9;
  const windowWidth = unit === 'feet' ? 4 : 1.2;
  const openings = [];
  for (const room of rooms) {
    const name = room.name.toLowerCase();
    if (/stair/.test(name)) openings.push({ type: 'stair', room: room.name, x: room.x + room.width / 2, y: room.y + room.depth / 2, width: doorWidth });
    if (/elev|lift/.test(name)) openings.push({ type: 'lift', room: room.name, x: room.x + room.width / 2, y: room.y + room.depth / 2, width: doorWidth });
    if (room.door) openings.push({ type: 'door', room: room.name, x: room.x + Math.min(room.width * 0.72, room.width - doorWidth / 2), y: room.y + room.depth, width: Math.min(doorWidth, room.width * 0.45), orientation: 'h' });
    if (room.window) {
      const onTop = room.y <= 0.05;
      const onLeft = room.x <= 0.05;
      const onRight = Math.abs(room.x + room.width - config.width) < 0.08;
      const onBottom = Math.abs(room.y + room.depth - config.depth) < 0.08;
      if (onTop || onBottom) openings.push({ type: 'window', room: room.name, x: room.x + room.width / 2, y: onTop ? room.y : room.y + room.depth, width: Math.min(windowWidth, room.width * 0.55), orientation: 'h' });
      else if (onLeft || onRight) openings.push({ type: 'window', room: room.name, x: onLeft ? room.x : room.x + room.width, y: room.y + room.depth / 2, width: Math.min(windowWidth, room.depth * 0.45), orientation: 'v' });
    }
  }

  const warnings = [];
  const errors = [];
  const minimum = MIN_ROOM[unit];
  for (const room of rooms) {
    if (room.width < minimum || room.depth < minimum) {
      warnings.push(`${room.name} on floor ${floor + 1} is below ${minimum} ${unit} in one direction. Treat it as a planning cell, not a compliant room.`);
    }
    if (room.x < -0.01 || room.y < -0.01 || room.x + room.width > config.width + 0.05 || room.y + room.depth > config.depth + 0.05) {
      errors.push(`${room.name} extends outside the building footprint.`);
    }
  }
  for (let index = 0; index < rooms.length; index += 1) {
    for (let other = index + 1; other < rooms.length; other += 1) {
      const a = rooms[index];
      const b = rooms[other];
      const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.05
        && Math.min(a.y + a.depth, b.y + b.depth) - Math.max(a.y, b.y) > 0.05;
      if (overlap) errors.push(`${a.name} overlaps ${b.name}.`);
    }
  }
  if (!walls.length) errors.push('No wall geometry was produced.');

  return {
    floor,
    unit,
    width: Number(config.width),
    depth: Number(config.depth),
    wallThickness,
    floorHeight,
    rooms,
    walls,
    openings,
    warnings,
    errors,
  };
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character]);
}

function mapPoint(x, y, origin, scale) {
  return [origin.x + x * scale, origin.y + y * scale];
}

function formatSheetLength(value, unit) {
  if (unit === 'feet') {
    const totalInches = Math.round(value * 12);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}'-${inches}"`;
  }
  return `${Number(value).toFixed(2)} m`;
}

function line(x1, y1, x2, y2, width = 1.2) {
  return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#111" stroke-width="${width}" fill="none"/>`;
}

function furniture(room, origin, scale) {
  const name = room.name.toLowerCase();
  const [x, y] = mapPoint(room.x, room.y, origin, scale);
  const w = room.width * scale;
  const h = room.depth * scale;
  if (w < 36 || h < 28) return '';
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (/kitchen/.test(name)) {
    return `${line(x + 8, y + 10, x + w * 0.72, y + 10, 1)}${line(x + 8, y + 18, x + w * 0.72, y + 18, 0.6)}${line(x + 8, y + 10, x + 8, y + h * 0.55, 1)}`;
  }
  if (/dining/.test(name)) {
    return `<rect x="${cx - w * 0.18}" y="${cy - h * 0.12}" width="${w * 0.36}" height="${h * 0.24}" fill="none" stroke="#111"/>${line(cx - w * 0.22, cy, cx - w * 0.3, cy, 1)}`;
  }
  if (/bed/.test(name)) {
    return `<rect x="${x + w * 0.22}" y="${y + h * 0.28}" width="${w * 0.56}" height="${h * 0.5}" fill="none" stroke="#111"/>${line(x + w * 0.22, y + h * 0.4, x + w * 0.78, y + h * 0.4, 0.8)}`;
  }
  if (/living|lounge/.test(name)) {
    return `<rect x="${x + w * 0.55}" y="${y + 14}" width="${Math.min(54, w * 0.28)}" height="14" fill="none" stroke="#111"/><rect x="${x + w - 28}" y="${y + h * 0.38}" width="14" height="${Math.min(48, h * 0.28)}" fill="none" stroke="#111"/><circle cx="${cx + w * 0.12}" cy="${cy + h * 0.12}" r="8" fill="none" stroke="#111"/>`;
  }
  if (/bath|toilet|wash/.test(name)) {
    return `<ellipse cx="${cx}" cy="${cy + 4}" rx="7" ry="10" fill="none" stroke="#111"/>${line(cx - 8, cy - 12, cx + 8, cy - 12, 1)}`;
  }
  if (/stair/.test(name)) {
    const steps = Array.from({ length: 6 }, (_, index) => line(x + 8, y + 10 + index * ((h - 20) / 6), x + w - 8, y + 10 + index * ((h - 20) / 6), 0.7)).join('');
    return `${steps}<text x="${cx}" y="${cy}" text-anchor="middle" font-family="Arial,sans-serif" font-size="10">UP</text>`;
  }
  if (/bar/.test(name)) {
    return `<path d="M ${x + 8} ${cy} Q ${cx} ${y + 8} ${x + w - 8} ${cy}" fill="none" stroke="#111"/>`;
  }
  return '';
}

export function buildPlanSvg(config, floor = 0) {
  const drawing = buildDrawing(config, floor);
  const sheetWidth = 1280;
  const sheetHeight = 900;
  const origin = { x: 210, y: 150 };
  const scale = Math.min(820 / Math.max(config.width, 1), 560 / Math.max(config.depth, 1));
  const pt = (x, y) => mapPoint(x, y, origin, scale);
  const [x0, y0] = pt(0, 0);
  const [x1, y1] = pt(config.width, config.depth);
  const thickness = Math.max(drawing.wallThickness, 8 / scale);

  const unique = (values) => [...new Set(values.map((value) => Number(value.toFixed(3))))].sort((a, b) => a - b);
  const xs = unique([0, config.width, ...drawing.rooms.flatMap((room) => [room.x, room.x + room.width])]);
  const ys = unique([0, config.depth, ...drawing.rooms.flatMap((room) => [room.y, room.y + room.depth])]);

  const dimensionChain = (coords, side, offset, overall = false) => {
    const use = overall ? [coords[0], coords[coords.length - 1]] : coords;
    const horizontal = side === 'top' || side === 'bottom';
    const parts = [];
    const tick = (px, py) => parts.push(line(px - 3, py - 3, px + 3, py + 3, 0.8));
    const place = (value) => (horizontal ? pt(value, 0)[0] : pt(0, value)[1]);
    const along = (value) => {
      if (side === 'bottom') return y1 + offset;
      if (side === 'top') return y0 - offset;
      if (side === 'left') return x0 - offset;
      return x1 + offset;
    };
    for (let index = 0; index < use.length; index += 1) {
      const position = place(use[index]);
      const at = along(use[index]);
      if (horizontal) {
        parts.push(line(position, side === 'bottom' ? y1 : y0, position, side === 'bottom' ? at + 6 : at - 6, 0.55));
        tick(position, at);
      } else {
        parts.push(line(side === 'left' ? x0 : x1, position, side === 'left' ? at - 6 : at + 6, position, 0.55));
        tick(at, position);
      }
      if (index === 0) continue;
      const start = place(use[index - 1]);
      const label = formatSheetLength(use[index] - use[index - 1], drawing.unit);
      if (horizontal) {
        parts.push(line(start, at, position, at, 0.8));
        parts.push(`<text x="${(start + position) / 2}" y="${side === 'bottom' ? at - 5 : at + 14}" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#111">${label}</text>`);
      } else {
        const mid = (start + position) / 2;
        const textX = side === 'left' ? at - 8 : at + 8;
        parts.push(line(at, start, at, position, 0.8));
        parts.push(`<text x="${textX}" y="${mid}" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#111" transform="rotate(-90 ${textX} ${mid})">${label}</text>`);
      }
    }
    return parts.join('');
  };

  const wallLines = drawing.walls.map((wall) => {
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const length = Math.hypot(dx, dy) || 1;
    const ox = (-dy / length) * thickness / 2;
    const oy = (dx / length) * thickness / 2;
    const stroke = wall.kind === 'external' ? 1.6 : 1.05;
    const a = pt(wall.x1 + ox, wall.y1 + oy);
    const b = pt(wall.x2 + ox, wall.y2 + oy);
    const c = pt(wall.x1 - ox, wall.y1 - oy);
    const d = pt(wall.x2 - ox, wall.y2 - oy);
    return line(...a, ...b, stroke) + line(...c, ...d, stroke);
  }).join('');

  const junctions = uniquePoints(drawing.walls);
  const columns = junctions.map(([x, y]) => {
    const [px, py] = pt(x, y);
    const size = Math.max(5, thickness * scale * 1.15);
    return `<rect x="${px - size / 2}" y="${py - size / 2}" width="${size}" height="${size}" fill="#111"/>`;
  }).join('');

  let windowNumber = 0;
  let doorNumber = 0;
  const openings = drawing.openings.map((opening) => {
    const [px, py] = pt(opening.x, opening.y);
    const span = opening.width * scale;
    const band = Math.max(7, thickness * scale * 1.8);
    if (opening.type === 'window') {
      windowNumber += 1;
      const tag = `W${windowNumber}`;
      if (opening.orientation === 'v') {
        return `<rect x="${px - band / 2}" y="${py - span / 2}" width="${band}" height="${span}" fill="#fff"/>${line(px - 2, py - span / 2, px - 2, py + span / 2, 0.7)}${line(px, py - span / 2, px, py + span / 2, 0.7)}${line(px + 2, py - span / 2, px + 2, py + span / 2, 0.7)}<circle cx="${px - 16}" cy="${py}" r="8" fill="#fff" stroke="#111"/><text x="${px - 16}" y="${py + 3}" text-anchor="middle" font-family="Arial,sans-serif" font-size="8">${tag}</text>`;
      }
      return `<rect x="${px - span / 2}" y="${py - band / 2}" width="${span}" height="${band}" fill="#fff"/>${line(px - span / 2, py - 2, px + span / 2, py - 2, 0.7)}${line(px - span / 2, py, px + span / 2, py, 0.7)}${line(px - span / 2, py + 2, px + span / 2, py + 2, 0.7)}<circle cx="${px}" cy="${py - 16}" r="8" fill="#fff" stroke="#111"/><text x="${px}" y="${py - 13}" text-anchor="middle" font-family="Arial,sans-serif" font-size="8">${tag}</text>`;
    }
    if (opening.type !== 'door') return '';
    doorNumber += 1;
    const radius = span * 0.85;
    return `<rect x="${px - span / 2}" y="${py - band / 2}" width="${span}" height="${band}" fill="#fff"/>${line(px - span / 2, py, px - span / 2, py - radius, 1)}<path d="M ${px - span / 2} ${py - radius} A ${radius} ${radius} 0 0 1 ${px - span / 2 + radius} ${py}" fill="none" stroke="#111" stroke-width="0.8"/><text x="${px}" y="${py + 14}" text-anchor="middle" font-family="Arial,sans-serif" font-size="9">D${doorNumber}</text>`;
  }).join('');

  const labels = drawing.rooms.map((room) => {
    const [x, y] = pt(room.x + room.width / 2, room.y + room.depth / 2);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="15" fill="#111">${escapeXml(room.name)}</text>${furniture(room, origin, scale)}`;
  }).join('');

  const dimensions = `${dimensionChain(xs, 'bottom', 28)}${dimensionChain(xs, 'bottom', 62, true)}${dimensionChain(xs, 'top', 28)}${dimensionChain(ys, 'left', 34)}${dimensionChain(ys, 'left', 70, true)}${dimensionChain(ys, 'right', 34)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth}" height="${sheetHeight}" viewBox="0 0 ${sheetWidth} ${sheetHeight}"><rect width="100%" height="100%" fill="#fff"/><g id="floor-plan">${dimensions}<text x="${sheetWidth - 48}" y="36" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="700">N</text><path d="M ${sheetWidth - 56} 44 l 8 -14 l 8 14" fill="none" stroke="#111" stroke-width="1.3"/>${wallLines}${openings}${columns}${labels}<text x="36" y="${sheetHeight - 24}" font-family="Arial,sans-serif" font-size="11" fill="#111">Floor ${floor + 1} · ${config.width} ${drawing.unit} by ${config.depth} ${drawing.unit} · Wall thickness ${drawing.wallThickness} ${drawing.unit}. Concept drawing, not a permit set.</text></g></svg>`;
}

function uniquePoints(walls) {
  const seen = new Set();
  const points = [];
  for (const wall of walls) {
    for (const point of [[wall.x1, wall.y1], [wall.x2, wall.y2]]) {
      const key = point.map((value) => value.toFixed(2)).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      points.push(point);
    }
  }
  return points;
}

export function buildElevationSvg(config) {
  const drawing = buildDrawing(config, 0);
  const width = 1100;
  const height = 640;
  const scale = Math.min(860 / config.width, 420 / (drawing.floorHeight * config.floors));
  const x0 = 80;
  const yBase = 500;
  const floors = Array.from({ length: config.floors }, (_, index) => {
    const y = yBase - (index + 1) * drawing.floorHeight * scale;
    const windows = Math.max(2, Math.round(config.width / (config.unit === 'feet' ? 12 : 4)));
    const glass = Array.from({ length: windows }, (__, pane) => `<rect x="${x0 + ((pane + 0.35) * config.width * scale) / windows}" y="${y + drawing.floorHeight * scale * 0.28}" width="${Math.max(8, config.width * scale / windows * 0.45)}" height="${drawing.floorHeight * scale * 0.42}" fill="#bae6fd" stroke="#0f172a"/>`).join('');
    return `<g><rect x="${x0}" y="${y}" width="${config.width * scale}" height="${drawing.floorHeight * scale}" fill="${index % 2 ? '#e7e5e4' : '#f5f5f4'}" stroke="#111827"/>${glass}<text x="${x0 + 8}" y="${y + 16}" font-size="11" font-family="Arial">Floor ${index + 1}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/><text x="36" y="36" font-family="Arial,sans-serif" font-size="18" font-weight="700">${escapeXml(config.title || 'BuildRight')} — Front elevation</text><line x1="${x0}" y1="${yBase}" x2="${x0 + config.width * scale}" y2="${yBase}" stroke="#111827" stroke-width="3"/>${floors}<text x="36" y="580" font-family="Arial,sans-serif" font-size="12">Overall width ${config.width} ${escapeXml(drawing.unit)} · Floor to floor ${drawing.floorHeight} ${escapeXml(drawing.unit)} · ${config.floors} floors</text></svg>`;
}

export function buildSectionSvg(config) {
  const elevation = buildElevationSvg(config).replace('Front elevation', 'Cross section').replace('Overall width', 'Section width');
  return elevation;
}

function dxfPair(code, value) {
  return `${code}\n${value}\n`;
}

export function buildDxf(config, floor = 0) {
  const drawing = buildDrawing(config, floor);
  const units = drawing.unit === 'feet' ? 2 : 6;
  let body = '0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n' + units + '\n0\nENDSEC\n';
  body += '0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n6\n';
  for (const layer of ['A-WALL-EXTR', 'A-WALL-INTR', 'A-DOOR', 'A-GLAZ', 'A-DIMS', 'A-ANNO']) {
    body += `0\nLAYER\n2\n${layer}\n70\n0\n62\n7\n6\nCONTINUOUS\n`;
  }
  body += '0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
  const line = (layer, x1, y1, x2, y2) => {
    body += dxfPair(0, 'LINE') + dxfPair(8, layer) + dxfPair(10, x1) + dxfPair(20, y1) + dxfPair(30, 0) + dxfPair(11, x2) + dxfPair(21, y2) + dxfPair(31, 0);
  };
  const text = (layer, x, y, value) => {
    body += dxfPair(0, 'TEXT') + dxfPair(8, layer) + dxfPair(10, x) + dxfPair(20, y) + dxfPair(30, 0) + dxfPair(40, drawing.unit === 'feet' ? 1.2 : 0.35) + dxfPair(1, value);
  };
  for (const wall of drawing.walls) line(wall.kind === 'external' ? 'A-WALL-EXTR' : 'A-WALL-INTR', wall.x1, wall.y1, wall.x2, wall.y2);
  line('A-DIMS', 0, -1.2, config.width, -1.2);
  text('A-DIMS', config.width / 2, -2.2, `${config.width} ${drawing.unit}`);
  for (const room of drawing.rooms) text('A-ANNO', room.x + 0.2, room.y + room.depth / 2, room.name);
  for (const opening of drawing.openings) {
    if (opening.type === 'door') line('A-DOOR', opening.x - opening.width / 2, opening.y, opening.x + opening.width / 2, opening.y);
    if (opening.type === 'window') line('A-GLAZ', opening.x - opening.width / 2, opening.y, opening.x + opening.width / 2, opening.y);
  }
  body += '0\nENDSEC\n0\nEOF\n';
  return body;
}

export function buildIfc(config, floor = 0) {
  const drawing = buildDrawing(config, floor);
  const lines = [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('BuildRight simplified coordination view'),'2;1');",
    "FILE_NAME('buildright.ifc','2026-01-15',('BuildRight'),('BuildRight'),'BuildRight CAD adapter','BuildRight','');",
    "FILE_SCHEMA(('IFC2X3'));",
    'ENDSEC;',
    'DATA;',
    "#1=IFCPROJECT('0Q2gProject',$,'BuildRight project',$,$,$,$,(#2),#3);",
    '#2=IFCUNITASSIGNMENT((#4));',
    '#4=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);',
    '#3=IFCGEOMETRICREPRESENTATIONCONTEXT($,\'Model\',3,1.0E-5,#5,$);',
    '#5=IFCAXIS2PLACEMENT3D(#6,$,$);',
    '#6=IFCCARTESIANPOINT((0.,0.,0.));',
    "#7=IFCSITE('0Q2gSite',$,'Site',$,$,#5,$,$,.ELEMENT.,$,$,$,$,$);",
    "#8=IFCBUILDING('0Q2gBuilding',$,'Building',$,$,#5,$,$,.ELEMENT.,$,$,$);",
    `#9=IFCBUILDINGSTOREY('0Q2gStorey',$,'Floor ${floor + 1}',$,$,#5,$,$,.ELEMENT.,0.);`,
  ];
  drawing.walls.forEach((wall, index) => {
    const id = 20 + index;
    const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1).toFixed(3);
    lines.push(`#${id}=IFCWALL('${id}Wall',$,'Wall ${index + 1}','${wall.kind} wall length ${length} ${drawing.unit}',$,#5,$,$);`);
  });
  lines.push('ENDSEC;', 'END-ISO-10303-21;');
  return lines.join('\n');
}

export function designQuantities(config) {
  const drawing = buildDrawing(config, 0);
  const wallLength = drawing.walls.reduce((sum, wall) => sum + Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1), 0);
  const footprint = Number(config.width) * Number(config.depth);
  const builtUp = footprint * Number(config.floors || 1);
  const toSqFt = config.unit === 'feet' ? 1 : 10.7639;
  return {
    unit: config.unit,
    footprint,
    builtUp,
    builtUpSqFt: Math.round(builtUp * toSqFt),
    wallLength: round(wallLength),
    wallArea: round(wallLength * drawing.floorHeight * config.floors),
    floorHeight: drawing.floorHeight,
    warnings: drawing.warnings,
    errors: drawing.errors,
    missing: [
      'Structural member sizes are not in the concept model, so beam, column, and foundation quantities are not calculated.',
      'Opening schedules are diagrammatic. Door and window counts should be confirmed before pricing.',
    ],
  };
}

export function resizeRoom(config, roomName, axis, value) {
  if (!config?.floorLayouts) throw new Error('Generate a design before editing a room.');
  const key = axis === 'depth' ? 'depth' : 'width';
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 2) throw new Error('Enter a room size of at least 2.');
  const target = config.floorLayouts.flat().find((room) => room.name === roomName);
  if (!target) throw new Error(`No room named ${roomName} is in this model.`);
  const delta = round(numeric - Number(target[key]));
  const edge = key === 'width' ? target.x + target.width : target.y + target.depth;
  const next = {
    ...config,
    floorLayouts: config.floorLayouts.map((floorRooms) => floorRooms.map((room) => {
      const sameCell = room.name === roomName && Math.abs(room.x - target.x) < 0.05 && Math.abs(room.y - target.y) < 0.05;
      if (sameCell) return { ...room, [key]: numeric };
      if (key === 'width' && room.x >= edge - 0.05) return { ...room, x: round(room.x + delta) };
      if (key === 'depth' && room.y >= edge - 0.05) return { ...room, y: round(room.y + delta) };
      return { ...room };
    })),
    width: key === 'width' ? round(Number(config.width) + delta) : config.width,
    depth: key === 'depth' ? round(Number(config.depth) + delta) : config.depth,
  };
  next.rooms = next.floorLayouts[0];
  if (next.width < 6 || next.width > 120 || next.depth < 6 || next.depth > 120) {
    throw new Error('That edit pushes the building outside the supported 6 to 120 range.');
  }
  const drawing = buildDrawing(next, 0);
  next.validation = { warnings: drawing.warnings, errors: drawing.errors };
  if (drawing.errors.length) throw new Error(drawing.errors[0]);
  next.editNotes = [`${roomName} ${key} is now ${numeric} ${config.unit || 'units'}. The 2D plan and 3D model use this same specification.`];
  return next;
}

export function applySpecificationEdits(config, text, previous = {}) {
  const notes = [];
  const unapplied = [];
  let handled = false;
  if (/night/.test(text)) {
    config.lighting = 'night';
    notes.push('Lighting is set to night. This changes the real-time view of the same model.');
    handled = true;
  }
  if (/stone and glass|exterior to stone/.test(text)) {
    config.exteriorMaterial = 'stone-glass';
    notes.push('Exterior material is set to stone and glass on the generated model.');
    handled = true;
  }
  if (/separate floor plan/.test(text)) {
    config.showAllFloors = true;
    notes.push('Each floor already has its own layout. Use the floor selector to open them one at a time.');
    handled = true;
  }
  if (/add a balcony/.test(text)) {
    config.balconies = true;
    notes.push('A balcony cell was requested. On a house it is added to the residential layout; it is not limited to a single floor in this concept.');
    handled = true;
  }
  if (/rear wall/.test(text) && /stair/.test(text)) {
    config.stairsPosition = 'rear';
    notes.push('The staircase preference is set to the rear. The stair cell stays in the generated room grid.');
    handled = true;
  }

  const widthEdit = text.match(/(?:increase|set|change|make)\s+(?:the\s+)?([a-z0-9 ]+?)\s+width\s+to\s+(\d+(?:\.\d+)?)\s*(feet|ft|foot|meters?|m)?/);
  if (widthEdit && previous.floorLayouts) {
    handled = true;
    const label = widthEdit[1].trim();
    let value = Number(widthEdit[2]);
    const stated = widthEdit[3] || '';
    if (/ft|feet|foot/.test(stated) && config.unit !== 'feet') value = round(value * 0.3048);
    if (/^m/.test(stated) && config.unit === 'feet') value = round(value / 0.3048);
    const target = config.floorLayouts.flat().find((room) => room.name.toLowerCase().includes(label));
    if (!target) unapplied.push(`No room matching "${label}" was found, so the width was not changed.`);
    else {
      const delta = round(value - target.width);
      const rightEdge = target.x + target.width - 0.02;
      config.floorLayouts = config.floorLayouts.map((floorRooms) => floorRooms.map((room) => {
        if (room.name.toLowerCase().includes(label) && Math.abs(room.x - target.x) < 0.02) return { ...room, width: value };
        if (room.x >= rightEdge) return { ...room, x: round(room.x + delta) };
        return room;
      }));
      config.width = round(Number(config.width) + delta);
      config.rooms = config.floorLayouts[0];
      notes.push(`${target.name} width is now ${value} ${config.unit}.`);
      if (config.width > 120 || config.width < 6) unapplied.push('The edited width pushes the building outside the supported 6 to 120 range. Reduce the room size.');
    }
  }

  if (/\b(shop|office|floor|storey|story|window|stair|parking|garden)\b/.test(text)) handled = true;
  if (/\b(increase|move|add|change|show)\b/.test(text) && !handled && previous.projectType && !/^(?:design|create|build|plan|generate)\b/.test(text.trim())) {
    unapplied.push('That instruction was not applied. The editor can change room width, shop or office counts, stair side, balcony, exterior material, and day or night lighting.');
  }
  config.editNotes = notes;
  config.unapplied = unapplied;
  const drawing = buildDrawing(config, 0);
  config.validation = { warnings: drawing.warnings, errors: drawing.errors };
  return config;
}
