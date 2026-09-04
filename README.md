# BharatCart

A production-oriented, Amazon-style e-commerce store for a single retail
business in India. Next.js 15 (App Router), TypeScript strict, Tailwind +
shadcn/ui, Prisma + PostgreSQL, Auth.js v5, Razorpay.

> **Business details are currently placeholders** (store name, GSTIN, seller
> state, COD caps). Replace them in `.env` before going live — see
> *Business configuration* below.

**Docs:** [SECURITY.md](./SECURITY.md) · [ADMIN.md](./ADMIN.md) (for the shop owner) · [docs/ROUTES.md](./docs/ROUTES.md)

---

## What's built

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Foundation: TS strict, Tailwind + shadcn, Prisma schema, tooling | ✅ |
| 1 | Catalog: home, category listings, URL-driven filters/sort/pagination, Postgres full-text search, product detail with variants | ✅ |
| 2 | Cart (guest → DB merge on login), wishlist, auth (email/password + Google), address book, order history | ✅ |
| 3 | Checkout, server-computed totals, GST, Razorpay + COD, signature verification, idempotent webhooks, race-safe stock | ✅ |
| 4 | Admin: dashboard, product CRUD with Cloudinary image upload + CSV import, order management, coupons, customers, low stock | ✅ |
| 5 | Verified-purchase reviews, moderation, GST tax invoices, 404/500, skeletons, SEO metadata, JSON-LD, sitemap, robots | ✅ |

---

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Components) |
| Language | TypeScript, `strict` |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | PostgreSQL via Prisma ORM |
| Auth | Auth.js v5 (credentials + Google OAuth) |
| Payments | Razorpay Standard Checkout (UPI, cards, net banking, wallets) + COD |
| Images | Cloudinary |
| Email | Resend |
| Validation | Zod — server-side, on every mutation |
| Tests | Vitest (unit + integration), Playwright (e2e) |
| Hosting | Vercel |

**Money is integer paise everywhere** (₹1 = 100). Prices are **GST-inclusive**;
tax is derived, never added. App tables live in a dedicated `bharatcart`
Postgres schema (Prisma `multiSchema`), isolated from anything in `public`.

---

## Prerequisites

- Node.js 18.18+ (developed on Node 24)
- npm
- PostgreSQL — either a hosted Supabase project **or** the bundled local server
  (below)

> **Windows + OneDrive:** `node_modules` inside a OneDrive-synced folder causes
> slow and occasionally failing installs (`EPERM` / `edgesOut`). If installs
> misbehave, move the project outside OneDrive (e.g. `C:\dev\bharatcart`).

---

## Local setup

```bash
npm install
cp .env.example .env      # then fill in values (see below)
```

### Option A — local Postgres (no accounts needed)

A real Postgres is bundled for development via `embedded-postgres`. Data is
stored outside the project (and outside OneDrive).

```bash
node scripts/pg-dev.mjs   # leave running; serves localhost:5432
```

Then point `.env` at it:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bharatcart"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/bharatcart"
```

### Option B — Supabase

Supabase dashboard → **Connect → ORMs → Prisma**, and copy the two strings into
`.env` (`DATABASE_URL` = pooled/6543, `DIRECT_URL` = direct/5432). No `?schema=`
parameter is needed — schema isolation is handled in `prisma/schema.prisma`.

### Then

```bash
npm run db:generate       # generate the Prisma client
npm run db:migrate:deploy # apply committed migrations
npm run db:seed           # realistic Indian sample catalog + dev users
npm run dev               # http://localhost:3000
```

**Seeded dev logins** (local only — never seed production):

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@bharatcart.test` | `Admin@12345` |
| Customer | `customer@bharatcart.test` | `Customer@12345` |

---

## Environment variables

Every variable is documented in [`.env.example`](./.env.example). Anything
**without** `NEXT_PUBLIC_` is server-only and must never reach the browser.

```bash
npx auth secret           # generates AUTH_SECRET
```

For Google OAuth set `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` with redirect URI
`{APP_URL}/api/auth/callback/google`. The Google button only appears when both
are set.

If `RESEND_API_KEY` is empty, transactional emails are **printed to the server
console** instead of sent — so verification/reset/order flows are testable
locally without credentials.

### Business configuration

```
NEXT_PUBLIC_STORE_NAME     Store name shown throughout the UI
SELLER_LEGAL_NAME          Legal entity on invoices
SELLER_GSTIN               Your GSTIN  (placeholder — replace)
SELLER_STATE               Place-of-supply origin; decides CGST+SGST vs IGST
COD_MAX_ORDER_VALUE_PAISE  COD cap (default ₹5,000)
FREE_SHIPPING_THRESHOLD_PAISE / SHIPPING_FLAT_PAISE / COD_SURCHARGE_PAISE
```

---

## Database & migrations

| Command | What it does |
| --- | --- |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Create + apply a migration in dev |
| `npm run db:migrate:deploy` | Apply committed migrations (CI/production) |
| `npm run db:studio` | Browse data in Prisma Studio |
| `npm run db:seed` | Sample catalog + dev users |

**Migrations are committed.** Never run `prisma db push` against production.

The product full-text search column is a Postgres **generated `tsvector`** with
a GIN index, created in the init migration and declared in the schema as
`Unsupported("tsvector")` so Prisma tracks it without drift.

---

## Testing

```bash
node scripts/pg-dev.mjs   # (leave running — integration tests need the database)
npm test                  # Vitest: 48 unit + integration tests
npm run test:e2e          # Playwright: 24 e2e tests, desktop + mobile
```

Covered where a bug costs real money:

- GST derivation and reconciliation across every slab (`tests/tax.test.ts`)
- Order totals, coupons, caps, shipping thresholds, integer-paise invariants
- Razorpay payment **and** webhook signature verification, incl. tampering
- **Stock under concurrency** — last-unit races and a 5-way burst that must
  never oversell (`tests/orders.integration.test.ts`)
- Webhook/confirm **idempotency** — repeat deliveries never double-decrement
- Authorization — a user cannot order against another user's address
- Rate limiting — window enforcement, per-key isolation, and graceful
  degradation when Upstash is unreachable
- Cloudinary upload signing — signature correctness and that the API secret is
  never included in the payload sent to the browser

---

## Razorpay

### Test mode

1. Razorpay dashboard → **Test Mode** → **Settings → API Keys → Generate**.
   Key id → `RAZORPAY_KEY_ID` *and* `NEXT_PUBLIC_RAZORPAY_KEY_ID`;
   secret → `RAZORPAY_KEY_SECRET` (server-only).
2. **Settings → Webhooks → Add webhook**, URL
   `https://<domain>/api/webhooks/razorpay`, events `payment.captured`,
   `payment.failed`, `refund.processed`. Signing secret →
   `RAZORPAY_WEBHOOK_SECRET`. Locally, tunnel with `ngrok` and use that URL.
3. Pay with Razorpay's test instruments (e.g. UPI `success@razorpay`).

Until keys are set, online payment is disabled in the UI and **Cash on Delivery
still works end to end**.

### Going live

Only after payment, signature verification, webhook and refund have all been
tested end to end: switch the dashboard to Live, generate live keys, replace the
`rzp_test_*` values in Vercel, recreate the webhook against the production URL,
and update `RAZORPAY_WEBHOOK_SECRET`. Live keys live only in Vercel.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Dev server / production build / serve |
| `npm run lint` · `typecheck` | ESLint · `tsc --noEmit` |
| `npm run format` · `format:check` | Prettier |
| `npm test` · `test:e2e` | Vitest · Playwright |
| `npm run db:*` | See *Database & migrations* |

---

## Project structure

```
prisma/
  schema.prisma          all models, in the `bharatcart` schema
  migrations/            committed SQL migrations
  seed.ts                sample catalog + dev users
scripts/pg-dev.mjs       local Postgres for development
src/
  app/                   routes (App Router)
    api/                 auth, Razorpay verify, Razorpay webhook
    admin/               role-gated admin panel
  components/            UI (client components only where needed)
  lib/
    cart/                pricing (server recompute) + cart actions
    checkout/            GST, totals, business rules
    orders/              order creation, confirmation, emails
    actions/             server actions (all Zod-validated)
    razorpay.ts          REST client + signature verification
    money.ts             paise helpers
tests/                   Vitest unit + integration
e2e/                     Playwright
```

---

## Deployment (Vercel)

1. Push to GitHub and import the repo into Vercel.
2. Add every variable from `.env.example` in Vercel project settings (production
   values; live keys only here).
3. Build command: `npm run db:migrate:deploy && npm run build`.
4. Add the Razorpay webhook against the production URL.
5. Deploy.

### Before taking real money

- [ ] Replace all placeholder business details (name, GSTIN, seller state).
- [ ] Set `UPSTASH_REDIS_REST_URL` / `_TOKEN` so rate limits work across serverless instances.
- [ ] Set the Cloudinary variables so admins can upload product images.
- [ ] Replace the placeholder COD PIN-serviceability rule with your courier's.
- [ ] Confirm shipping-GST treatment with your accountant.
- [ ] Upload real, licensed product photography (placeholders ship by default).
- [ ] Test the full Razorpay flow — payment, webhook, refund — in test mode.
