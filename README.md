# BuildRight

BuildRight is a construction planning workspace: concept floor plans, an interactive 3D model, and a transparent cost estimate stored in MongoDB.

## Run locally

1. Install [Node.js](https://nodejs.org/) 20+ and [MongoDB](https://www.mongodb.com/docs/manual/installation/).
2. Copy the environment file and set a long `JWT_SECRET`.

```sh
npm install
copy .env.example .env
```

3. Seed illustrative rates, sample projects, guides, and a development admin account.

```sh
npm run seed
```

Seeded development accounts (change these before sharing the database):

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@buildright.local` | `ChangeMe-Admin-2026` |
| Supplier | `supplier@buildright.local` | `ChangeMe-Supplier-2026` |
| Provider | `provider@buildright.local` | `ChangeMe-Provider-2026` |

Override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, `SEED_SUPPLIER_EMAIL` / `SEED_SUPPLIER_PASSWORD`, and `SEED_PROVIDER_EMAIL` / `SEED_PROVIDER_PASSWORD` in `.env` if needed.

4. Start the API and the Vite app.

```sh
npm run dev:full
```

Open `http://localhost:5173`. The API listens on `http://localhost:3001` and Vite proxies `/api`.

`npm run dev` starts only the website. Generation still falls back to the in-browser geometry engine, but accounts, saved estimates, and the rate catalog need the API and MongoDB.

## Tests

```sh
npm test
```

## What is connected

- Accounts use scrypt password hashes and a signed JWT stored in the browser for the design studio.
- Estimates are calculated on the server from MongoDB rates. Each saved estimate keeps the rate snapshot used at the time.
- Floor plans and 3D models come from the same structured specification. Roads, parking, and tunnels use their own geometry.
- PDF reports, project history, contact messages, articles, and the professional directory are stored in MongoDB.
- Admin pages call server routes that reject non-admin tokens.
- Marketplace catalog, cart, checkout, and orders use `/api/marketplace/*` with MongoDB stock and supplier roles.
- Repair planner estimates, saved repair projects, and service requests use `/api/repairs/*` and price materials from the marketplace catalog.
- Project gallery and personal projects use `/api/projects` (public samples plus signed-in create/archive/duplicate).

Design drawings, the DXF exchange, and the limits of the 3D viewer are described in [docs/DESIGN.md](docs/DESIGN.md). Sample output from the plaza brief is in `samples/plaza-floor-1.svg` and `samples/plaza-floor-1.dxf`.

## What is not a live integration

- Material rates shipped by the seed script are illustrative. They are labeled with their source and date. There is no live price feed.
- No email server is configured. Password reset returns a token only in development.
- An external AI model is used only when `AI_PROVIDER` is not `procedural` and `AI_API_KEY` is set. Otherwise the procedural interpreter is used and the studio says so.
- Concept plans and estimates are planning aids. They are not certified drawings or bills of quantities.
- Professional verification badges stay off unless an administrator sets `verificationStatus` to `verified`.
