# OptiCart — Architecture Report

> All mechanisms below quote or reference the actual implementation. Commit `1e25f09`.

## 1. Layered Architecture

```
Browser (React 19 + TypeScript, Vite)
  │  pages/ → context/ (Auth, Shop, Toast) → services/api.ts
  ▼
Axios instance (client/src/services/api.ts)
  │  request interceptor: attach in-memory Bearer token
  │  response interceptor: 401 → single-flight refresh → retry
  ▼
Express middleware chain (server/src/server.ts:20-33)
  helmet → cors(CLIENT_URL, credentials) → express.json → urlencoded
  → cookie-parser → morgan → apiRateLimiter
  ▼
routes/index.ts (mounts 15 feature routers under /api)
  ▼
Feature router (per-route authenticate + authorize(...roles) + endpoint rate limiters + Multer where needed)
  ▼
Controller (server/src/controllers/*.ts — validation, business logic, audit writes)
  ▼
Mongoose models (server/src/models/*.ts — schema validation, hooks, indexes)
  ▼
MongoDB (13 collections)
```

Side channels: `services/scheduler.ts` (node-cron) and `services/mailer.ts` (nodemailer) are called from controllers/jobs, not from the request chain.

## 2. Request Lifecycle (concrete example: `GET /api/products?search=fridge`)

1. Page calls `api.get('/products?...')`; request interceptor adds `Authorization: Bearer <memory token>` if present (`api.ts:23-32`) — this endpoint is public so it also works without one.
2. Express runs the global middleware stack; `apiRateLimiter` counts the request (`server.ts:33`).
3. `routes/index.ts:30` dispatches to `productRouter`; `routes/product.ts:30` → `getProducts`.
4. Controller builds a filter object (category→slug/child expansion, price cents conversion, `$text` search), executes `countDocuments` + paged `find` (`controllers/product.ts:42-134`), responds `{success, data, meta:{total,page,limit,pages}}`.
5. Any thrown error goes to `next(error)` → `errorHandler` (`middleware/error.ts`) → uniform `{success:false, error:{code,message,details}}`.

## 3. Authentication Flow (complete)

### 3.1 Login
`POST /auth/login` (`controllers/auth.ts:260-304`): Zod validation → user lookup → bcrypt compare → `isActive` check → email-verified check (unverified users get a fresh code and 403) → `respondWithSession` (`auth.ts:37-61`):
- signs a **15-minute JWT access token** (`utils/tokens.ts:12-15`),
- generates an **opaque refresh token** (`crypto.randomBytes(40)`), stores only its SHA-256 hash on the user, clears the previous-token grace fields,
- sets cookie `refreshToken = "<userId>:<token>"` — `httpOnly`, `secure` in production, `sameSite: 'strict'`, 7 days (`auth.ts:18-23`),
- returns `{accessToken, user}`; the client keeps the access token **in a module variable, never in storage** (`api.ts:6-11`).

### 3.2 Single-flight refresh with rotation + reuse detection
Server (`controllers/auth.ts:311-395`):
- Parse `userId:token` from the cookie; hash the token.
- **Happy path — atomic rotation:** `User.findOneAndUpdate({_id, refreshTokenHash: incomingHash}, {new hash, prevRefreshTokenHash: incomingHash, prevRefreshTokenExpiresAt: now+30s})`. Because the hash match is part of the query, of N concurrent refreshes carrying the same token **exactly one** rotates (`auth.ts:337-345`).
- **Grace path:** if the hash matches `prevRefreshTokenHash` within its 30-s window (`ROTATION_GRACE_MS`, `auth.ts:309`), issue a fresh access token but do **not** rotate again — the browser's shared cookie jar already holds the newest refresh token (`auth.ts:363-378`).
- **Reuse detection:** any other presentation of an old token nulls all refresh hashes, clears the cookie, and returns 403 `AUTH_SESSION_COMPROMISED`, forcing full re-login (`auth.ts:380-391`).

Client (`services/api.ts:34-66`): one shared `refreshPromise` so the mount-time silent refresh, StrictMode double-mount, and any number of concurrent 401 retries all await the **same** rotation — a second parallel refresh would itself trip the server's reuse detection.

### 3.3 Silent refresh on mount
`AuthContext.silentRefresh` (`AuthContext.tsx:59-122`): skipped entirely for guests via a localStorage hint (`opticart_has_session`) to avoid a doomed 401 on every anonymous page load; on success decodes the JWT for id/role, then fetches `/auth/profile` for full identity; a `sessionEpochRef` counter (bumped by login/register/logout) makes stale refresh results no-ops so a slow failing refresh can't wipe a session that a login just established.

### 3.4 401 retry interceptor
`api.ts:69-103`: on 401 (excluding `/auth/login|register|refresh`, guarded by `_retry`), awaits the shared refresh, replays the original request with the new token; if refresh fails, hard-redirects to `/login?redirect=<path>`.

### 3.5 RBAC
`authenticate` verifies the Bearer JWT and populates `req.user {userId, role}`; JWT errors flow to the error handler which maps them to 401 `AUTH_INVALID_TOKEN` / `AUTH_TOKEN_EXPIRED` (`middleware/error.ts:25-32`). `authorize(...allowedRoles)` returns 403 `AUTH_FORBIDDEN` on role mismatch (`middleware/auth.ts:41-53`). Every feature router declares its roles inline (e.g. `routes/user.ts:16` → `authorize('super_admin')`).

## 4. Error-Handling Pipeline

- `AppError(code, message, statusCode, details[])` (`utils/errors.ts`) is the domain error type thrown by controllers.
- `notFound` converts unmatched routes to a 404 AppError (`middleware/error.ts:53-56`).
- `errorHandler` (`error.ts:4-51`) maps: AppError → its own code/status; Mongoose `ValidationError` → 400 `DB_VALIDATION_ERROR`; `JsonWebTokenError`/`TokenExpiredError` → 401; everything else → 500. Response shape is always `{success:false, error:{code,message,details}}`; stack traces are logged only outside production.
- Client mirror: `utils/apiError.ts` unwraps `error.message` from that envelope for toasts.
- Exception to the pattern: `controllers/user.ts` responds directly with `res.status(...)` and its catch blocks embed the raw `error` object in 500 responses — inconsistent and a minor information-disclosure risk (see SECURITY_REVIEW §W6).

## 5. Database Connection Resilience

`config/db.ts`: `maxPoolSize: 10`, `autoIndex: true`. Event-driven recovery: on `disconnected`, `handleReconnect` retries up to **5 times at 5-second intervals**, resets the counter on a successful `connected` event, and calls `process.exit(1)` when the budget is exhausted (fail-fast so a supervisor can restart the process). The server only begins listening after the initial `connectDB()` resolves (`server.ts:48-53`).

## 6. Scheduler (node-cron)

`services/scheduler.ts`, registered at startup (`server.ts:51`), one daily job at 02:00 running two passes:
- **A. Co-occurrence recommendation engine** (`scheduler.ts:30-123`): loads all `purchase` ProductEvents with a userId, groups per user, deduplicates per-product keeping the best recency weight `1/(daysSince+1)`, accumulates pair weights across users, and upserts the **top-10 neighbours per product** into `productRecommendations`. Recommendations are never computed on request — `GET /product-recommendations` reads the cache only (`controllers/recommendation.ts`).
- **B. Trending/most-selling flags** (`scheduler.ts:127-177`): 7-day windows — top-8 products by ordered quantity → `isMostSelling`; top-8 by view events → `isTrending`; flags reset-then-set.

## 7. Mailer

`services/mailer.ts`: transporter built lazily on first send (deliberate — dotenv runs after module imports, documented at `mailer.ts:10-12`). Priority: Gmail app-password → generic SMTP → **console stub**. Four message types: verification code, order confirmation, order status change (with cancellation/refund reason), and low-stock alerts addressed to every active inventory manager (`mailer.ts:92-111`). Sends from controllers are fire-and-forget with `.catch` logging so mail failures never fail the request.

## 8. Stripe Flow

1. **Session:** `POST /orders/checkout-session` (`controllers/order.ts:53-177`) — snapshots the cart with live stock checks, computes coupon discount, creates a Stripe PaymentIntent (`stripe.paymentIntents.create({amount, currency:'usd', metadata})`) **or mock ids** when `STRIPE_SECRET_KEY` is absent/`sk_test_mock_key`, then persists a draft order (`status:'pending'`, `paymentStatus:'pending'`, snapshot items including `unitCostCents` for margin math).
2. **Payment:** real mode renders Stripe `PaymentElement` (`Checkout.tsx:35-88`); mock mode renders `MockPaymentForm` which POSTs a fabricated `payment_intent.succeeded` event to the webhook itself (`Checkout.tsx:101-120`).
3. **Webhook:** `POST /orders/webhook` (`order.ts:180-286`) — verifies the Stripe signature when both secret and header exist, **but falls back to the parsed body if verification throws** (`order.ts:192-201`); since `express.json()` already consumed the raw body (`server.ts:29`), verification can never succeed and the fallback always engages — see SECURITY_REVIEW §W1. On `payment_intent.succeeded` with an idempotency guard (`paymentStatus === 'pending'`): decrement variant stock (floor 0) + low-stock triggers, increment coupon `usedBy`, clear the cart, insert purchase ProductEvents, send confirmation email.
4. **Confirmation is human:** the order remains `pending` until staff advances it — payment success only captures funds (`order.ts:211-214`, surfaced to clients via `GET /orders/status/:paymentIntentId`).

## 9. Cloudinary Flow

`routes/product.ts:16-27`: Multer **memory storage**, 5 MB/file, field limits (`images` ≤5, `variantImages` ≤20) — JSON PATCH requests pass through untouched. Controller streams each buffer through `cloudinary.uploader.upload_stream` (`config/cloudinary.ts:38-53`), stores `{url: secure_url, publicId}`. Variant photos are matched to variants by an `imageSlot` index carried in the variant JSON (`controllers/product.ts:186-203`). Without `CLOUDINARY_URL` the service returns deterministic mock URLs so the whole flow works offline.

## 10. Frontend Architecture Notes

- **State:** Context API only — `AuthContext` (session), `ShopContext` (cart badge + wishlist ids with guest/auth branching), `ToastContext`. No Redux/query cache; pages own their fetch state.
- **Guest commerce:** localStorage cart (`utils/guestCart.ts`, full product snapshots) and wishlist (helpers in `pages/Wishlist.tsx`); `utils/guestMerge.ts` posts both to `/cart/merge` + `/wishlist/merge` after any successful sign-in, then clears local copies. Server merge resolves quantity conflicts with `max(quantity)` capped at stock (`controllers/cart.ts:304-325`).
- **Routing:** `App.tsx` — public storefront, `ProtectedRoute` for customer pages, per-path admin routes (sidebar highlight + no full reloads), `StaffGate` redirecting staff away from the storefront, catch-all → home.
- **Design system:** Tailwind token theme (`tailwind.config.js`) + 17 reusable `ui/` components; icons via lucide-react.
