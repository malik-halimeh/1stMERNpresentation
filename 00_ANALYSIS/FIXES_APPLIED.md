# OptiCart — Fixes Applied (2026-07-11)

> Resolution log for the issues found in SECURITY_REVIEW.md and FEATURE_INVENTORY.md.
> Two waves: fixes the team shipped themselves (verified, not re-done), then this session's fixes. Every fix was verified by `server/src/test_fixes.ts` (20/20 passing), a TypeScript build of both workspaces, and an HTTP smoke test against the running server.

---

## Wave 1 — Fixed by the team (verified in commits `5620779`, `992eaea`, `c7f10b8` + merged `test` branch)

| Issue | Status | How it was fixed |
|---|---|---|
| **W5** Password reset dead-end | **[FIXED — by team]** | Redesigned as a 6-digit emailed code flow (same pattern as signup verification): `passwordResetCodeHash` + TTL on User, `POST /auth/reset-password` validating email+code+password (`controllers/auth.ts`), full UI step in `ForgotPassword.tsx`. Completing a reset also verifies the email and rotates the refresh token (revokes attacker sessions). |
| **W3** Coupon limits skipped at checkout | **[FIXED — by team]** | `createCheckoutSession` now re-validates every rule `/coupons/apply` enforces — existence, active, expiry, min-order, **global usage limit, per-user limit** — throwing typed AppErrors instead of silently pricing without the discount (`controllers/order.ts:108-148`). |
| **W10** Low-stock resolve E11000 on repeat cycles | **[FIXED — by team]** | Partial unique index `(productId, variantSku)` filtered to `status:'active'` (`models/LowStockAlert.ts:60-63`) + `LowStockAlert.syncIndexes()` at boot to drop the stale 3-field index (`server.ts`). |
| Mega-menu hardcoded data / broken links | **[FIXED — by team]** | Nav categories now fetched from `GET /categories`; all clicks navigate by **slug** through `goToCategory()`; fake featured items removed (`StorefrontLayout.tsx:16-48,143-198`). |
| Mobile drawer full-reload `<a>` links | **[FIXED — by team]** | Drawer uses the same `goToCategory()`/`navigate()` SPA path; expandable subcategory tree with real data (`StorefrontLayout.tsx:322-376`). |
| Dashboard tiles truncated at 20 | **[FIXED — by team]** | Tiles fetch `?limit=100` with an explanatory comment (`admin/Dashboard.tsx:82-89`). |
| Scroll position kept across SPA navigations | **[FIXED — by team]** | `window.scrollTo(0,0)` on every pathname change (`App.tsx`). |

## Wave 2 — Fixed in this session

| Issue | Status | Fix |
|---|---|---|
| **W1** Stripe webhook trusted unverified input | **[FIXED]** | `/api/orders/webhook` mounted with `express.raw({type:'application/json'})` **before** `express.json` (`server.ts:30-34`) so `constructEvent` receives the exact bytes; verification now **fails closed** — real key + webhook secret ⇒ unsigned/forged payloads get 400 `WEBHOOK_SIGNATURE_MISSING` / `WEBHOOK_SIGNATURE_INVALID` (`controllers/order.ts` stripeWebhook). Mock/dev mode still parses the JSON buffer so the demo MockPaymentForm keeps working. |
| **W2** Fallback JWT secret (+ latent env-loading bug) | **[FIXED]** | `utils/tokens.ts` resolves the secret **lazily** — the old module-load read ran before `dotenv.config()` (ESM import hoisting), meaning tokens were silently signed with the fallback even when `.env` was set. Now: `.env` value honored; production **refuses to boot** without `JWT_ACCESS_SECRET`; dev gets a loud warning + dev-only fallback. |
| **W9** Stock race / oversell at payment | **[FIXED]** | Webhook decrement is an atomic conditional `$inc` (`stock: {$gte: qty}` in the query) so concurrent payments can't drive stock negative; a lost race clamps to 0 with an explicit oversell warning for staff (`controllers/order.ts` webhook loop). |
| **W13** "Refunded" moved no money | **[FIXED]** | `status → refunded` now issues `stripe.refunds.create` (real mode; mock id in mock mode) **before** persisting, populates the `order.refund` subdoc (status/reason/approvedBy/approvedAt/stripeRefundId), and writes the previously-never-used **`refund_decision`** audit entry. A failed Stripe refund aborts the transition (502 `REFUND_FAILED`). |
| **W4** Rate limiter comment/code mismatch (10 000) | **[FIXED]** | Global limiter set to **1000 req/15 min/IP** with an accurate comment (`middleware/rateLimiter.ts`) — generous for normal browsing/classroom NAT, still stops runaway scripts; auth endpoints keep their strict limiter. |
| **W6** `user.ts` leaked raw error objects | **[FIXED]** | Entire controller rewritten onto the AppError → `next(err)` → errorHandler pipeline (typed codes: `USER_NOT_FOUND`, `USER_EMAIL_IN_USE`, `USER_SELF_DELETE`, …). Success response shapes unchanged, so the admin Users page needed no edits. Added missing ObjectId validation on `:id` params. |
| **W11** Review images accepted as raw URLs | **[FIXED]** | `createReview`/`updateReview` no longer read `images` from the body (stored as `[]`, with a comment explaining why); the client never sent them, so no UI change. |
| AuditLog promised indexes missing | **[FIXED]** | Added `actorId`, `actionType`, `targetEntityId` indexes matching the GET /audit-logs filters (`models/AuditLog.ts`) — doc/code parity restored. |
| `/admin/profile` title-only stub | **[FIXED]** | Real page at `pages/admin/Profile.tsx`: identity card (avatar/email/role badge), name editing via `PATCH /auth/profile` (updates AuthContext live), and password guidance pointing to the email-code reset flow. Unused `AdminPage`/`AdminRoute` stubs removed from `App.tsx`. |
| README drift + missing `.env.example` | **[FIXED]** | README: ShopContext (not CartContext), React Router **v7**, real env-var list (only `JWT_ACCESS_SECRET` is read; added `STRIPE_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`, mail vars), email section updated for the code flows. Created `server/.env.example` with mock-friendly defaults; `.gitignore` files gained `!.env.example` so it can actually be committed. |

## Deliberately NOT changed (with reasoning)

| Item | Why left as-is |
|---|---|
| **W8** Register reveals existing emails (409) | Changing it to a silent "code sent" response makes honest signups confusing ("why no code?") — for a demo storefront the UX cost outweighs the enumeration risk; forgot-password/resend already answer uniformly. State it as a conscious tradeoff if asked. |
| **W14** Role changes lag up to 15 min (JWT TTL) | Inherent to stateless access tokens; the short TTL is the mitigation. |
| **W12** View-event spoofing | Bounded by the 50-event batch cap and the (now real) 1000/15 min global limiter; a signed event token is listed as future work. |
| Hard-delete users | Product decision for the team; soft-delete listed as an improvement in PROJECT_AUDIT. |

## Verification evidence

1. **`server/src/test_fixes.ts` — 20/20 passed** (run: `npx tsx src/test_fixes.ts` from `server/`, self-cleaning fixtures):
   lazy JWT roundtrip · low-stock trigger→resolve×2 cycle · webhook fail-closed (missing + forged signature) · mock webhook E2E over a raw Buffer (stock 5→2 atomically, coupon `usedBy` counted, cart cleared) · webhook replay idempotent · oversell guard refuses below-zero · exhausted-coupon checkout rejected · refund populates `order.refund` + `refund_decision` audit · review image URLs dropped · `user.ts` bad-id → AppError.
2. **Type safety:** `tsc --noEmit` clean on the server; `npm run build` (tsc -b + vite) clean on the client.
3. **HTTP smoke (real server, port 5077):** `/api/health` OK · `/api/products` 13 items · `/api/categories` 2 roots · **webhook POST through the actual `express.raw` mount → `{received:true}`** · unknown route → sanitized `ROUTE_NOT_FOUND` envelope · `/api/users` without token → 401 `AUTH_UNAUTHORIZED`.

> Post-fix status of the SECURITY_REVIEW weakness table: W1 ✅ W2 ✅ W3 ✅ (team) W4 ✅ W5 ✅ (team) W6 ✅ W7 (mitigated by design — see review) W8 deliberate W9 ✅ W10 ✅ (team) W11 ✅ W12 accepted W13 ✅ W14 inherent.
