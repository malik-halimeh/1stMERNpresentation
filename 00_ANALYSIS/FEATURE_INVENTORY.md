# OptiCart — Feature Inventory (End-to-End)

> **UPDATE 2026-07-11:** the [PARTIAL]/[KNOWN ISSUE] items below are now resolved — password reset (§1), coupon limit bypass (§8), webhook verification (§9), refunds (§10), low-stock index (§13), mega-menu/drawer wiring (§22), admin profile stub (§21). See **FIXES_APPLIED.md** for details and test evidence. Kept as the pre-fix snapshot.

> Status legend: **[COMPLETE]** works end-to-end as implemented · **[PARTIAL]** implemented but with a real gap · **[KNOWN ISSUE]** verified defect.
> Presenters: **Haya** (Frontend), **Mahmod** (Database), **Malik** (Backend/Architecture).
> Every claim carries a file path. Verified against commit `1e25f09`.

---

## 1. Authentication & Session Management — [COMPLETE] (one sub-flow PARTIAL)

- **Frontend:** `client/src/pages/Login.tsx`, `Register.tsx`, `ForgotPassword.tsx`, `client/src/context/AuthContext.tsx`, `client/src/services/api.ts`, `client/src/components/ui/GoogleSignInButton.tsx`
- **API:** POST `/api/auth/register`, `/verify-email`, `/resend-verification`, `/google`, `/login`, `/refresh`, `/logout`, `/forgot-password`; GET/PATCH `/api/auth/profile` (`server/src/routes/auth.ts`)
- **Controllers:** `register, verifyEmail, resendVerification, googleAuth, login, refresh, logout, forgotPassword, getProfile, updateProfile` (`server/src/controllers/auth.ts`)
- **Models:** `User`
- **Presents:** Malik (flow + rotation), Haya (interceptors/silent refresh)

What actually works:
- Register creates an **unverified** account, emails (or console-logs) a 6-digit code (SHA-256-hashed, 15-min TTL, `auth.ts:28-34`); session opens only after `verify-email`. Unverified re-register refreshes the pending account (`auth.ts:87-100`).
- Login: bcrypt (cost 12) compare, deactivated-account check, unverified → fresh code + 403 (`auth.ts:260-304`).
- Access token = 15-min JWT held **in memory only** (`api.ts:6-11`); refresh token = opaque 40-byte random, SHA-256 hash in DB, `userId:token` in HTTP-only `SameSite=Strict` cookie, 7-day TTL (`auth.ts:18-23,46`).
- **Rotation + reuse detection:** atomic `findOneAndUpdate` keyed on the old hash so exactly one of N concurrent refreshes rotates (`auth.ts:337-345`); 30-s grace window via `prevRefreshTokenHash` for multi-tab races (`auth.ts:309,366-378`); reuse outside grace revokes everything → 403 `AUTH_SESSION_COMPROMISED` (`auth.ts:380-391`).
- Client: single-flight refresh promise (`api.ts:38-66`), 401 retry interceptor (`api.ts:69-103`), mount-time silent refresh gated by a localStorage session hint, epoch guard so a slow failing refresh can't wipe a fresh login (`AuthContext.tsx:56-122`).
- Google sign-in: ID token validated against Google's tokeninfo endpoint, `aud` and `email_verified` checked, auto-provisioning with random unusable password (`auth.ts:196-257`).

**[PARTIAL] Password reset:** `forgot-password` generates a 15-min JWT reset link and **logs it to the console** (`auth.ts:459-474`) pointing at `{CLIENT_URL}/reset-password` — but there is **no `/reset-password` client route** (`client/src/App.tsx` — absent; catch-all at `App.tsx:286` redirects to home) and **no reset endpoint** in `server/src/routes/auth.ts`, even though `ResetPasswordValidator` exists (`server/src/validators/auth.ts:27-37`). The flow dead-ends by design gap, not by intent.

---

## 2. RBAC (3 roles) — [COMPLETE]

- **Frontend:** `ProtectedRoute` + `StaffGate` + role-filtered admin sidebar (`client/src/App.tsx:44-129`, `components/layout/AdminLayout.tsx:37-99`)
- **Backend:** `authenticate` + `authorize(...)` (`server/src/middleware/auth.ts`); every route file declares its roles explicitly
- **Presents:** Malik

Matrix highlights (verified per route file): storefront commerce (cart/wishlist/checkout/reviews) open to **all three roles**; product/category/coupon/order-status/low-stock/review-moderation = `inventory_manager` + `super_admin`; users/audit-logs/analytics = `super_admin` only. Staff hitting any storefront URL are bounced to `/admin/dashboard` (`App.tsx:115-129`).

---

## 3. Product Catalog & Search — [COMPLETE]

- **Frontend:** `ProductList.tsx`, `ProductDetail.tsx`, `Home.tsx`, `ui/ProductCard.tsx`, header live-search in `StorefrontLayout.tsx:127-176`
- **API:** GET `/api/products` (+filters), GET `/api/products/:slug`, GET `/api/products/by-ids`
- **Controller:** `getProducts, getProductBySlug, getProductsByIds` (`server/src/controllers/product.ts:42-181`)
- **Models:** `Product`, `Category`
- **Presents:** Haya (UI/filters), Mahmod (text index & compound indexes)

Filters: category by id **or slug including one level of children** (`product.ts:59-81`), price in dollars converted to cents, min rating, 4 sort modes, `inStock=1` storefront filter (`$elemMatch stock>0`), MongoDB **text index** search (name + searchKeywords) with textScore sort (`Product.ts:110`, `product.ts:99-104`), pagination capped at 100.

---

## 4. Product Management (Admin) — [COMPLETE]

- **Frontend:** `pages/admin/Products.tsx` (multipart FormData: JSON variants + gallery images + per-variant photos via `imageSlot`)
- **API:** POST/PATCH/DELETE `/api/products*` (manager+admin; Multer memory storage, 5 MB, images≤5 / variantImages≤20 — `routes/product.ts:16-27`)
- **Controller:** `createProduct, updateProduct, deleteProduct` (`product.ts:206-455`); Cloudinary streaming upload w/ mock mode (`config/cloudinary.ts`)
- **Models:** `Product`, `Category`, `AuditLog`, `LowStockAlert`, `Order`
- **Presents:** Haya (form/UX), Malik (upload pipeline)

Safeguards: categoryId validated + existence-checked; price must be a non-negative integer; deletion **blocked** while the product sits in an active order (`product.ts:430-442`); variant/stock updates write a `stock_update` audit entry with before/after variants (`product.ts:392-405`); every save re-checks low-stock thresholds.

---

## 5. Category Tree — [COMPLETE]

- **Frontend:** `pages/Inventory/Categories.tsx` (note: located outside `pages/admin/`)
- **API:** GET (public tree) / POST / PATCH / DELETE `/api/categories`
- **Controller:** `category.ts` — 2-level tree assembly (`category.ts:7-40`), self-parent guard (`:100-102`), delete blocked while children exist (`:139-146`)
- **Models:** `Category`
- **Presents:** Mahmod (self-referencing design), Haya (tree UI)

---

## 6. Cart (guest + authenticated) — [COMPLETE]

- **Frontend:** `pages/Cart.tsx`, `context/ShopContext.tsx`, `utils/guestCart.ts`, `utils/guestMerge.ts`
- **API:** GET `/api/cart`, POST `/items`, PATCH/DELETE `/items/:productId`, POST `/merge`
- **Controller:** `cart.ts`
- **Models:** `Cart`, `Product`
- **Presents:** Haya (guest/auth duality), Malik (merge semantics)

Notable: GET revalidates every line against live catalog — silently drops deleted products/variants and flags `priceChanged` / `insufficientStock` / `outOfStock` (`cart.ts:24-74`). Duplicate adds return `alreadyInCart` instead of incrementing (`cart.ts:140-153`). Merge-on-login resolves conflicts with `max(quantity)` capped at stock (`cart.ts:304-325`).

---

## 7. Wishlist (guest + authenticated) — [COMPLETE]

- **Frontend:** `pages/Wishlist.tsx` (also exports the guest-localStorage helpers), `ShopContext.tsx`
- **API:** GET `/api/wishlist`, POST `/:productId`, DELETE `/:productId`, POST `/merge`
- **Controller:** `wishlist.ts` (duplicate-aware add, validated merge)
- **Models:** `Wishlist`, `Product`
- **Presents:** Haya

---

## 8. Coupons — [COMPLETE] with one enforcement gap

- **Frontend:** apply box in `Cart.tsx:197,230`; management in `admin/Coupons.tsx`
- **API:** POST `/api/coupons/apply` (rate-limited 20/15 min per user); staff GET/POST/PATCH/DELETE
- **Controller:** `coupon.ts` — apply validates isActive, expiry, min-order, **global usage limit, per-user limit** (`coupon.ts:29-72`); all CUD audited (`coupon_cud`)
- **Models:** `Coupon`, `AuditLog`
- **Presents:** Malik

**[KNOWN ISSUE] Limit bypass at checkout:** `createCheckoutSession` re-validates only isActive/expiry/min-order (`order.ts:110-121`) — it does **not** check `usageLimit`/`perUserLimit`. A client that skips the `/coupons/apply` preview and sends `couponCode` straight to checkout gets the discount past its limits. Usage counting itself works (webhook increments `usedBy` — `order.ts:237-249`).

---

## 9. Checkout & Payments (Stripe) — [COMPLETE in mock mode; PARTIAL for production Stripe]

- **Frontend:** `pages/Checkout.tsx` (real `PaymentElement` or MockPaymentForm that itself POSTs the fake webhook — `Checkout.tsx:90-120`), `CheckoutRedirect.tsx`, `OrderConfirmation.tsx`
- **API:** POST `/api/orders/checkout-session`, POST `/api/orders/webhook` (public), GET `/api/orders/status/:paymentIntentId`
- **Controller:** `order.ts:53-311`
- **Models:** `Order`, `Cart`, `Product`, `Coupon`, `ProductEvent`, `User`
- **Presents:** Malik (flow), Mahmod (order snapshot design)

Flow: cart snapshot with live stock validation → coupon discount → Stripe PaymentIntent (or mock ids) → draft `pending` order → webhook `payment_intent.succeeded` → idempotent (paymentStatus guard) stock decrement, coupon usage, cart clear, purchase `ProductEvent`s, confirmation email. Order **stays `pending` until staff confirms** — deliberate two-step design (`order.ts:211-214`).

**[KNOWN ISSUE] Webhook signature verification cannot work in production:** `express.json()` is applied globally (`server.ts:29`) so `req.body` is already parsed when `stripe.webhooks.constructEvent(req.body, sig, secret)` runs (`order.ts:194`) — constructEvent requires the **raw** body, so verification always throws and the code **falls back to trusting the unverified parsed body** (`order.ts:195-201`). Works for the mock/demo; not production-safe. (Full analysis in SECURITY_REVIEW.)

Also noted: `orderNumber` = random 6-digit (`order.ts:150`) — unique index protects against silent collision but a collision throws instead of retrying; stock is validated at session creation and decremented only at webhook (no reservation window).

---

## 10. Order Lifecycle & Fulfillment — [COMPLETE]

- **Frontend:** `admin/Orders.tsx` (queue, filters, status modal with required reason), `pages/OrderDetail.tsx` (timeline), `AccountDashboard.tsx` (own orders via `?scope=mine`)
- **API:** GET `/api/orders`, GET `/:id`, PATCH `/:id/status` (staff)
- **Controller:** `getOrders` (staff-vs-customer scoping + regex order search — `order.ts:314-365`), `updateOrderStatus` (`order.ts:460-583`)
- **Models:** `Order`, `AuditLog`, `Notification`, `User`
- **Presents:** Malik (state machine), Haya (queue UI)

State machine: `confirmed→processing→shipped→delivered`, any→`cancelled`/`refunded`; terminal states locked (`order.ts:494-497`); cancel/refund require a customer-visible reason (`order.ts:479-486`); every transition appends `statusHistory` with `updatedBy`, writes an `order_status_change` audit entry, creates an in-app notification, and emails the customer.

**[PARTIAL] Refunds:** "refunded" is only a status transition. The `IRefund` subdocument (`models/Order.ts:19-25` — status/reason/approvedBy/stripeRefundId) is **never populated by any controller**, no Stripe refund API call exists anywhere, and the `refund_decision` audit action (`models/AuditLog.ts:6`) is never written (grep-verified). Money is never actually returned via Stripe.

---

## 11. Order Feedback — [COMPLETE]

- **Frontend:** feedback form in `OrderDetail.tsx:113`
- **API:** POST `/api/orders/:id/feedback`
- **Controller:** `submitOrderFeedback` (`order.ts:402-456`) — owner-only, opens after staff confirmation, rating 1–5 + text ≤2000
- **Models:** `Order.feedback`
- **Presents:** Haya

---

## 12. Reviews (verified purchase) — [COMPLETE]

- **Frontend:** `ProductDetail.tsx` (list + submit), `OrderDetail.tsx:139` (review from order), `admin/Reviews.tsx` (moderation)
- **API:** GET `/api/reviews/product/:productId` (public), GET `/api/reviews` (staff), POST, PATCH `/:id`, DELETE `/:id` (staff)
- **Controller:** `review.ts`
- **Models:** `Review`, `Order`, `Product`, `AuditLog`
- **Presents:** Mahmod (transactions + denormalization), Haya (UI)

Highlights: verified purchase = a **delivered** order containing the product (`review.ts:104-116`); one review per user per product enforced by **unique compound index** (`models/Review.ts:81`) plus app check; 30-day edit window (`review.ts:214-218`); moderation is a soft delete (`isRemoved`) + `review_removal` audit; denormalized `ratingAvg`/`reviewCount` recalculated inside a **Mongo transaction with an automatic sequential fallback for standalone servers** (`review.ts:129-175`).

---

## 13. Low-Stock Alerts — [COMPLETE] with an index defect

- **Frontend:** `admin/LowStock.tsx`
- **API:** GET `/api/low-stock`, PATCH `/:id/resolve` (staff)
- **Controller:** `lowStock.ts`; triggers in `product.ts:13-39` and `order.ts:18-49` (webhook stock decrement also emails all active inventory managers — `mailer.ts:92-111`)
- **Models:** `LowStockAlert`, `AuditLog`
- **Presents:** Mahmod

**[KNOWN ISSUE] Duplicate-resolved collision:** the unique index is `(productId, variantSku, status)` (`models/LowStockAlert.ts:59`). The comment claims it "allows multiple 'resolved' alerts", but a unique index permits only **one** document per key — so resolving a *second* alert for the same variant (after an earlier resolved one exists) throws `E11000` and the resolve fails with a 500. Works for first-time resolutions; breaks on the repeat cycle trigger→resolve→trigger→resolve.

---

## 14. Audit Logging — [COMPLETE]

- **Frontend:** `admin/AuditLogs.tsx` (before/after delta rendering as text)
- **API:** GET `/api/audit-logs` (super_admin; actor/type/target/date filters)
- **Controller:** `auditLog.ts`; writers spread across product/order/coupon/review/user/lowStock controllers
- **Models:** `AuditLog` — **append-only enforced by pre-hooks** that throw on update/delete (`models/AuditLog.ts:78-94`)
- **Presents:** Mahmod (append-only design), Malik (write sites)

7 of 8 declared action types are written; `refund_decision` never is (see §10).

---

## 15. Recommendations Engine — [COMPLETE]

- **Frontend:** strips in `Home.tsx:108` and `ProductDetail.tsx:167`
- **API:** GET `/api/product-recommendations` (public, cache-read only)
- **Controller:** `recommendation.ts` (cache → isMostSelling → isTrending → newest fallback chain)
- **Scheduler:** `services/scheduler.ts` — daily 02:00 cron: co-occurrence over purchase events with recency decay `1/(daysSince+1)`, top-10 per product upserted; plus 7-day trending/most-selling flag updater
- **Models:** `ProductEvent`, `ProductRecommendation`, `Product`, `Order`
- **Presents:** Malik (algorithm), Mahmod (TTL + cache design)

---

## 16. Product Event Tracking — [COMPLETE] with an attribution limitation

- **Frontend:** view-event buffer in `ProductDetail.tsx:26` (batched POST)
- **API:** POST `/api/product-events/batch` (public, ≤50/batch, validated)
- **Models:** `ProductEvent` (TTL 180 days)
- **Presents:** Mahmod

**Limitation (by construction):** the batch route has no `authenticate` middleware, so `req.user` is always undefined and client-sent view events are stored with `userId: null` (`routes/productEvents.ts:34`). Only webhook-written **purchase** events carry a userId — which is what the co-occurrence engine actually consumes, so recommendations still work; per-user view history does not exist.

---

## 17. Analytics Dashboard — [COMPLETE]

- **Frontend:** `admin/Analytics.tsx` (KPI cards + `ui/ColumnChart.tsx` SVG charts, 7–365-day window selector)
- **API:** GET `/api/analytics/revenue|top-skus|order-volume|customer-growth` (super_admin)
- **Controller:** `analytics.ts` — aggregation pipelines; revenue counted from **delivered** orders only; daily buckets, auto-weekly beyond 60 days
- **Models:** `Order`, `User`
- **Presents:** Malik

---

## 18. In-App Notifications — [COMPLETE]

- **Frontend:** `ui/NotificationBell.tsx` (unread badge, mark-all-read)
- **API:** GET `/api/notifications`, PATCH `/read-all`
- **Controller:** `notification.ts`; created on every staff status change (`order.ts:532-559`)
- **Models:** `Notification`
- **Presents:** Haya

---

## 19. Email Notifications — [COMPLETE as designed (SMTP optional)]

- **Service:** `services/mailer.ts` — Gmail app-password or generic SMTP when configured, console stub otherwise; verification codes, order confirmation, status changes (+reason), low-stock alerts to all active managers
- **Presents:** Malik

---

## 20. User Management (Super Admin) — [COMPLETE]

- **Frontend:** `admin/users.tsx`
- **API:** GET/POST/PUT/DELETE `/api/users*`, PATCH `/:id/role`, PATCH `/:id/status`
- **Controller:** `user.ts` — Zod-validated, sensitive fields stripped, self-role-change/self-deactivate/self-delete blocked, role & status changes + deletes audited. Style note: bypasses the AppError pipeline and its 500 responses include the raw error object (see SECURITY_REVIEW)
- **Models:** `User`, `AuditLog`
- **Presents:** Malik

---

## 21. Admin Dashboard — [COMPLETE] (contrary to the earlier issue report)

- **Frontend:** `admin/Dashboard.tsx` — verified wired to 5 live endpoints (orders total/pending, products total, low-stock actives, active coupons) + recent-orders table
- **Presents:** Haya

Residual gaps: (a) `/admin/profile` is a **title-only stub** — `AdminRoute` renders just a heading (`App.tsx:275-283`); (b) active-alert and active-coupon tiles count only the first 100 fetched documents (`Dashboard.tsx:87-98`).

---

## 22. Storefront Navigation / Mega-Menu — status of the three reported issues

Verified against `client/src/components/layout/StorefrontLayout.tsx`:

1. **Mega-menu hover-collapse — [FIXED].** 180 ms debounced close timer (`:90-109`) plus `pt-3/-mt-3` hit-area bridge (`:390-392`); both documented in code comments as the fix.
2. **SPA routing regression — [KNOWN ISSUE, confirmed].** The mobile drawer renders raw `<a href="/category/…">` anchors (`:529`) → full browser reload into a route that does not exist in `App.tsx` → catch-all bounces to home, losing SPA state.
3. **Mega-menu data wiring — [KNOWN ISSUE, confirmed].** `CATEGORIES` is a hardcoded constant (`:18-35`), not fetched from `/api/categories`. Subcategory clicks navigate with the display name (`category=Refrigerators`, `:434`) but the backend matches by **slug** (`controllers/product.ts:64` → `Category.findOne({slug})`) so the product list comes back empty; featured items navigate to fabricated ids (`/products/1`, `:457`) → PRODUCT_NOT_FOUND view. The sidebar filter in `ProductList.tsx:206-216` does it correctly (real API slugs) — the mega-menu was never rewired to match.

---

## Feature → Presenter summary

| Presenter | Features |
|---|---|
| **Haya** | Catalog UI & filters, Product admin forms, Cart/Wishlist guest duality, Order feedback, Notifications bell, Admin dashboard, Category UI, storefront layout/mega-menu story |
| **Mahmod** | Data model & indexes, Category tree, Reviews (transactions + denormalization), Low-stock alerts, Audit log append-only design, ProductEvents TTL + recommendation cache |
| **Malik** | Auth/refresh rotation, RBAC, Checkout/Stripe/webhook, Order state machine, Coupons, Analytics aggregations, Recommendation engine, User management, mailer/scheduler, overall architecture |
