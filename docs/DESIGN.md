# Design generation

BuildRight turns a written brief into one structured specification. The floor plan, four elevations, longitudinal and cross sections, DXF file, 3D view, and GLB export all read that specification. A rendered still is a capture of the same 3D scene.

## What is generated

- Vector floor plans for each floor, as SVG, with room names, walls, doors, windows, stairs, furniture glyphs, dimensions, and a north arrow.
- Front, rear, left, and right elevations derived from the shared opening geometry (not a decorative window grid).
- Longitudinal and cross sections that cut through room layouts, slabs, walls, and conceptual foundation zones, with floor-to-floor heights.
- DXF R12 with layers `A-WALL-EXTR`, `A-WALL-INTR`, `A-DOOR`, `A-GLAZ`, `A-DIMS`, and `A-ANNO`. Coordinates are in the drawing unit (feet or metres). This is a real CAD exchange file, not a picture.
- A Three.js / React Three Fiber model of the same walls, slabs, windows, doors, balconies, roof, and site context (roads, parking, footpaths, trees, boundary, gates, outdoor lamps at night), with standard/physical materials, glass transmission, environment reflections, and natural shadows. GLB export writes that scene. The “PBR still” is a browser capture of this model.
- Interactive 3D controls: orbit/pan/zoom, orthographic-style face views, interior floor selection, day/night lighting, 3D section cut (clipping plane synced to the same footprint), hide-exterior walls, click-to-measure, and optional first-person inspection.
- Drawing sheets with white background, black technical linework, scale note, and a title block stating the sheet is conceptual.
- An IFC2x3 file that names the project, site, building, storey, and walls. It does not contain certified solid geometry and is not a Revit, AutoCAD, or SketchUp project.
- Area and wall-length quantities passed into the cost estimator. Beam, column, and foundation quantities are omitted because those sizes are not in the concept model.

## What is not generated

- Native Revit (RVT), AutoCAD (DWG), or SketchUp (SKP) files.
- An offline path-traced architectural render. The viewer is real-time WebGL. There is no V-Ray, Enscape, or other licensed renderer configured.
- A code-compliant or engineered design. Room cells can be smaller than a usable room; those cases are reported as warnings. Foundations in section are conceptual zones only.
- Bridge, tunnel, and landscape engineering. Those categories use their own linear or zone templates and say so in the assumptions.

Editing a room size, floor count, footprint, exterior material, or day/night lighting updates the shared specification; related 2D sheets and the 3D model refresh from that same geometry.

Set `AI_PROVIDER` and `AI_API_KEY` only if an external model should help read the brief. Geometry is still built by the local drawing code. If that key is absent, the studio says the procedural service was used.
