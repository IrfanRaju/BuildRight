# BuildRight setup — estimation platform + admin dashboard

## Prerequisites

- Node.js 20+
- MongoDB running locally, or a MongoDB Atlas URI

## Install and configure

```sh
npm install
copy .env.example .env
```

Edit `.env`:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Mongo connection string |
| `JWT_SECRET` | Long random secret for admin/user JWTs |
| `API_PORT` | Backend port (default `3001`) |
| `WEB_ORIGIN` | Vite origin (default `http://localhost:5173`) |
| `CLOUDINARY_*` | Optional. Without these, images go to `uploads/` |

## Seed the database

```sh
npm run seed
```

Creates:

- Admin user + `Admin` document (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`)
- Material rates (cement, steel, bricks, sand, crush, tiles, paint, electrical, plumbing, …)
- City labor rates and skill rates (mason, laborer, steel fixer, …)
- Regional rates (Islamabad, Rawalpindi, Lahore, Karachi, Peshawar, Gilgit, Skardu, Hunza, …)
- Margin rules, quantity rules, building templates
- Marketplace and repair seed data

Default admin: `admin@buildright.local` / `ChangeMe-Admin-2026`

## Run

```sh
npm run dev:full
```

- App: http://localhost:5173  
- API: http://localhost:3001  
- Health: http://localhost:3001/api/health → `"storage":"mongodb"`

Or two terminals: `npm run server` then `npm run dev`.

## Verify main workflows

1. Sign in as admin → open **Admin** sidebar (Overview, Materials, Prices, Regional, Labor, Margins, Uploads, Settings).
2. Change a material price → confirm Price History shows previous → new value.
3. Open **Estimator**, enable automatic margin, pick Lahore, calculate → itemized totals, regional multiplier, timeline phases, PDF after save.
4. Upload an image from Admin → Image Uploads (local `/uploads/...` or Cloudinary URL).
5. Restart the API → materials, regional rates, and saved estimates remain in MongoDB.

```sh
npm test
```

## API documentation

See [API.md](./API.md) for endpoint tables and the estimate formula.
