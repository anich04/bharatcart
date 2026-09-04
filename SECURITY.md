# Security

How BharatCart handles data, secrets and money. Read this before changing
anything in `src/lib/orders/`, `src/lib/checkout/`, `src/lib/razorpay.ts`, or
`src/app/api/`.

---

## What we store

| Data | Where | Notes |
| --- | --- | --- |
| Name, email, phone | `User` | Email is the login identity. |
| Password hash | `User.passwordHash` | **bcrypt, cost 12.** Never the plaintext. |
| Delivery addresses | `Address` | Indian format incl. PIN code. |
| Cart / wishlist | `Cart`, `CartItem`, `WishlistItem` | Guests use `localStorage` until they sign in. |
| Orders + line items | `Order`, `OrderItem` | Prices, GST and address are **snapshotted** at purchase. |
| Payment metadata | `Payment` | Razorpay order/payment id, method (`upi`/`card`/…), status, amount. |
| Refunds | `Refund` | Razorpay refund id, amount, status. |
| Webhook deliveries | `WebhookEvent` | Raw event payload, keyed by Razorpay event id (idempotency). |
| Reviews | `Review` | Tied to a delivered order. |

## What we never store

- **Card numbers, CVV, expiry, UPI PIN, or any raw payment instrument.** These
  are collected by Razorpay Checkout in Razorpay's own iframe. They never reach
  our servers, our logs, or our database.
- Plaintext passwords.
- Plaintext email-verification or password-reset tokens — we email the raw token
  and store only its **SHA-256 hash** (`src/lib/tokens.ts`), so a database leak
  yields no usable tokens.

## Where secrets live

All secrets are environment variables only — never committed. `.env` is
gitignored; `.env.example` documents every variable with placeholder values.

**Server-only** (must never reach the browser):
`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_SECRET`,
`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `CLOUDINARY_API_SECRET`,
`RESEND_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`.

**Public** (safe in client bundles, prefixed `NEXT_PUBLIC_`):
`NEXT_PUBLIC_RAZORPAY_KEY_ID` (the *key id* only, never the secret),
`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_STORE_NAME`,
`NEXT_PUBLIC_APP_URL`.

In production these live in Vercel's environment variables. Rotate
`AUTH_SECRET` and the Razorpay keys if they are ever exposed.

---

## Money integrity

- **All money is integer paise** (₹1 = 100). No float ever touches a currency
  value. Enforced by convention plus tests in `tests/totals.test.ts`.
- **Totals are always recomputed server-side** from database prices
  (`src/lib/cart/pricing.ts` → `src/lib/checkout/totals.ts`). A price or total
  sent from the browser is never trusted; the client only ever sends
  `{ variantId, quantity }`.
- **GST is derived, not added.** Indian retail prices are MRP-inclusive, so tax
  is split out of the inclusive price (`src/lib/checkout/tax.ts`). Buyer state
  vs. seller state decides CGST+SGST (intra-state) or IGST (inter-state).
  Rounding always reconciles: `taxable + tax === inclusive`.

## Payments

1. Server recomputes the total and creates a local `Order` with status `PENDING`.
2. Server calls the Razorpay Orders API with **that server-computed amount**.
3. Client opens Razorpay Checkout with the returned `razorpay_order_id`.
4. Client posts the handler response back.
5. Server verifies `HMAC_SHA256(order_id|payment_id, KEY_SECRET)` using a
   **timing-safe comparison** (`crypto.timingSafeEqual`). Only on a match does
   the order become `CONFIRMED`. **An order is never marked paid on a
   client-side callback alone.**
6. The **webhook is the source of truth** (`/api/webhooks/razorpay`), because
   users close tabs mid-payment. Its signature is verified against the **raw
   request body**.

### Idempotency

Every webhook delivery is recorded in `WebhookEvent` keyed by Razorpay's event
id. A duplicate delivery short-circuits, so stock is never double-decremented
and orders are never duplicated. If processing fails, the key is released so
Razorpay's retry can reprocess. `confirmOrder()` is independently idempotent: a
non-`PENDING` order returns early without touching stock.

### Stock under concurrency

Stock is decremented **inside the same transaction that confirms the order**,
using a conditional update (`WHERE stock >= quantity`). If two customers race
for the last unit, exactly one update matches and the loser's transaction
aborts. Verified by `tests/orders.integration.test.ts`, including a 5-way burst
against 3 units (exactly 3 succeed, stock never goes negative).

---

## Authorization

- **Every server action and route handler re-checks authorization.** Middleware
  (`src/middleware.ts`) is defence-in-depth only — never the sole gate.
- Admin routes require `role === "ADMIN"`, re-checked in every admin action via
  `requireAdminAction()` (`src/lib/admin/guard.ts`).
- **Ownership is enforced in the query itself.** Orders, addresses and carts are
  always fetched with the user id in the `WHERE` clause, so changing an id in a
  request cannot read or modify another user's data.
- Reviews require a `DELIVERED` order containing that product, checked
  server-side; one review per user per product (`@@unique([userId, productId])`).

## Input validation

Every mutation validates its input with **Zod on the server** before touching
the database. Assume all browser input is hostile.

## Rate limiting

Login, signup, password reset, checkout, review submission and image uploads
are rate limited (`src/lib/rate-limit.ts`).

The limiter uses **Upstash Redis** whenever `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` are set — required on serverless, where instances do
not share memory. Without them it falls back to an in-process map (fine for
local development and single-instance deploys). If Upstash is unreachable it
degrades to the local limiter rather than failing open or locking everyone out.

> ⚠️ **Before production:** set the two Upstash variables in Vercel. Without
> them each serverless instance counts separately, which weakens the limits.

## Image uploads

Product and review images upload **directly from the browser to Cloudinary**
using a short-lived signature minted server-side
(`/api/uploads/signature`). `CLOUDINARY_API_SECRET` never leaves the server —
the client only receives the cloud name, public API key, folder, timestamp and
signature. Product uploads are **ADMIN-only**; review uploads require a signed-in
user. Uploads are folder-scoped and rate limited.

## Invoices

A GST tax invoice is available per order at
`/account/orders/[orderNumber]/invoice`, showing the seller GSTIN, place of
supply, and per-line HSN + taxable value + CGST/SGST or IGST. It is generated
only once an order has an invoice number (i.e. is confirmed), and the order is
fetched with the user id in the `WHERE` clause so one customer can never read
another's invoice.

## Other protections

- Passwords: bcrypt cost 12; minimum 8 characters.
- Password reset and email verification tokens are single-use and expiring
  (1 hour / 24 hours), stored hashed.
- Password reset never reveals whether an email is registered.
- Every list query is paginated — no unbounded `findMany`.
- Prisma migrations are committed; never run `db push` against production.
- `robots.txt` disallows `/admin`, `/account`, `/checkout`, `/cart`, `/order`, `/api`.

## Reporting a vulnerability

Email the store owner directly. Do not open a public issue.
