# OptiCart — Security Review (honest audit)

> **UPDATE 2026-07-11:** most weaknesses below are now RESOLVED — W1, W2, W4, W6, W9, W11, W13 fixed this session; W3, W5, W10 fixed by the team. See **FIXES_APPLIED.md** for the resolution log and test evidence. This document is kept as the pre-fix audit (useful for the "what we found and how we fixed it" presentation arc).

> Two lists: what is genuinely done well (with evidence), and real weaknesses found in the code.
> Weaknesses double as prepared answers to "what would you improve?" — do not hide them in the presentation; owning them scores better than being caught by them. Commit `1e25f09`.

---

## A. Implemented Well

| # | Control | Evidence |
|---|---|---|
| S1 | **Helmet** secure headers on every response | `server.ts:20` |
| S2 | **CORS origin normalization** — single origin from `CLIENT_URL`, trailing slash stripped because browsers match `Access-Control-Allow-Origin` exactly; `credentials: true` scoped to that one origin | `server.ts:21-28` |
| S3 | **Scoped rate limiting** — auth 10 *failed* attempts/15 min (`skipSuccessfulRequests: true` so account switching never burns budget); coupon-apply 20/15 min keyed by **userId** not IP; `/auth/refresh` and `/auth/logout` deliberately exempt because interceptors fire them automatically | `middleware/rateLimiter.ts:7-21,25-43`; `routes/auth.ts:19-33` |
| S4 | **bcrypt cost 12** for all password writes (register, admin create/update, Google provisioning) | `controllers/auth.ts:79-80,231-235`; `controllers/user.ts:154-155,211-214` |
| S5 | **JWT verification** with error-type mapping (invalid vs expired → distinct 401 codes) | `middleware/auth.ts:27-37`; `middleware/error.ts:25-32` |
| S6 | **RBAC** enforced server-side on every protected router; client guards are UX only | `middleware/auth.ts:41-53`; e.g. `routes/user.ts:16`, `routes/analytics.ts:13` |
| S7 | **HTTP-only refresh cookie** — `httpOnly`, `secure` in production, **`sameSite: 'strict'`** (also a strong CSRF mitigation for the refresh endpoint), 7-day cap | `controllers/auth.ts:18-23` |
| S8 | **Refresh-token rotation with reuse revocation** — only the SHA-256 hash is stored; atomic `findOneAndUpdate` rotation; 30-s grace for multi-tab races; reuse outside grace revokes the whole session (403 `AUTH_SESSION_COMPROMISED`) | `controllers/auth.ts:309-391`; `utils/tokens.ts:23-30` |
| S9 | **Access token in memory only** — never localStorage/sessionStorage, so XSS can't exfiltrate a persisted token; page reload re-authenticates via the cookie | `services/api.ts:6-11`; `AuthContext.tsx:59-122` |
| S10 | **Email verification gate** — sessions only open after a hashed, 15-min-TTL 6-digit code is confirmed; login re-issues codes for unverified accounts | `controllers/auth.ts:25-34,131-169,291-298` |
| S11 | **Anti-enumeration responses** — forgot-password and resend-verification return the same body whether or not the account exists | `controllers/auth.ts:172-192,447-457` |
| S12 | **Google ID-token validation** — tokeninfo check plus explicit `aud` (client-id) and `email_verified` assertions | `controllers/auth.ts:208-222` |
| S13 | **Multer limits** — 5 MB/file, bounded file counts (images ≤5, variantImages ≤20), memory storage with no disk writes | `routes/product.ts:16-27` |
| S14 | **ObjectId validation everywhere** user-supplied ids reach queries (products, cart, orders, reviews, coupons, audit filters, wishlist, refresh-cookie userId) | e.g. `controllers/order.ts:327,376`; `controllers/auth.ts:327` |
| S15 | **Price/money validation** — integer-cents math throughout; non-negative checks on prices; discounts capped at subtotal so totals can't go negative | `controllers/product.ts:271-274`; `controllers/coupon.ts:71-72`; `controllers/order.ts:119-123` |
| S16 | **Regex injection escaped** for all `$regex` searches (orders, users, reviews) | `utils/escapeRegex.ts`; used at `controllers/order.ts:342`, `user.ts:53`, `review.ts:339` |
| S17 | **Mass-assignment protection** — Zod allowlist for admin user updates; `passwordHash`/`refreshTokenHash` unreachable; role/isActive changes forced through dedicated **audited** endpoints with self-change blocks | `validators/user.ts:34-60`; `controllers/user.ts:298-404` |
| S18 | **Sensitive-field stripping** on every user read (`-passwordHash -refreshTokenHash -prevRefreshTokenHash …`) | `controllers/user.ts:14-15,93-94` |
| S19 | **Append-only audit log** — schema pre-hooks throw on any update/delete path; denormalized actorName survives account deletion | `models/AuditLog.ts:78-94` |
| S20 | **Ownership checks** on order detail/feedback (owner or staff), review edit (owner + 30-day window) | `controllers/order.ts:387-389,429-431`; `controllers/review.ts:209-218` |
| S21 | **Secrets hygiene (eventually)** — `.env` untracked and gitignored; the accidental commit was actively removed (`64c6488 "Remove sensitive file…"`) | `.gitignore`; `server/.gitignore` |

---

## B. Real Weaknesses / Gaps (improvement answers)

| # | Weakness | Evidence | Improvement to state |
|---|---|---|---|
| **W1** | **Stripe webhook signature verification is structurally broken → webhook trusts unverified input.** `express.json()` consumes the raw body globally (`server.ts:29`), but `stripe.webhooks.constructEvent` requires the raw payload — so verification always throws, and the code **falls back to trusting `req.body`** (`controllers/order.ts:192-201`). In mock mode the client even posts the webhook itself (`Checkout.tsx:107`). Anyone who can reach `/api/orders/webhook` with a known `paymentIntentId` can mark an order paid, decrement stock and burn coupons. | `server.ts:29`; `order.ts:180-201` | Mount the webhook route with `express.raw({type:'application/json'})` before the JSON parser, and **fail closed** — reject when signature verification fails instead of falling back. |
| **W2** | **Hardcoded fallback JWT secret.** If `JWT_ACCESS_SECRET` is unset the server silently signs with `'fallback_access_secret_key_987654'` — anyone reading the public repo could forge tokens against a misconfigured deployment. Same literal duplicated in the reset-token signer. | `utils/tokens.ts:4`; `controllers/auth.ts:462` | Fail fast at boot when required secrets are missing (config validation, e.g. a Zod env schema). |
| **W3** | **Coupon limits skipped at checkout.** `createCheckoutSession` validates isActive/expiry/min-order but not `usageLimit`/`perUserLimit` — sending `couponCode` directly to checkout bypasses both caps that `/coupons/apply` enforces. | `controllers/order.ts:110-121` vs `controllers/coupon.ts:49-59` | Extract one `validateCoupon(user, code, subtotal)` used by both endpoints. |
| **W4** | **Global rate limiter effectively off.** Comment says "100 requests per 15 minutes" but `max: 10000` — brute-force pressure on non-auth endpoints is essentially unthrottled (auth endpoints have their own limiter). | `middleware/rateLimiter.ts:46-49` | Restore a realistic global cap; add a store (Redis) if horizontally scaled. |
| **W5** | **Password reset flow dead-ends.** Reset link is only console-logged and targets `/reset-password`, which exists neither as a client route (`App.tsx`) nor as a server endpoint — `ResetPasswordValidator` is dead code. Not exploitable, but a broken account-recovery path is a security-adjacent availability gap. | `controllers/auth.ts:459-474`; `validators/auth.ts:27-37` | Implement `POST /auth/reset-password` verifying the JWT `type:'reset'` claim + client page. |
| **W6** | **Raw error objects returned to clients.** `controllers/user.ts` catch blocks send `{…, error}` with the raw exception in 500 responses (Mongo errors can include query internals); bypasses the sanitized errorHandler envelope used everywhere else. | `controllers/user.ts:76-81,109-115,177-183,…` | Route all errors through `next(err)`/AppError like the other controllers. |
| **W7** | **No CSRF token layer.** Mitigated for the refresh cookie by `sameSite: 'strict'` (S7) and by state-changing APIs requiring the Bearer header — but the webhook (W1) and any future cookie-authenticated endpoint have no CSRF defense in depth. | `controllers/auth.ts:18-23` | Keep strict same-site; add origin verification on the webhook after fixing W1. |
| **W8** | **Account enumeration via register.** Register returns 409 `AUTH_EMAIL_IN_USE` for existing verified emails — inconsistent with the anti-enumeration stance of forgot-password/resend (S11). Login also distinguishes deactivated accounts (403) from wrong passwords (401). | `controllers/auth.ts:101`; `:284-287` | Accept and send "verification code sent" regardless, completing verification only for genuinely new accounts. |
| **W9** | **Stock race between checkout and payment.** Stock is validated at session creation and decremented only in the webhook; two buyers can both pass validation for the last unit — the later webhook clamps at 0 (`Math.max(0, …)`) and the order still succeeds, silently overselling. | `controllers/order.ts:87-93,223` | Atomic conditional decrement (`findOneAndUpdate` with `stock: {$gte: qty}`) at payment time, refusing/refunding on failure. |
| **W10** | **Low-stock resolve can 500 on repeat cycles** — unique index `(productId, variantSku, status)` permits only one *resolved* doc per variant, so the second resolve throws E11000 (the code comment believes otherwise). Availability bug in an admin security-relevant workflow (inventory oversight). | `models/LowStockAlert.ts:56-59` | Partial unique index filtered to `{status:'active'}` only. |
| **W11** | **Review images accepted as raw client-supplied URLs** — `images` array passes straight from `req.body` into the document with no upload pipeline or URL validation; a malicious client can store arbitrary external URLs rendered to other users. | `controllers/review.ts:85,141` | Either wire review images through the same Multer→Cloudinary path as products, or drop the field. |
| **W12** | **View events unauthenticated and spoofable** — `/product-events/batch` is public by design (anonymous views), so trending flags (`isTrending`) can be inflated by a trivial script; batch cap of 50 limits but doesn't prevent it. | `routes/productEvents.ts:14-50`; `scheduler.ts:145-152` | Rate-limit per IP, or sign a lightweight session token for event submission. |
| **W13** | **Refunded ≠ refunded.** Marking an order `refunded` performs no Stripe refund call and never populates `order.refund`; customers are told "refunded" by email/notification while no money moves. Business-integrity issue rather than intrusion risk. | `controllers/order.ts:460-583` (absence); `models/Order.ts:19-25` | Implement `stripe.refunds.create` on the refund transition + `refund_decision` audit entry. |
| **W14** | **JWT payload trusted for role between refreshes.** Role changes/deactivation take effect only when the 15-min access token expires — a just-demoted or deactivated staff account keeps admin API access up to 15 minutes. Inherent to stateless JWTs; worth stating as a conscious tradeoff. | `middleware/auth.ts:27-33`; token TTL `utils/tokens.ts:14` | Short TTL already bounds it; optionally check `isActive` on sensitive endpoints. |

---

## C. One-line posture summary (for the presentation)

The auth core (rotation, reuse detection, in-memory tokens, RBAC, audit trail) is genuinely above student-project standard; the real gaps cluster around **third-party trust boundaries** (Stripe webhook raw body, coupon revalidation, env-secret fallbacks) — which is itself the lesson: *the code you write is usually safer than the seams where systems meet.*
