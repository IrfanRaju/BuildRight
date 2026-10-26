# BuildRight — FYP Presentation Brief

> **Purpose of this document**  
> This file is a structured brief for a university Final Year Project (FYP) presentation (about **15–30 minutes**).  
> You can paste this entire document into ChatGPT (or similar) and ask it to generate PowerPoint/Google Slides outlines, speaker notes, demo scripts, or Q&A prep.  
> Keep claims honest: BuildRight is a **planning aid**, not a substitute for certified drawings, engineered designs, or live market prices.

---

## Prompt for slide / talk generation (copy this block)

```text
You are helping me prepare a Final Year Project (FYP) presentation for university examiners.

Use ONLY the facts in this document. Do not invent features, integrations, or accuracy claims that are not written here.

Create:
1) A slide outline for a 15-minute version AND a 20–30 minute version
2) Suggested slide titles and 3–5 bullet points per slide
3) Short speaker notes (what I should say aloud)
4) A live demo script (order of screens to click)
5) Likely examiner questions with short honest answers
6) A one-page abstract I can read in 60 seconds

Tone: academic but clear, product + engineering focused. Audience: faculty and peers who may not know construction software.

Project name: BuildRight
Domain: Construction planning — cost estimation, concept design (2D/3D), materials marketplace, repair/renovation planning
Stack: React + Vite frontend, Express API, MongoDB, Three.js / React Three Fiber, JWT auth, optional Cloudinary & optional AI brief extractor
```

---

## 1. Where to start (for you and for the audience)

### For the presenter (before the talk)

1. Read this brief once end-to-end.
2. Skim `README.md`, then optionally `docs/SETUP.md`, `docs/DESIGN.md`, and `docs/API.md` if examiners ask deep questions.
3. Run the app locally so the demo works:
   - Node.js 20+, MongoDB running
   - `npm install` → copy `.env.example` to `.env` → set a long `JWT_SECRET`
   - `npm run seed`
   - `npm run dev:full`
   - Open `http://localhost:5173` (API on `http://localhost:3001`)
4. Confirm health: `http://localhost:3001/api/health` shows `"status":"ok"` and `"storage":"mongodb"`.
5. Log in with seeded accounts if needed (change passwords before any shared/public demo):
   - Admin: `admin@buildright.local`
   - Supplier / Provider accounts also seeded (see README)
6. Prepare **one** sample story for the demo (example: “5-marla house in Lahore, grey structure + finishing”).

### For the audience (opening framing)

Start with the problem, not the stack:

- Homeowners and small contractors often need **early cost visibility**, a **rough spatial concept**, and a way to **source materials / repairs** — but these tools are usually separate, opaque, or expensive.
- BuildRight puts estimation, concept design, marketplace, and repair planning in **one workspace**, with rates and catalogs stored in **MongoDB** and recalculated on the server.

---

## 2. One-sentence project statement

**BuildRight** is a web-based construction planning workspace that turns project inputs into transparent cost estimates, concept floor plans and 3D models, a materials marketplace, and repair/renovation estimates — backed by MongoDB and a Node/Express API.

---

## 3. Problem & objectives (FYP framing)

### Problem

| Pain point | Why it matters |
| --- | --- |
| Cost estimates are opaque or spreadsheet-only | Hard to trust totals or explain material vs labor vs margin |
| Design tools are heavy (Revit/AutoCAD) for early ideas | Non-experts need concept plans, not certified BIM |
| Material shopping and estimation are disconnected | Quantities and catalog prices live in different places |
| Repair/paint work is quoted ad hoc | Little structure for scope, materials, and service requests |
| Regional cost variation (e.g. Pakistan cities) is ignored | Same bill of rates does not fit Lahore vs Gilgit |

### Project objectives

1. Deliver a **transparent cost estimator** driven by stored rates (materials, labor, regional multipliers, margins).
2. Generate **concept 2D drawings and an interactive 3D model** from one shared specification.
3. Provide a **marketplace** (catalog, cart, checkout, orders) with supplier/admin roles.
4. Support **repair / renovation planning** priced partly from marketplace materials.
5. Persist users, projects, estimates, designs, and commerce data in **MongoDB**.
6. Expose a clear **admin** surface to maintain rates, history, uploads, and settings.
7. Keep honesty boundaries: illustrative rates, conceptual drawings, no fake “live market” or “certified design” claims.

### Non-objectives (say this so examiners know you know the limits)

- Not a licensed BIM/CAD replacement (no native RVT/DWG/SKP).
- Not a code-compliant or structural engineering system.
- Not a live commodity price feed.
- Not a production email/notification platform (password reset token only in development).

---

## 4. What this repository contains

Top-level layout (conceptual map of the codebase):

| Path | What it is |
| --- | --- |
| `src/` | React frontend (Vite): landing, Design Studio, Estimator, Marketplace, Repairs, Auth, Account, Admin |
| `server/` | Express API: auth, estimates, designs, projects, marketplace, repairs, admin, uploads, PDF |
| `shared/` | Pure calculation engines shared by API (and tests): estimate, quantity, margin, timeline, repair, commerce helpers |
| `docs/` | Project documentation (`SETUP`, `API`, `DESIGN`, this presentation brief) |
| `samples/` | Example design exports (e.g. SVG/DXF from a plaza brief) |
| `scripts/` | Utility scripts (e.g. admin reset helpers) |
| `uploads/` | Local image storage when Cloudinary is not configured |
| `package.json` | Scripts: `dev`, `dev:full`, `server`, `seed`, `test`, `build` |
| `README.md` | How to run, what is connected, what is *not* a live integration |

### Key frontend pages / modules

- **Home / About / Services / Contact / Blog / Contractors** — marketing and content surfaces
- **Estimator** — construction cost estimation workspace
- **Design / Design Studio** — prompt- or form-driven concept plans + 3D viewer + exports
- **Projects** — public gallery and personal project history
- **Marketplace** — products, quantity calculator, cart, orders
- **Repairs** — repair planner and saved repair projects / service flow
- **Materials** — rate/catalog views tied to estimation data
- **Account dashboard** — signed-in user’s projects, estimates, designs, orders
- **Admin** — rates, regional data, labor, margins, uploads, commerce controls
- **Supplier / Provider workspaces** — role-specific commerce and service tooling
- **Auth** — register, login, profile, password flows (JWT)

### Key backend route groups

- `/api/auth/*` — accounts and JWT sessions
- `/api/estimates/*` — calculate, save, compare, PDF report
- `/api/designs/*` — generate and persist designs
- `/api/projects/*` — gallery and personal projects
- `/api/marketplace/*` — catalog, cart, checkout, invoices
- `/api/repairs/*` — services, estimates, projects, provider requests
- `/api/admin/*` and config routes — materials, regional rates, labor, margins, quantity rules, price history, uploads
- `/api/health` — storage and runtime health check

### Shared calculation engines (`shared/`)

These are the “brain” of estimation math (good talking point for examiners):

- `estimateEngine.js` — itemized cost build-up
- `quantityEngine.js` — quantity rules from area / templates
- `marginEngine.js` — margin bands / auto margin
- `timelineEngine.js` — construction phase timeline prediction
- `repairEngine.js` — repair/renovation estimate logic
- `rateBook.js` / commerce helpers — rate book and marketplace-related shared logic

Tests live next to engines and under `server/tests/` (`npm test`).

---

## 5. What the project contains (product features)

### A. Construction cost estimation

- Inputs such as area (sq ft / marla / kanal / sq m), location (regional rates), quality (economy → luxury), category (grey / finishing / turnkey).
- Server recalculates from the **current MongoDB rate book**.
- Saved estimates store a **rate snapshot** so history stays explainable.
- Output: materials, labor, equipment, overhead, contractor margin, contingency, tax, and a **timeline** of phases.
- PDF report download for saved estimates.
- Compare multiple saved estimates.

**Estimate formula (high level):**

```text
Direct = materials + labor + equipment
Overhead = Direct × overhead%
Margin = (Direct + Overhead) × margin%
Contingency = (Direct + Overhead) × contingency%
Tax = (Direct + Overhead + Margin) × tax%
Total = Direct + Overhead + Margin + Contingency + Tax
```

Regional multipliers adjust Islamabad-base rates for other cities when appropriate.

### B. Concept design studio (2D + 3D)

- One **structured specification** drives:
  - Vector floor plans (SVG): rooms, walls, doors, windows, stairs, dimensions
  - Elevations and sections
  - DXF (CAD exchange, not a picture)
  - Interactive Three.js / R3F 3D model (orbit, day/night, section cut, measure, etc.)
  - Optional GLB export / still capture of the WebGL scene
  - Light IFC naming (conceptual — not certified solid BIM)
- Geometry quantities (areas, wall lengths) can feed estimation.
- Optional external AI only helps **interpret a written brief** when configured; geometry is still built by local drawing code. Default is **procedural**.

### C. Materials marketplace

- Categories and products in MongoDB
- Search/filter, product pages, quantity calculator priced from live catalog
- Cart, checkout (stock decrement), orders, PDF invoice
- Roles: user, supplier (own products), admin
- Prices are admin/supplier managed — **labeled timestamps, not a live market feed**

### D. Repair / paint / renovation

- Service catalog and pricing rules
- Estimates that pull materials from the marketplace catalog where applicable
- Saved repair projects + PDF
- Service requests with provider accept/confirm style workflow
- Optional visual concept preview (local color overlay, or image API if configured)

### E. Accounts, projects, admin

- Auth with password hashing and JWT
- Project gallery (public samples + private user projects; archive/duplicate)
- Admin dashboard for rates, price history, uploads (Cloudinary or local), users/messages/settings
- Seed script loads illustrative PKR rates and sample data for demos

---

## 6. How it works (architecture)

### High-level flow

```text
Browser (React + Vite :5173)
    │  /api proxied
    ▼
Express API (:3001)
    │
    ├── Auth (JWT) + role guards (user / admin / supplier / provider)
    ├── Shared engines (estimate, quantity, margin, timeline, repair)
    ├── MongoDB (rates, users, estimates, designs, products, orders, repairs, …)
    ├── PDF generation (reports / invoices)
    └── Optional: Cloudinary uploads, AI brief extractor, image preview API
```

### End-to-end user journeys (use these in the demo)

1. **Estimate journey**  
   Open Estimator → choose city / area / quality / category → Calculate → review itemized breakdown & timeline → Sign in → Save → Download PDF.

2. **Design journey**  
   Open Design Studio → enter brief or parameters → Generate → inspect floor plan / elevations → open 3D → export SVG/DXF/GLB as available → optionally save design.

3. **Marketplace journey**  
   Browse Marketplace → open product → add to cart → checkout → view order / invoice.

4. **Repair journey**  
   Open Repairs → pick service / scope → estimate → save project → (optional) service request to a provider.

5. **Admin journey**  
   Sign in as admin → change a material or regional rate → show Price History → recalculate an estimate to show the new rate book effect.

### Data honesty model (important slide)

| Claim you can make | Claim you should not make |
| --- | --- |
| Rates are stored and auditable in MongoDB | “Live real-time market prices” |
| Estimates are transparent and formula-based | “Exact contractor quote / certified BOQ” |
| Drawings share one geometric specification | “Building-code compliant / engineered drawings” |
| DXF is a real exchange file | “Native AutoCAD/Revit project” |
| 3D is interactive WebGL | “Photoreal offline ray-traced architectural render” |
| AI optional for brief parsing | “AI designs the building by itself” |

---

## 7. Technology stack (exam-friendly list)

| Layer | Choices |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS, Framer Motion, Lucide icons, Recharts |
| 3D / CAD-ish | Three.js, React Three Fiber, Drei; SVG/DXF generation in design code |
| Backend | Node.js, Express 5 |
| Database | MongoDB via Mongoose |
| Auth | JWT + password hashing (scrypt/bcryptjs per implementation) |
| Files | Multer; Cloudinary optional; local `uploads/` fallback |
| Documents | PDFKit for estimate/repair/order PDFs |
| Tooling | Concurrently for full-stack dev; Node test runner for engines & access tests |

---

## 8. Suggested presentation structure

### Version A — ~15 minutes

| Time | Section | What to cover |
| --- | --- | --- |
| 0:00–1:30 | Title & problem | Who struggles today; one-sentence BuildRight pitch |
| 1:30–3:00 | Objectives & scope | Goals + explicit non-objectives |
| 3:00–5:00 | Architecture | Frontend / API / Mongo / shared engines diagram |
| 5:00–9:00 | Live demo | Estimator → Design 2D/3D → (quick) Marketplace or Repairs |
| 9:00–11:30 | Deep dive | Estimate formula OR single-spec design pipeline |
| 11:30–13:00 | Roles & admin | JWT roles; admin rate change + price history |
| 13:00–14:00 | Evaluation | Tests, seed data, limitations |
| 14:00–15:00 | Conclusion & Q&A buffer | Contributions + future work |

### Version B — ~20–30 minutes

Expand Version A with:

1. Full marketplace checkout + invoice PDF  
2. Repair planner + service request flow  
3. Design exports (SVG / DXF / GLB) and what IFC does / does not claim  
4. Regional rates and margin rules as configurable policy  
5. Short “future work” (live feeds, email, richer BIM, mobile, more cities)  
6. More Q&A time (5+ minutes)

### Suggested slide title list (generator can expand bullets)

1. Title slide — BuildRight FYP  
2. Agenda  
3. Problem statement  
4. Stakeholders (homeowner, contractor, supplier, admin)  
5. Objectives & success criteria  
6. Scope & limitations  
7. System architecture  
8. Repository map  
9. Module 1 — Cost estimator  
10. Estimate formula & rate book  
11. Module 2 — Design studio (one specification → many views)  
12. Module 3 — Marketplace  
13. Module 4 — Repairs & providers  
14. Auth, roles, and admin controls  
15. Data model highlights (Mongo collections conceptually)  
16. Demo walkthrough  
17. Testing & quality  
18. Results / screenshots  
19. Challenges & decisions  
20. Future work  
21. Conclusion  
22. References / thank you / Q&A  

---

## 9. Live demo script (click path)

Use one narrative: *“Planning a small house in Lahore.”*

1. **Home** — show brand and feature entry points.  
2. **Estimator** — enter area (e.g. marla), city Lahore, quality standard, turnkey → Calculate → point to materials vs labor vs margin → mention regional multiplier.  
3. **Sign in** (if needed) → Save estimate → open PDF report.  
4. **Design** — generate from a short brief → show labeled floor plan → switch to 3D orbit / day-night.  
5. **Marketplace** — open a cement/steel/paint product → add to cart (or show calculator).  
6. **Repairs** (if time) — quick paint/repair estimate.  
7. **Admin** (if time) — change one rate → show price history → recalculate.

Fallback if Mongo/API fails: explain that `npm run dev` alone is frontend-only; API must be up (`dev:full`) — this itself is a good “how the system is wired” teaching moment.

---

## 10. Contributions / what makes this an FYP-worthy system

Frame contributions as **integration + transparency + domain engines**, not “yet another website”:

1. Unified planning workspace across estimate, design, commerce, and repairs.  
2. Server-side estimate pipeline with snapshots and an explicit formula.  
3. Shared design specification driving 2D sheets, DXF, and interactive 3D.  
4. Role-based commerce and repair workflows on MongoDB.  
5. Admin-operated rate book with history — rates are operable data, not hard-coded UI fiction.  
6. Documented honesty about limits (critical for academic credibility).

---

## 11. Likely examiner questions (short answers)

**Q: Is this AI-generated architecture?**  
A: Geometry is procedural/local. An external AI can optionally help parse a text brief when keys are configured; otherwise the procedural path is used and disclosed.

**Q: Are prices accurate for Pakistan?**  
A: Seed data is illustrative PKR for demos. Admins/suppliers update rates; there is no live market feed. Treat outputs as planning guidance.

**Q: Can I open the DXF in AutoCAD?**  
A: DXF R12 is a real exchange format with layers; it is still a concept drawing, not a full construction document set.

**Q: Why MongoDB?**  
A: Flexible documents for rates, catalogs, snapshots, and project/design payloads; fits iterative FYP development and JSON-shaped domain data.

**Q: How do you prevent unauthorized admin changes?**  
A: JWT auth with role checks on server routes; admin APIs reject non-admin tokens.

**Q: What did you test?**  
A: Engine unit tests (estimate, quantity, margin, timeline, repair) plus server access/search tests via `npm test`.

**Q: What would you do next if this continued past FYP?**  
A: Verified supplier price feeds, email/notifications, richer structural quantities, mobile UX, stronger BIM interchange, and deployment hardening.

---

## 12. Closing statement (you can read this)

> BuildRight demonstrates a practical construction planning platform: transparent, formula-based cost estimation; concept drawings and 3D from one specification; and marketplace plus repair flows on a MongoDB-backed API. It is designed as an early-stage decision aid — clear about what it calculates, what it visualizes, and what it does not claim to replace.

---

## 13. Related docs in this repo

| File | Use when… |
| --- | --- |
| `README.md` | Running the project; high-level “what is / isn’t connected” |
| `docs/SETUP.md` | Install, seed, verify admin/estimator workflows |
| `docs/API.md` | Endpoint tables and estimate formula detail |
| `docs/DESIGN.md` | Design generation outputs and non-outputs |
| `docs/FYP-PRESENTATION-BRIEF.md` | This file — presentation & ChatGPT slide prompt |

---

## 14. Optional extras to ask ChatGPT for

After pasting this document, you can request:

- Speaker notes timed to 15 vs 25 minutes  
- A poster / one-pager abstract  
- A viva voce (oral defense) cheat sheet  
- Diagram prompts (architecture, sequence for “calculate estimate”, ER-style collection map)  
- A marking-rubric self-check (“problem, methodology, implementation, evaluation, conclusion”)  

Remember: if ChatGPT invents features not listed here, delete them. Prefer under-claiming over over-claiming.
)
