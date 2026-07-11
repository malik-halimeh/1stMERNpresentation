# OptiCart — Repository Map

> Every line derived from reading the file, not from its name. Generated 2026-07-10 from commit `1e25f09`.
> Team: **Haya** = Frontend, **Mahmod** = Database, **Malik** = Backend + architecture.

## Root

| File | Responsibility |
|---|---|
| `package.json` | npm-workspaces monorepo root (`workspaces: ["client","server"]`); cross-workspace scripts (`dev-client`, `dev-server`, `build-all`, `lint-all`, `format-all` via Prettier) |
| `.prettierrc` | Shared Prettier config for both workspaces |
| `.gitignore` | Ignores `node_modules/`, `dist/`, `.env`, `.env.*`, logs |
| `README.md` | Quick start, seed summary, test credentials (3 roles), test coupons, Stripe mock-mode notes, API overview table, cron-job description, env-var list. **[DOC DRIFT]** references `CartContext` (real name is `ShopContext`), "React Router v6" (installed: v7), and `server/.env.example` (file does not exist) |
| `OptiCart_Database_Structure.md` | **Deleted in working tree, exists at git HEAD.** v1 data-model spec: 11 collections, ER diagram, embed-vs-reference rationale |
| `OptiCart_Database_Structure_v4_full.md` | **Deleted in working tree, exists at git HEAD.** Full v4 spec: 12 collections (adds `productRecommendations`), per-collection field tables, index list, scaling controls for `productEvents`, revenue/profit scope boundary. Does **not** include `notifications` (added later in code) |
| `structure.txt`, `project-structure.txt` | Stray generated directory listings (untracked / committed); no functional role |

## server/

| File | Responsibility |
|---|---|
| `package.json` | Express 4, Mongoose 8, TypeScript 5.4, tsx dev runner, bcryptjs, jsonwebtoken, zod, multer 2, cloudinary 2, stripe 15, node-cron 4, nodemailer 9, helmet 7, express-rate-limit 8, cookie-parser, cors, morgan; `npm run seed` |
| `seed.ts` (572) | Drops ALL collections (native drop for append-only auditLogs), seeds 3 users (1/role, bcrypt cost 10), 4 categories (2 parent + 2 child), 12 products (2–3 variants), 5 orders across statuses, 8 verified-purchase reviews, 2 coupons, 1 active low-stock alert; placehold.co images |
| `.env` | Local secrets — untracked (was committed once, removed in `64c6488`) |
| `.eslintrc.json`, `tsconfig.json` | Lint/compile config (ESM `NodeNext`, output `dist/`) |

### server/src

| File | Responsibility |
|---|---|
| `server.ts` | App entry: helmet → CORS (single origin from `CLIENT_URL`, trailing-slash stripped, credentials) → `express.json` → urlencoded → cookie-parser → morgan → global rate limiter → `/api` router → health check → `notFound` → `errorHandler`. Connects DB **then** listens and starts cron jobs |
| `check_orders.ts`, `test_auth.ts`, `test_core_apis.ts`, `verify_db.ts` | Manual dev verification scripts run with tsx against a live DB (auth flow, core API models, DB state, order inspection). Not automated tests — no test framework/runner exists |

### server/src/config

| File | Responsibility |
|---|---|
| `db.ts` | Mongoose connect with `maxPoolSize: 10`, `autoIndex: true`; reconnect handler: 5 retries × 5 s, then `process.exit(1)`; resets counter on successful connect |
| `cloudinary.ts` | Cloudinary v2 config; **mock mode** when `CLOUDINARY_URL` missing/`cloudinary://mock` (returns fake URLs); `uploadImageBuffer()` streams a Multer memory buffer via `upload_stream` |

### server/src/middleware

| File | Responsibility |
|---|---|
| `auth.ts` | `authenticate` (Bearer JWT → `req.user {userId, role}`), `authorize(...roles)` RBAC guard; extends Express `Request` typing |
| `error.ts` | `errorHandler`: maps `AppError`, Mongoose `ValidationError` (400), `JsonWebTokenError` (401), `TokenExpiredError` (401) to `{success:false, error:{code,message,details}}`; stack logged outside production. `notFound` → 404 AppError |
| `rateLimiter.ts` | `authRateLimiter` 10 failed/15 min/IP (`skipSuccessfulRequests`); `couponApplyRateLimiter` 20/15 min keyed by userId; `apiRateLimiter` global — **comment says 100/15 min but `max: 10000`** [MISMATCH] |

### server/src/models (13 collections)

| File | Responsibility |
|---|---|
| `User.ts` | name/email(unique)/passwordHash/role enum(3)/`refreshTokenHash` + `prevRefreshTokenHash`+expiry (rotation grace)/addresses[]/isActive/`isEmailVerified` + code hash + expiry/`authProvider` local\|google |
| `Product.ts` | name/slug(unique, pre-validate slugify)/description/brand/categoryId(ref+index)/basePriceCents/embedded `variants[]` {sku, color, size, capacity, stock, priceDeltaCents, costPriceCents, lowStockThreshold(10), optional image}/images[]{url,publicId}/denormalized ratingAvg+reviewCount/isTrending/isMostSelling/searchKeywords/meta (SEO). Indexes: text(name+searchKeywords), (categoryId, basePriceCents). Virtual `reviews` populate |
| `Category.ts` | Self-referencing 2-level tree via `parentId`; slug unique + slugify hook; createdAt only |
| `Cart.ts` | 1:1 user (unique index); embedded items {productId, variantSku, quantity≥1, priceAtAddCents} |
| `Wishlist.ts` | 1:1 user (unique index); `productIds[]` refs |
| `Order.ts` | orderNumber(unique)/userId(index)/snapshot items {productId, name, variantSku, unitPriceCents, unitCostCents, quantity}/subtotal-discount-total cents/couponCode (value-ref)/shippingAddress snapshot/status enum 7 (index)/statusHistory[] {status, timestamp, note, updatedBy}/paymentIntentId/paymentStatus/`refund` subdoc (never populated by any controller — see FEATURE_INVENTORY)/`feedback` subdoc (rating 1–5 + text ≤2000)/deliveredAt/cancelledAt. Compound (status, createdAt) |
| `Coupon.ts` | code unique, uppercased in pre-validate; type percentage\|fixed; minOrderValueCents; expiryDate; usageLimit (global); perUserLimit; `usedBy[]` {userId,count}; isActive |
| `Review.ts` | productId(index)/userId/orderId (verified-purchase proof, required)/rating 1–5/text/images[]/isFlagged/isRemoved (soft delete)/editedAt. **Unique (userId, productId)** |
| `LowStockAlert.ts` | productId/variantSku/thresholdAtTrigger/currentStock/status active\|resolved/resolvedAt. **Unique (productId, variantSku, status)** — comment claims it allows multiple resolved alerts, but the unique index also blocks a *second* resolved alert per variant [KNOWN ISSUE — see FEATURE_INVENTORY §Low-stock] |
| `AuditLog.ts` | Append-only: pre-hooks throw on any update/delete; actorId + denormalized actorName; 8 action types (`stock_update, order_status_change, refund_decision, role_change, account_status_change, coupon_cud, review_removal, user_delete`); polymorphic target; `changeDelta {before, after}`; timestamp indexed. `refund_decision` is declared but never written anywhere |
| `Notification.ts` | In-app bell notifications (order status changes); userId(index)/orderId/title/message/isRead; index (userId, createdAt desc). **Not in the v4 DB doc** — added during implementation |
| `ProductEvent.ts` | Analytics feed: userId(nullable)/productId/eventType view\|cart_add\|purchase; compound (userId, eventType, timestamp); **TTL index 180 days** |
| `ProductRecommendation.ts` | Precomputed cache: productId unique → `recommendedProductIds[]`, computedAt. Written only by the cron engine |

### server/src/routes → controllers

| Route file | Mounted at | Controller | Endpoints (method path — access) |
|---|---|---|---|
| `index.ts` | `/api` | — | Mounts 15 routers; `/ping`; `/admin-stub` (super_admin RBAC test) |
| `auth.ts` | `/auth` | `auth.ts` (505) | POST register, verify-email, resend-verification, google, login, forgot-password (all behind `authRateLimiter`); POST refresh, logout (deliberately NOT rate-limited); GET/PATCH profile (auth). **No reset-password endpoint** despite `ResetPasswordValidator` existing [PARTIAL] |
| `product.ts` | `/products` | `product.ts` (396) | GET `/` (public list: category id/slug + child cats, price $→cents, rating, sort, `inStock`, text search, pagination ≤100), GET `/by-ids` (public batch), GET `/:slug` (public + reviews populate); POST `/`, PATCH `/:id`, DELETE `/:id` (manager+admin, Multer fields images≤5/variantImages≤20, 5 MB cap; delete blocked if product in active order; stock PATCH writes `stock_update` audit) |
| `category.ts` | `/categories` | `category.ts` (140) | GET `/` public 2-level tree; POST/PATCH/DELETE manager+admin (self-parent guard; delete blocked while subcategories exist) |
| `cart.ts` | `/cart` | `cart.ts` (282) | All roles authenticated: GET `/` (live revalidation: drops deleted products/variants, flags priceChanged/outOfStock), POST `/items` (duplicate row → `alreadyInCart`), PATCH/DELETE `/items/:productId`, POST `/merge` (guest merge, max-quantity conflict rule, stock-capped) |
| `wishlist.ts` | `/wishlist` | `wishlist.ts` (130) | All roles authenticated: GET `/`, POST `/merge`, POST `/:productId` (duplicate-aware), DELETE `/:productId` |
| `coupon.ts` | `/coupons` | `coupon.ts` (265) | POST `/apply` (auth + per-user rate limit; validates active/expiry/min-order/global-limit/per-user-limit, caps at subtotal); GET/POST/PATCH/DELETE staff CUD — all CUD write `coupon_cud` audit entries |
| `review.ts` | `/reviews` | `review.ts` (316) | GET `/product/:productId` public paginated; GET `/` staff moderation list (regex search); POST `/` (verified purchase = delivered order required; Mongo transaction with standalone-server sequential fallback; recalcs denormalized rating); PATCH `/:id` owner ≤30 days; DELETE `/:id` staff soft-remove + `review_removal` audit |
| `order.ts` | `/orders` | `order.ts` (508) | POST `/webhook` public (Stripe); authenticated: GET `/` (staff = all + status filter + orderNumber regex search, `?scope=mine` for personal), POST `/checkout-session` (stock validation, coupon discount, Stripe PaymentIntent or mock, draft pending order), GET `/status/:paymentIntentId` (poll), GET `/:id` (owner-or-staff), POST `/:id/feedback` (owner, post-confirmation); PATCH `/:id/status` staff (state machine with terminal lock, reason required for cancel/refund, statusHistory + audit + notification + email) |
| `lowStock.ts` | `/low-stock` | `lowStock.ts` (80) | Staff: GET `/` (status filter, populated product), PATCH `/:id/resolve` (+ `stock_update` audit) |
| `auditLog.ts` | `/audit-logs` | `auditLog.ts` (56) | GET `/` super_admin only: filters actor/actionType/target/date-range, paginated |
| `recommendation.ts` | `/product-recommendations` | `recommendation.ts` (42) | GET `/` public: reads cache by seed productId; fallback chain isMostSelling → isTrending → newest |
| `productEvents.ts` | `/product-events` | inline in route (44) | POST `/batch` public: ≤50 events, validates ObjectId + eventType, bulk insert. No `authenticate` on route → `req.user` is always undefined, so **client view events are never user-attributed** (purchase events get userId from the webhook instead) |
| `user.ts` | `/users` | `user.ts` (363) | super_admin only: GET list (regex search name/email, sensitive fields stripped), GET one, POST create (Zod), PUT update (Zod allowlist; role/isActive excluded — must use dedicated endpoints), PATCH `/:id/role`, PATCH `/:id/status` (both audited, self-change blocked), DELETE (hard delete, audited). **Uses raw `res.status()` instead of the AppError pipeline; 500 handlers return the raw error object** |
| `analytics.ts` | `/analytics` | `analytics.ts` (164) | super_admin only: GET revenue (delivered orders, daily/weekly buckets), top-skus, order-volume, customer-growth — all Mongo aggregation pipelines, 7–365-day windows |
| `notification.ts` | `/notifications` | `notification.ts` (38) | Authenticated: GET own (≤50 + unread count), PATCH read-all |

### server/src/services & utils & validators

| File | Responsibility |
|---|---|
| `services/mailer.ts` | Nodemailer transport (Gmail app-password or generic SMTP), lazy-built; console stub without credentials. Sends: verification code, order confirmation, order status change (+reason), low-stock alert to all active inventory managers |
| `services/scheduler.ts` | node-cron daily 02:00: (A) co-occurrence recommendation engine — purchase events grouped per user, pair weights with recency decay `1/(daysSince+1)`, top-10 per product upserted into cache; (B) trending/most-selling updater — 7-day order-quantity top-8 → `isMostSelling`, 7-day view-count top-8 → `isTrending` (reset-then-set) |
| `utils/errors.ts` | `AppError(code, message, statusCode, details)` + `createError` helper |
| `utils/tokens.ts` | JWT access token 15 min; opaque refresh token `crypto.randomBytes(40)`; SHA-256 `hashString`. **Hardcoded fallback secret** `'fallback_access_secret_key_987654'` when `JWT_ACCESS_SECRET` unset |
| `utils/escapeRegex.ts` | Escapes regex metacharacters for safe `$regex` search (used by order/user/review search) |
| `validators/auth.ts` | Zod: Register (password ≥8 + uppercase + digit), Login, ForgotPassword, ResetPassword (validator exists; endpoint does not) |
| `validators/user.ts` | Zod: CreateUser, UpdateUser (explicit allowlist — passwordHash/refreshTokenHash unreachable; role/isActive excluded by design), UpdateUserRole, UpdateUserStatus |

## client/

| File | Responsibility |
|---|---|
| `package.json` | React 19, React Router 7, Axios, lucide-react icons, @stripe/react-stripe-js + stripe-js; dev: Vite 8, TypeScript ~6.0, Tailwind 3.4, ESLint 10 |
| `vite.config.ts` | Default Vite + React plugin only (no proxy — API URL from `VITE_API_URL`) |
| `tailwind.config.js` | Full design-token system: brand orange `#EA580C` palette, semantic colors, typography scale (display→caption), plus late-added `*-bg` tint tokens (comment documents they were originally missing so tinted backgrounds rendered transparent) |
| `index.html`, `postcss.config.js`, `tsconfig*.json`, `eslint.config.js` | Standard Vite/TS/ESLint scaffolding |
| `a.json` | **Stray committed API response dump** (analytics JSON) — no functional role [GIT HYGIENE] |
| `public/favicon.svg`, `icons.svg` | Static assets |

### client/src — core

| File | Responsibility |
|---|---|
| `main.tsx` | Root render: `AuthProvider → ShopProvider → ToastProvider → App` under StrictMode |
| `App.tsx` (276) | All routing: `ProtectedRoute` (auth + role guard with `?redirect=` preservation), `StaffGate` (staff bounced off storefront to `/admin/dashboard`), per-path admin routes wrapped in `AdminContentRoute`, keyed page-transition wrapper, catch-all → `/`. `/admin/profile` renders a **title-only stub** [PARTIAL]. No `/reset-password` route (forgot-password link targets it) [KNOWN ISSUE] |
| `services/api.ts` (92) | Axios instance `withCredentials`; **in-memory access token**; request interceptor attaches Bearer; **single-flight `refreshPromise`**; response interceptor: on 401 (excluding auth endpoints, `_retry` guard) awaits shared refresh then retries; refresh failure → redirect to `/login?redirect=…` |
| `context/AuthContext.tsx` (205) | Session state; mount-time **silent refresh** gated by localStorage `opticart_has_session` hint; `sessionEpochRef` staleness guard (a slow failing refresh can't wipe a newer login); login/register→verify-email code flow/resend/Google/logout/forgotPassword |
| `context/ShopContext.tsx` (136) | Shared cart badge count + wishlist id set; guest vs authenticated branching (localStorage vs server); duplicate-aware `addItemToCart`/`addItemToWishlist` |
| `context/ToastContext.tsx` (50) | Toast queue (success/error/warning/info) |
| `utils/guestCart.ts` | localStorage guest cart (`guest_cart`): full product snapshots, duplicate → 'exists', stock-capped |
| `utils/guestMerge.ts` | After any sign-in: POST `/cart/merge` + `/wishlist/merge`, then clears local copies |
| `utils/apiError.ts` | Extracts human-readable message from AppError payload / axios / generic errors |

### client/src/components

| File | Responsibility |
|---|---|
| `layout/StorefrontLayout.tsx` (606) | Announcement bar, sticky header, debounced (300 ms) live search suggestions with match highlighting, notification bell, user menu, cart/wishlist badges, **mega-menu** (hover-collapse fixed via 180 ms close timer + `pt-3/-mt-3` hit-area bridge — documented in code comments; **but** menu data is hardcoded, subcategory clicks pass display names not slugs → empty product list, featured items navigate to fake ids `/products/1`), mobile drawer (**uses raw `<a href="/category/…">` → full page reload into a route that doesn't exist** [KNOWN ISSUE]), footer |
| `layout/AdminLayout.tsx` (267) | Collapsible role-filtered sidebar (Users/AuditLogs/Analytics = super_admin only), mobile drawer, top bar with profile menu + logout |
| `ui/*` (17 files) | Design-system components: Button, Input, Card, Badge, Modal, Toast, Skeleton, DataTable (303 — sortable/paginated table), ColumnChart (SVG chart for analytics), ProductCard (178 — price/rating/wishlist/cart actions), NotificationBell (130 — poll + unread badge + mark-all-read), SearchBox, Breadcrumb, EmptyState, GoogleSignInButton (GSI script wrapper) |

### client/src/pages — storefront

| File | Responsibility |
|---|---|
| `Home.tsx` (362) | Hero, category tiles (`/categories`), top-rated + newest products (`inStock=1`), recommendation strip (`/product-recommendations` fallback feed) |
| `ProductList.tsx` (402) | URL-param-driven catalog: category (real API slugs), price min/max (sanitized ≥0), min rating, sort, text search, 12/page pagination, mobile filter drawer, duplicate-aware cart/wishlist toasts |
| `ProductDetail.tsx` (633) | Product by slug, variant selector, gallery, paginated reviews + verified-review submission, recommendations, **batched view events** (buffer → POST `/product-events/batch`) |
| `Cart.tsx` (462) | Auth + guest carts; quantity edit, remove, price-change/stock warnings from server revalidation, coupon apply (preview via `/coupons/apply`) |
| `Checkout.tsx` (557) | Address selection/creation (saved to profile), `/orders/checkout-session`; **real Stripe PaymentElement** when key present, **MockPaymentForm** otherwise (client itself POSTs the fake webhook), then polls `/orders/status/:pi` |
| `CheckoutRedirect.tsx` (80) | Return-URL handler for redirect-based Stripe methods; polls order status |
| `OrderConfirmation.tsx` (185) | Post-payment summary of the created order |
| `AccountDashboard.tsx` (568) | Tabs: own orders (`?scope=mine`), profile name edit, address book CRUD (via PATCH `/auth/profile`), wishlist management |
| `OrderDetail.tsx` (444) | Timeline from statusHistory, items, totals, order feedback form, per-item review submission |
| `Wishlist.tsx` (251) | Auth wishlist (server) + guest wishlist (localStorage; exports helpers imported by ShopContext/guestMerge) |
| `Login.tsx` (170) / `Register.tsx` (313) / `ForgotPassword.tsx` (103) | Login (+ Google button + guest-merge on success + role-based redirect); Register with verification-code step; ForgotPassword posts email (server logs a reset link that leads nowhere — see [KNOWN ISSUE]) |

### client/src/pages — admin

| File | Responsibility |
|---|---|
| `admin/AdminPanel.tsx` (11) | Thin wrapper: current pathname → AdminLayout `activePath` |
| `admin/Dashboard.tsx` (214) | **Wired** KPI tiles (total orders, pending, active low-stock, products, active coupons — from 5 real endpoints) + recent-orders table. Active-alert/coupon counts only consider first 100 fetched docs |
| `admin/Products.tsx` (683) | Catalog table with search/pagination; create/edit modal builds multipart FormData (JSON variants + images + per-variant `imageSlot` photos); delete with active-order guard errors surfaced |
| `admin/Orders.tsx` (393) | Fulfillment queue: status filter, orderNumber search, status-advance modal with required reason for cancel/refund |
| `admin/Coupons.tsx` (391) | Coupon list + create modal + activate/deactivate toggle |
| `admin/LowStock.tsx` (177) | Alert list (status filter) + resolve action |
| `admin/Reviews.tsx` (178) | Moderation list with text search + soft-remove |
| `admin/users.tsx` (422) | super_admin user management: search, create/edit (Zod-validated server-side), role change, activate/deactivate, hard delete. **Lowercase filename inconsistent with sibling pages** |
| `admin/AuditLogs.tsx` (225) | Read-only audit trail (last 100), before/after delta rendering |
| `admin/Analytics.tsx` (249) | 4 aggregate endpoints → KPI cards + ColumnChart series; window selector |
| `Inventory/Categories.tsx` (351) | Category tree CRUD — **lives outside `pages/admin/`** despite being an admin page [STRUCTURE INCONSISTENCY] |
