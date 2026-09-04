# BharatCart — Route Map

Next.js 15 App Router. **Server Components by default**; `"use client"` only where
interactivity genuinely requires it. **Mutations are server actions**
(`src/lib/actions/*`), not REST endpoints — except the handful of API routes below
that must be HTTP (OAuth, payment verification, webhooks, upload signing).

Every server action and route handler **re-checks auth and ownership**. Middleware
is defence-in-depth only, never the sole gate.

Legend: 🌐 public · 🔒 signed-in · 🛡️ ADMIN only

## Public catalog 🌐

| Route | Notes |
| --- | --- |
| `/` | Home: hero, category grid, featured + new-arrival rails |
| `/c/[...slug]` | Category listing. Filters + sort + pagination live **in the URL** (`?brand=…&minPrice=…&maxPrice=…&rating=…&inStock=1&sort=…&page=…`) |
| `/search` | Postgres full-text search over title + description, plus brand matching (`?q=…`, same filters) |
| `/p/[slug]` | Product detail: gallery, variant picker, specs, rating distribution, reviews, similar products, Product JSON-LD |

## Account & cart

| Route | Access | Notes |
| --- | --- | --- |
| `/cart` | 🌐 | Guest cart in `localStorage`; signed-in cart in the DB; merged on login |
| `/wishlist` | 🔒 | Saved products (paginated) |
| `/login` · `/signup` | 🌐 | Email/password + Google (Google shown only when configured); rate limited |
| `/forgot-password` · `/reset-password` | 🌐 | Emailed single-use hashed token |
| `/verify-email` | 🌐 | Email verification via hashed token |
| `/account` | 🔒 | Profile (name, phone, verification status) |
| `/account/addresses` | 🔒 | Address book — multiple, one default, Indian format |
| `/account/orders` | 🔒 | Order history (paginated) |
| `/account/orders/[orderNumber]` | 🔒 | Order detail — **ownership enforced in the query** |
| `/account/orders/[orderNumber]/invoice` | 🔒 | GST tax invoice, print/PDF — **ownership enforced** |

## Checkout & payment 🔒

| Route | Notes |
| --- | --- |
| `/checkout` | Address → payment mode (Prepaid/COD) → coupon → review. Totals **recomputed server-side**; Razorpay Checkout opens in-page |
| `/order/confirmation/[orderNumber]` | Post-order landing. Shows "payment pending" until the webhook confirms |

## Admin 🛡️

Gated in middleware **and** re-checked by `requireAdminAction()` in every mutation.

| Route | Notes |
| --- | --- |
| `/admin` | Dashboard: revenue, orders, AOV, pending, top products, recent orders, low-stock alert; date range 7d/30d/90d/all |
| `/admin/orders` | List + status filter + search by order no./name/phone (paginated) |
| `/admin/orders/[id]` | Detail; status transitions; carrier + tracking; refund |
| `/admin/products` | List + search + status filter (paginated) |
| `/admin/products/new` · `/admin/products/[id]` | Create/edit: variants, stock, GST rate, HSN, SEO, Cloudinary image upload |
| `/admin/products/import` | Bulk CSV import (create/update matched on slug) |
| `/admin/inventory` | Low stock with adjustable threshold and inline stock editing |
| `/admin/coupons` | Coupon create/edit/enable/disable |
| `/admin/reviews` | Moderation — hide/unhide, filter to hidden |
| `/admin/customers` | Customer list with order count and lifetime spend (paginated) |

## API route handlers

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/auth/[...nextauth]` | * | Auth.js v5 (credentials + Google) |
| `/api/checkout/razorpay/verify` | POST 🔒 | Verifies the Checkout HMAC signature (timing-safe), then confirms the order |
| `/api/webhooks/razorpay` | POST 🌐 | `payment.captured` / `payment.failed` / `refund.processed`; raw-body signature verified; **idempotent**; the source of truth |
| `/api/uploads/signature` | POST 🔒 | Mints a Cloudinary upload signature. `products` is ADMIN-only, `reviews` any signed-in user; the API secret never leaves the server |

> The Razorpay **order** is created inside the `placeOrderAction` server action
> (not a REST route), so the amount can never originate from the client.

## SEO / infra 🌐

`/sitemap.xml` (categories + active products) · `/robots.txt` (disallows
`/admin`, `/account`, `/checkout`, `/cart`, `/wishlist`, `/order`, `/api`, auth
pages) · `not-found.tsx` (404) · `error.tsx` (500) · `loading.tsx` skeletons on
listing, search and product routes · Open Graph metadata · Product + Offer +
AggregateRating JSON-LD.

## Middleware

Matcher: `/account/**`, `/checkout/**`, `/wishlist/**`, `/admin/**`.

- Not signed in → redirect to `/login?callbackUrl=…`
- `/admin/**` additionally requires `role === "ADMIN"`, else redirect to `/`

Middleware runs on the edge using an adapter-free auth config
(`src/auth.config.ts`), so Prisma and bcrypt stay out of the edge bundle. The
authoritative role/ownership checks happen in the Node runtime.
