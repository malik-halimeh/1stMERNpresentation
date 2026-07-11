# OptiCart — Planning-Phase Reconstruction

> Purpose: the planning-phase material the instructor requires, reconstructed from verifiable artifacts.
> **Honesty note on sources:** the requested `OptiCart_Jira_Import*.csv` files are **[NOT FOUND]** — absent from the working tree and from the entire git history (verified with `git log --all --name-only --diff-filter=A -- '*Jira*' '*.csv'`, zero results). The sprint plan below is therefore **reconstructed from git history and the versioned design docs**, and is labeled as such — do not present it as an exported Jira board. Everything else derives from implemented code and the pre-development spec `OptiCart_Database_Structure_v4_full.md` (exists at git HEAD; references a "OptiCart_BRD_v1.0" that is not in the repo).

---

## 1. Functional Requirements (derived from implemented features)

**FR-1 Accounts & Access**
- FR-1.1 Register with email + password (≥8 chars, 1 uppercase, 1 digit — `validators/auth.ts:4-16`); account unusable until a 6-digit emailed code is confirmed (`controllers/auth.ts:104-125`).
- FR-1.2 Login/logout with persistent 7-day sessions surviving page reloads (refresh cookie + silent refresh).
- FR-1.3 Google sign-in with automatic account provisioning (`controllers/auth.ts:196-257`).
- FR-1.4 Profile: name + multi-address book with a single default (`controllers/auth.ts:488-551`).
- FR-1.5 Password recovery request (anti-enumeration). *(Completion of the reset itself is a known gap — FEATURE_INVENTORY §1.)*

**FR-2 Catalog**
- FR-2.1 Browse products with variant-level price/stock (embedded variants — `models/Product.ts:8-19`).
- FR-2.2 Filter by category (2-level tree incl. children), price range, minimum rating; 4 sort orders; text search; pagination (`controllers/product.ts:42-134`).
- FR-2.3 Product detail with gallery, per-variant photos, reviews, recommendations.
- FR-2.4 Sold-out products hidden from the storefront (`inStock=1` filter) but visible to staff.

**FR-3 Shopping**
- FR-3.1 Guest cart & wishlist in localStorage; merged into the account on sign-in with `max(quantity)` conflict resolution capped by stock (`controllers/cart.ts:266-337`).
- FR-3.2 Cart revalidated live: deleted products dropped, price-change and stock warnings surfaced (`controllers/cart.ts:24-74`).
- FR-3.3 Coupons: percentage/fixed, expiry, min-order, global + per-user limits (`controllers/coupon.ts:9-86`).

**FR-4 Checkout & Orders**
- FR-4.1 Stripe payment (PaymentIntent + webhook), with a keyless mock mode for demos.
- FR-4.2 Orders snapshot items (name/price/cost) at purchase time (`models/Order.ts:61-90`).
- FR-4.3 Two-phase fulfilment: payment captures funds; staff explicitly confirm; state machine `confirmed→processing→shipped→delivered`, any→`cancelled|refunded`, terminal lock, reason required for cancel/refund (`controllers/order.ts:458-583`).
- FR-4.4 Customers see their history and an order timeline; can leave one order-experience feedback after confirmation.

**FR-5 Reviews**
- FR-5.1 Verified purchase only (delivered order containing the product — `controllers/review.ts:104-116`); one review per user per product (unique index); 30-day edit window; staff soft-remove with audit.

**FR-6 Inventory Operations (staff)**
- FR-6.1 Product/category/coupon CRUD with guards (delete blocked in active orders / with children).
- FR-6.2 Low-stock alerts auto-raised at variant threshold (default 10), one active per variant, resolvable, emailed to all managers.
- FR-6.3 Fulfilment queue with status filter and order-number search.

**FR-7 Governance (super admin)**
- FR-7.1 User management: create/edit, role change, activate/deactivate, delete — self-change blocked, all audited.
- FR-7.2 Append-only audit trail with actor/type/target/date filtering.
- FR-7.3 Analytics: revenue (delivered), top SKUs, order volume, customer growth, 7–365-day windows.

**FR-8 Engagement**
- FR-8.1 In-app notifications on every order status change.
- FR-8.2 Transactional emails (verification, confirmation, status, low-stock).
- FR-8.3 Nightly-computed "customers also bought" recommendations + trending/most-selling flags.

## 2. Non-Functional Requirements (derived from code)

| NFR | Requirement | Implementation evidence |
|---|---|---|
| NFR-1 Security | Hashed credentials, revocable sessions, theft detection, RBAC, rate limiting, input validation | SECURITY_REVIEW §A |
| NFR-2 Integrity | Money as integer cents; order snapshots immutable; audit log append-only | `models/Order.ts`, `models/AuditLog.ts:78-94` |
| NFR-3 Performance | Read-path indexes (text, compound); recommendation work precomputed off-request; pagination ≤100 | `models/Product.ts:110-111`; `services/scheduler.ts` |
| NFR-4 Resilience | DB retry/reconnect with fail-fast exit; side effects (mail/audit/notify) never fail the request | `config/db.ts:37-52`; `controllers/order.ts:516-574` |
| NFR-5 Cost control | Free-tier aware: TTL-bounded event collection, client-side event batching, one cron job, mock modes for all paid services | `models/ProductEvent.ts:44`; v4 doc §3.10 "Mandatory scaling controls" |
| NFR-6 Usability | Responsive to mobile widths; skeleton loading; empty states; duplicate-aware actions | PROJECT_AUDIT §7 |

## 3. User Roles & Permissions Matrix (verified per route file)

| Capability | Guest | Customer | Inventory Manager | Super Admin | Route evidence |
|---|:-:|:-:|:-:|:-:|---|
| Browse/search catalog, categories, reviews, recommendations | ✔ | ✔ | ✔* | ✔* | `routes/product.ts:30-32`, `category.ts:8`, `review.ts:14`, `recommendation.ts:7` |
| Local (guest) cart & wishlist | ✔ | — | — | — | `utils/guestCart.ts`; `pages/Wishlist.tsx` |
| Server cart / wishlist / merge | ✖ | ✔ | ✔ | ✔ | `routes/cart.ts:9`, `wishlist.ts:9` |
| Apply coupon (preview) | ✖ | ✔ | ✔ | ✔ | `routes/coupon.ts:9-15` |
| Checkout, own orders, order feedback | ✖ | ✔ | ✔ | ✔ | `routes/order.ts:22-28` |
| Own notifications | ✖ | ✔ | ✔ | ✔ | `routes/notification.ts:8-10` |
| Submit/edit own review (verified purchase) | ✖ | ✔ | ✔ | ✔ | `routes/review.ts:20-21` |
| Product / category CRUD | ✖ | ✖ | ✔ | ✔ | `routes/product.ts:35-50`, `category.ts:11-13` |
| Coupon CRUD | ✖ | ✖ | ✔ | ✔ | `routes/coupon.ts:18-21` |
| View all orders + advance status | ✖ | ✖ | ✔ | ✔ | `routes/order.ts:22,31` |
| Low-stock alerts view/resolve | ✖ | ✖ | ✔ | ✔ | `routes/lowStock.ts:10-11` |
| Review moderation (list + remove) | ✖ | ✖ | ✔ | ✔ | `routes/review.ts:17,24` |
| User management (CRUD/role/status) | ✖ | ✖ | ✖ | ✔ | `routes/user.ts:16` |
| Audit logs (read-only) | ✖ | ✖ | ✖ | ✔ | `routes/auditLog.ts:8` |
| Analytics | ✖ | ✖ | ✖ | ✔ | `routes/analytics.ts:13` |

\* Staff can browse APIs, but the UI bounces them to `/admin/dashboard` from any storefront route (`App.tsx:115-129` StaffGate) — a deliberate product decision recorded in commit `b9d48b3`.

## 4. Data Model (13 collections as implemented)

ERD narrative (relationships verified against `server/src/models/`):

- **users** 1—N **orders**, 1—1 **carts**, 1—1 **wishlists**, 1—N **reviews**, 1—N **auditLogs** (actor), 1—N **notifications**, 0..N **productEvents** (nullable user).
- **categories** self-reference via `parentId` (2 levels); 1—N **products**.
- **products** embed `variants[]` and `images[]`; 1—N **reviews**, 1—N **lowStockAlerts**, 1—N **productEvents**, 1—1 **productRecommendations**; referenced live by cart items, referenced **as snapshots** by order items.
- **orders** embed snapshot `items[]` + `statusHistory[]` (+optional `refund`, `feedback` subdocs); value-reference **coupons** by code string (human-readable audit trail, not FK).
- **reviews** carry `orderId` as the verified-purchase proof.
- **auditLogs** polymorphic target via `targetEntityType` + `targetEntityId`.

Index inventory (all schema-declared):

| Collection | Indexes |
|---|---|
| users | `email` unique |
| categories | `slug` unique |
| products | `slug` unique; `categoryId`; text(`name`,`searchKeywords`); compound `(categoryId, basePriceCents)` |
| carts / wishlists | `userId` unique |
| orders | `orderNumber` unique; `userId`; `status`; compound `(status, createdAt)` |
| coupons | `code` unique |
| reviews | `productId`; **unique `(userId, productId)`** |
| lowStockAlerts | `productId`; **unique `(productId, variantSku, status)`** *(known defect — see FEATURE_INVENTORY §13)* |
| auditLogs | `timestamp` *(doc promises actorId/actionType/target too — not implemented)* |
| notifications | `userId`; compound `(userId, createdAt desc)` |
| productEvents | compound `(userId, eventType, timestamp)`; **TTL `timestamp` 180 d** |
| productRecommendations | `productId` unique |

Design-doc lineage: v1 spec (11 collections) → v4 (12; adds `productRecommendations`, `costPriceCents`/`unitCostCents`, `statusHistory.updatedBy`; removes a delivery-agent role concept as out-of-BRD-scope — stated in the v4 header) → implementation adds a 13th (`notifications`) plus email-verification and refresh-grace fields on `users`.

## 5. Sprint Plan — **[RECONSTRUCTED — Jira CSVs NOT FOUND]**

Reconstructed from commit sequence/content (`git log --all`) and doc versioning; boundaries are inferred, not exported:

| Phase | Scope (evidence) | Team focus |
|---|---|---|
| **Sprint 0 — Planning & foundation** | BRD v1.0 (referenced by the DB docs), DB spec iterations v1→v4, repo bootstrap + hygiene cycles (`47d1f44`, `b1d01b3`, `03f0a6d`, gitignore/`.env` fixes `ba03320`, `21cb44d`) | Mahmod: data model · Malik: scaffolding · Haya: design tokens |
| **Sprint 1 — Auth core** | Full auth system: register/login/refresh rotation/logout (`ab31544 "feat: implement full authentication system…"`) | Malik backend · Haya auth pages |
| **Sprint 2 — Commerce core** | Catalog, cart, wishlist, checkout, orders, admin inventory (`1e25f09 "feat: implement full-stack e-commerce functionality…"`) | All three, feature-split per FEATURE_INVENTORY presenter column |
| **Sprint 3 — Hardening & operations** | Rate-limiter fix (`c5bf67b`), search/pagination/audit-text fixes (`116d117`), sensitive-file cleanup (`64c6488`) | Malik/Mahmod |
| **Sprint 4 — UX & fulfilment polish (branch `test`, unmerged)** | StaffGate, guest cart + merge, pending-until-confirmed orders, notification system, per-variant images, coupon modal, dashboard tile fixes (`b9d48b3`); pricing/stock fixes (`533e49f`, `fd612b8`) | All three |

**Presentation guidance:** state plainly that the Jira export was not preserved in the repo and this table is a git-derived reconstruction — that honesty aligns with the documentation theme of the talk.

## 6. Key Pre-Development Technical Decisions

Made before/at project start (evidenced by the earliest artifacts):

1. **MERN + TypeScript monorepo** — npm workspaces from the initial scaffold (`package.json`).
2. **Document model with explicit embed-vs-reference rules** — the v4 doc's decision rule ("embed when bounded, read-with-parent, not independently queried; reference otherwise") predates the code and the code follows it.
3. **Integer cents for all money** — `basePriceCents`, `priceDeltaCents`, `unitCostCents` from the first schema version.
4. **Order-item snapshotting** — called "the single most important modeling decision" in the v4 doc §3.6; implemented verbatim.
5. **Hybrid auth: short-lived JWT + rotating hashed refresh token** — present since Sprint 1 (`ab31544`).
6. **3-role flat RBAC** — v4 doc explicitly rejects a permissions collection ("add only if per-admin custom scopes become a requirement") and rejects/reverts a 4th delivery-agent role.
7. **Recommendations precomputed on a schedule, never at request time** — v4 doc §3.10-3.11 defines the productEvents→cache pipeline, TTL, and client-side view batching; all three appear in code (`scheduler.ts`, `ProductEvent.ts:44`, `ProductDetail.tsx:26`).
8. **Mock-mode-first integrations** — Stripe/Cloudinary/mail all designed to run keyless for development and grading demos.
