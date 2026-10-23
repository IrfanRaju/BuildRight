import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDxf, buildElevationSvg, buildIfc, buildPlanSvg, createDesignFromPrompt, designQuantities, resizeRoom, validateDesign } from './design-engine.js';

test('generates a multi-floor plaza with different ground and upper floor plans', () => {
  const config = createDesignFromPrompt('Design a modern 3-story commercial plaza 30 x 20 meters with parking and garden in Lahore');
  assert.equal(config.projectType, 'Plaza');
  assert.equal(config.floors, 3);
  assert.equal(config.width, 30);
  assert.equal(config.depth, 20);
  assert.equal(config.location, 'Lahore');
  assert.equal(config.floorLayouts[0][0].name, 'Shop 1');
  assert.equal(config.floorLayouts[1][0].name, 'Office 1');
  assert.ok(config.floorLayouts[0].some((room) => room.name === 'Elevator'));
  assert.ok(config.parking);
  assert.ok(config.garden);
  assert.match(buildPlanSvg(config, 0), /Shop 1/);
  assert.match(buildPlanSvg(config, 1), /Office 1/);
});

test('applies follow-up commands to the existing configuration', () => {
  const initial = createDesignFromPrompt('Build a 2-story plaza 24 x 18 meters');
  const changed = createDesignFromPrompt('Add two more shops, make larger windows, add a third floor with four offices, and move the staircase left', initial);
  assert.equal(changed.width, initial.width);
  assert.equal(changed.depth, initial.depth);
  assert.equal(changed.floors, 3);
  assert.equal(changed.shopsPerFloor, 6);
  assert.equal(changed.floorLayouts[0].filter((room) => room.name.startsWith('Shop')).length, 6);
  assert.equal(changed.floorLayouts[2].filter((room) => room.name.startsWith('Office')).length, 4);
  assert.equal(changed.windowStyle, 'Large glass');
  assert.equal(changed.stairsPosition, 'left');
});

test('supports road and tunnel geometry plans', () => {
  const road = createDesignFromPrompt('Plan a 1-story road 60 x 12 meters');
  const tunnel = createDesignFromPrompt('Plan a tunnel 60 x 12 meters');
  assert.equal(road.projectType, 'Road');
  assert.equal(tunnel.projectType, 'Tunnel');
  assert.match(buildPlanSvg(road), /Road section/);
  assert.match(buildPlanSvg(tunnel), /Tunnel section/);
});

test('interprets a marla house brief into labeled rooms and stated assumptions', () => {
  const config = createDesignFromPrompt('Design a modern three-story house on a 10-marla plot with four bedrooms, attached bathrooms, a kitchen, a living room, parking, balconies, and contemporary exterior elevations.');
  assert.equal(config.projectType, 'House');
  assert.equal(config.floors, 3);
  assert.equal(config.bedrooms, 4);
  assert.equal(config.bathrooms, 4);
  assert.equal(config.style, 'Contemporary');
  assert.equal(config.unit, 'feet');
  assert.ok(config.width > 50 && config.width < 70);
  assert.ok(config.rooms.some((room) => room.name === 'Bedroom 4'));
  assert.ok(config.rooms.some((room) => room.name === 'Balcony'));
  assert.match(config.assumptions[0], /272\.25 sq ft per marla/);
  assert.match(buildPlanSvg(config, 0), /Bedroom 4/);
});

test('builds a dimensioned plaza drawing and CAD exchange files from one specification', () => {
  const config = createDesignFromPrompt('Create a modern three-storey commercial plaza on a 60 × 90 ft plot. Include ground-floor shops, two upper floors with offices, staircases, washrooms, a lift, parking, glass facades, realistic exterior materials, and a rooftop utility area.');
  assert.equal(config.projectType, 'Plaza');
  assert.equal(config.floors, 3);
  assert.equal(config.unit, 'feet');
  assert.equal(config.width, 60);
  assert.equal(config.depth, 90);
  assert.equal(config.floorLayouts[0][0].name, 'Shop 1');
  assert.equal(config.floorLayouts[1][0].name, 'Office 1');
  assert.ok(config.floorLayouts[0].some((room) => room.name === 'Elevator'));
  assert.equal(config.roofUtility, true);
  const plan = buildPlanSvg(config, 0);
  assert.match(plan, /Shop 1/);
  assert.match(plan, /60 feet/);
  assert.match(plan, /Wall thickness 0.75/);
  const dxf = buildDxf(config, 0);
  assert.match(dxf, /A-WALL-EXTR/);
  assert.match(dxf, /A-DIMS/);
  assert.match(dxf, /Shop 1/);
  assert.match(dxf, /EOF/);
  assert.match(buildElevationSvg(config), /Front elevation/);
  assert.match(buildIfc(config), /IFCWALL/);
  const quantities = designQuantities(config);
  assert.equal(quantities.builtUpSqFt, 60 * 90 * 3);
  assert.ok(quantities.wallLength > 0);
  assert.ok(quantities.missing.length > 0);
});

test('edits a named room and refuses an unsupported change', () => {
  const initial = createDesignFromPrompt('Design a 2-story house 40 x 30 feet with a living room and kitchen');
  const wider = createDesignFromPrompt('Increase the living room width to 16 feet.', initial);
  assert.equal(wider.rooms.find((room) => room.name === 'Living Room').width, 16);
  assert.match(wider.editNotes.join(' '), /Living Room width is now 16/);
  const refused = createDesignFromPrompt('Move the kitchen onto a cantilevered podium.', initial);
  assert.match(refused.unapplied.join(' '), /not applied/);
});

test('resizing a room updates the shared specification used by the plan', () => {
  const initial = createDesignFromPrompt('Design a 2-story house 40 x 30 feet with a living room and kitchen');
  const before = initial.rooms.find((room) => room.name === 'Living Room').width;
  const edited = resizeRoom(initial, 'Living Room', 'width', before + 4);
  assert.equal(edited.rooms.find((room) => room.name === 'Living Room').width, before + 4);
  assert.equal(edited.width, initial.width + 4);
  assert.match(buildPlanSvg(edited, 0), /Living Room/);
  assert.throws(() => resizeRoom(initial, 'Library', 'width', 12), /No room named Library/);
});

test('keeps infrastructure on its own template and states bridge limits', () => {
  const bridge = createDesignFromPrompt('Design a bridge 40 x 12 meters');
  assert.equal(bridge.projectType, 'Bridge');
  assert.match(bridge.assumptions.join(' '), /not a structural bridge/);
  assert.equal(bridge.rooms.some((room) => room.name.startsWith('Bedroom')), false);
  assert.match(buildPlanSvg(bridge), /Deck segment/);
});

test('rejects out-of-range dimensions and floor counts', () => {
  assert.throws(() => validateDesign({ width: 5, depth: 14, floors: 2 }), /width must be/);
  assert.throws(() => validateDesign({ width: 18, depth: 14, floors: 21 }), /Floor count must be/);
});
