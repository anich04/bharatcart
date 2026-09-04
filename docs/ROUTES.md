# BharatCart — Route Map (Phase 0, for review)

Next.js 15 App Router. **Server Components by default**; `"use client"` only where
interactivity requires it. **Mutations are server actions** (co-located `actions.ts`),
not REST endpoints — except the handful of API routes below that must be HTTP
(webhooks, OAuth, uploads, sitemap). Every server action and route handler
**re-checks auth/ownership** — never trusts middleware or hidden UI.

Legend: 🌐 public · 🔒 logged-in · 🛡️ ADMIN only

## Public catalog (Phase 1) 🌐
| Route | Notes |
|---|---|
| `/` | Home: hero, category rails, featured + new-arrivals carousels |
| `/c/[...slug]` | Category / listing. Filters + sort + pagination **in URL query** (`?price=…&brand=…&rating=…&inStock=1&sort=…&page=…`) |
| `/search` | Postgres full-text search over title+description+brand (`?q=…` + same filters) |
| `/p/[slug]` | Product detail: gallery, buy box, variant picker, specs, reviews, similar |
| `/b/[slug]` | Brand listing (optional, same engine as category) |

## Account & cart (Phase 2)
| Route | Access | Notes |
|---|---|---|
| `/cart` | 🌐 | Guest cart in localStorage; user cart in DB; merged on login |
| `/wishlist` | 🔒 | Save-for-later |
| `/login` `/signup` | 🌐 | Email/password + Google; rate-limited |
| `/forgot-password` `/reset-password` | 🌐 | Emailed hashed token |
| `/verify-email` | 🌐 | Email verification via hashed token |
| `/account` | 🔒 | Profile |
| `/account/addresses` | 🔒 | Address book (multiple, one default, PIN format) |
| `/account/orders` | 🔒 | Order history (paginated) |
| `/account/orders/[orderNumber]` | 🔒 | Order detail — **ownership checked** |

## Checkout & payments (Phase 3) 🔒
| Route | Notes |
|---|---|
| `/checkout` | Address → payment mode (Prepaid/COD) → review. Totals **recomputed server-side** |
| `/checkout/payment` | Opens Razorpay Checkout with server-created `razorpay_order_id` |
| `/order/confirmation/[orderNumber]` | Post-payment landing (order state comes from server/webhook, not client callback) |

## Admin (Phase 4) 🛡️  — gated in middleware **and** re-checked in every action
| Route | Notes |
|---|---|
| `/admin` | Dashboard: revenue, orders, top products, date-range selectable |
| `/admin/products` | List/search/filter (paginated) |
| `/admin/products/new` · `/admin/products/[id]` | CRUD, image upload, variants, stock, SEO fields |
| `/admin/products/import` | Bulk CSV import |
| `/admin/orders` | List, filter by status (paginated) |
| `/admin/orders/[id]` | Detail; update status; attach carrier + tracking number |
| `/admin/inventory` | Low-stock alerts |
| `/admin/customers` | Customer list (paginated) |
| `/admin/coupons` · `/admin/coupons/[id]` | Coupon CRUD (percent/flat, min-order, usage cap, expiry) |
| `/admin/reviews` | Moderation (hide abusive) |

## API route handlers (must be HTTP, not server actions)
| Route | Method | Purpose |
|---|---|---|
| `/api/auth/[...nextauth]` | * | Auth.js v5 (credentials + Google) |
| `/api/checkout/razorpay/order` | POST 🔒 | Create Razorpay order from **server-computed** amount |
| `/api/checkout/razorpay/verify` | POST 🔒 | Verify HMAC signature (timing-safe) → CONFIRMED |
| `/api/webhooks/razorpay` | POST 🌐 | `payment.captured` / `payment.failed` / `refund.processed`; signature-verified; **idempotent**; source of truth |
| `/api/uploads/*` | POST 🛡️ | Cloudinary signed uploads (admin) + review images (user) |
| `/api/serviceability` | GET 🌐 | COD PIN-code serviceability check |
| `/api/search/suggest` | GET 🌐 | Type-ahead suggestions |

## SEO / infra (Phase 5) 🌐
`/sitemap.xml` · `/robots.txt` · Product JSON-LD (Product + Offer + AggregateRating) ·
Open Graph metadata · `not-found.tsx` (404) · `error.tsx` (500) · `loading.tsx` skeletons.

## Middleware
- `/admin/**` → require session + `role === ADMIN` (defence-in-depth; **each admin
  action re-checks** the role and never relies on this alone).
- `/account/**`, `/checkout/**`, `/wishlist` → require session.
- Note: NextAuth v5 middleware runs on the edge; the DB role re-check happens in the
  server action / route handler (Node runtime), which is the authoritative gate.
