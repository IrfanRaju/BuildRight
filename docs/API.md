# BuildRight API

Base URL in development: `http://localhost:3001` (Vite proxies `/api`).

Responses use `{ ok: true, ... }` for new endpoints. Design-studio endpoints also return `{ error }` or `{ project }` so the existing studio client keeps working. Protected routes expect `Authorization: Bearer <token>`.

## Authentication

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | User |
| PUT | `/api/auth/profile` | User |
| PUT | `/api/auth/password` | User |
| POST | `/api/auth/forgot-password` | Public. Returns a reset token only when `NODE_ENV` is not `production`. |
| POST | `/api/auth/reset-password` | Public |

## Estimates

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/estimates/calculate` | Public. Recalculates from the current rate book. |
| POST | `/api/estimates` | User. Stores the result and a rate snapshot. |
| GET | `/api/estimates` | User |
| GET | `/api/estimates/:id` | Owner or admin |
| GET | `/api/estimates/:id/report` | Owner or admin. PDF download. |
| POST | `/api/estimates/compare` | User. Body: `{ "ids": ["...", "..."] }` |

Total = materials + labor + equipment + overhead + contractor margin + contingency + tax.

Margin and contingency are each applied once to direct cost plus overhead. Tax is applied to direct cost, overhead, and margin, and does not include contingency.

## Designs

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/designs/generate` | Public. Procedural geometry, or a configured AI extractor plus geometry. |
| GET | `/api/designs` | User |
| POST | `/api/designs` | User |
| PUT | `/api/designs/:id` | Owner |
| DELETE | `/api/designs/:id` | Owner |

Generation records a job with status `processing`, then `completed` or `failed`, when MongoDB is connected. If `AI_API_KEY` is not set, the response says the procedural service was used. A failed AI call does not pretend the model succeeded.

## Projects

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/projects` | Public gallery (`visibility=public`). `?scope=mine` requires a user. Supports `category`, `q`, `status`, `page`, `limit`. |
| GET | `/api/projects/:id` | Public projects, or owner/admin for private ones |
| POST | `/api/projects` | User |
| PUT | `/api/projects/:id` | Owner |
| POST | `/api/projects/:id/duplicate` | Public project, or owner/admin |
| POST | `/api/projects/:id/archive` | Owner. Toggles archived/active |
| DELETE | `/api/projects/:id` | Owner |

## Marketplace

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/marketplace/meta` | Public. Commerce settings, units, calculators, cancellation rules |
| GET | `/api/marketplace/categories` | Public |
| POST/PUT/DELETE | `/api/marketplace/categories` | Admin |
| GET | `/api/marketplace/products` | Public. Filters: `q`, `category`, `brand`, `quality`, `minPrice`, `maxPrice`, `sort`, `page`, `limit` |
| GET | `/api/marketplace/products/:slug` | Public. Includes related products |
| POST/PUT/DELETE | `/api/marketplace/products` | Admin or supplier (own products) |
| GET | `/api/marketplace/supplier/products` | Admin or supplier |
| POST | `/api/marketplace/calculate` | Public. Quantity calculator priced from the live catalog |
| GET/POST | `/api/marketplace/cart` | User. Guest carts stay in the browser until sign-in merges them |
| POST | `/api/marketplace/cart/items` | User |
| PATCH/DELETE | `/api/marketplace/cart/items/:productId` | User |
| POST | `/api/marketplace/checkout` | User. Decrements stock, creates an order, clears the cart |
| GET | `/api/marketplace/orders` | User (own), supplier (own lines), or admin |
| GET | `/api/marketplace/orders/:id` | Owner, supplier on a line, or admin |
| GET | `/api/marketplace/orders/:id/invoice` | Owner. PDF |
| POST | `/api/marketplace/orders/:id/cancel` | Owner while Pending/Confirmed |
| PATCH | `/api/marketplace/orders/:id/status` | Admin |
| PUT | `/api/marketplace/settings` | Admin. Delivery and tax |

Catalog prices are administrator-managed or supplier-verified and are labeled with a last-updated time. They are not a live market feed.

## Repairs

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/repairs/services` | Public. Search with `q`. Admin may pass `all=1` |
| POST/PUT | `/api/repairs/services` | Admin |
| GET | `/api/repairs/pricing` | Public |
| PUT | `/api/repairs/pricing/:slug` | Admin |
| POST | `/api/repairs/estimate` | Public. Materials from marketplace catalog; labor from repair pricing rules |
| GET/POST | `/api/repairs/projects` | User |
| GET/PUT | `/api/repairs/projects/:id` | Owner |
| GET | `/api/repairs/projects/:id/report` | Owner. PDF |
| POST | `/api/repairs/projects/:id/preview` | Owner. Visual concept (local color overlay, or image API when configured) |
| GET | `/api/repairs/providers` | Public |
| POST/PUT | `/api/repairs/providers` | Admin |
| GET/POST | `/api/repairs/requests` | User |
| POST | `/api/repairs/requests/:id/assign` | Admin |
| POST | `/api/repairs/requests/:id/accept` | Provider |
| POST | `/api/repairs/requests/:id/decline` | Provider |
| POST | `/api/repairs/requests/:id/confirm` | Owner. Booking only after provider accept + customer confirm |
| POST | `/api/repairs/requests/:id/cancel` | Owner |

## Catalog, dashboard, and admin

- `GET /api/materials`, `GET /api/labor-rates`, `GET /api/contractors`, `GET /api/articles`, `GET /api/articles/:slug`
- `POST /api/contact`
- `GET /api/dashboard` includes projects, estimates, designs, orders, and repair projects for the signed-in user
- `GET /api/health`
- Admin routes under `/api/admin/*` require `role: admin` on the server: overview, users, messages, jobs, audit, settings.
- Admin catalog writes: `POST/PUT /api/materials`, `POST/PUT /api/contractors`, `POST/PUT/DELETE /api/articles`.
- Commerce admin UI tabs call marketplace and repairs routes above for catalog, orders, repair rates, and providers.

Sample rates are marked `illustrative: true` and include a source string and timestamp.
