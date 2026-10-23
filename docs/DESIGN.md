# Design generation

BuildRight turns a written brief into one structured specification. The floor plan, elevation, section, DXF file, 3D view, and GLB export all read that specification. A rendered still is a capture of the same 3D scene.

## What is generated

- Vector floor plans, a front elevation, and a section, as SVG. PNG and print-to-PDF use that SVG.
- DXF R12 with layers `A-WALL-EXTR`, `A-WALL-INTR`, `A-DOOR`, `A-GLAZ`, `A-DIMS`, and `A-ANNO`. Coordinates are in the drawing unit (feet or metres). This is a real CAD exchange file, not a picture.
- A Three.js model of the same walls, slabs, windows, and doors, with standard materials and glass. GLB export writes that scene. The “PBR still” is a browser capture of this model.
- An IFC2x3 file that names the project, site, building, storey, and walls. It does not contain certified solid geometry and is not a Revit, AutoCAD, or SketchUp project.
- Area and wall-length quantities passed into the cost estimator. Beam, column, and foundation quantities are omitted because those sizes are not in the concept model.

## What is not generated

- Native Revit (RVT), AutoCAD (DWG), or SketchUp (SKP) files.
- An offline path-traced architectural render. The viewer is real-time WebGL. There is no V-Ray, Enscape, or other licensed renderer configured.
- A code-compliant or engineered design. Room cells can be smaller than a usable room; those cases are reported as warnings.
- Bridge, tunnel, and landscape engineering. Those categories use their own linear or zone templates and say so in the assumptions.

Set `AI_PROVIDER` and `AI_API_KEY` only if an external model should help read the brief. Geometry is still built by the local drawing code. If that key is absent, the studio says the procedural service was used.
