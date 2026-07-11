# OptiCart Presentation — PROGRESS

> Resume protocol: read this file first. Continue from the first unchecked item.
> Rules: read-only repo access, no git writes, all output under `presentation/`.
> Team: Haya = Frontend (React/Vite/TS), Mahmod = Database (MongoDB/Mongoose), Malik = Backend (Express/TS) + architecture.

## Phase 0 — Repository survey — COMPLETE (2026-07-10)
- [x] Read root/client/server package.json, tsconfigs, configs
- [x] Read server: server.ts, config/, middleware/, all models, all routes, all controllers, services/, utils/, validators/, seed.ts (skim)
- [x] Read client: main.tsx, App.tsx, context/, services/api.ts, layouts, ui components (via map), all pages (key pages fully, rest via endpoint grep)
- [x] Read README.md; OptiCart_Database_Structure*.md read via `git show HEAD:` (deleted in working tree — recoverable)
- [x] OptiCart_Jira_Import*.csv — **[NOT FOUND]** in working tree or anywhere in git history; sprint plan reconstructed from git log instead (labeled as reconstruction in PLANNING_PHASE.md)

## Phase 1 — 00_ANALYSIS deliverables — COMPLETE (2026-07-10)
- [x] 1. REPO_MAP.md
- [x] 2. FEATURE_INVENTORY.md — verified: mega-menu hover-collapse FIXED in code (180 ms debounce + hit-area bridge, StorefrontLayout.tsx:90-109,390-392); SPA regression CONFIRMED (mobile drawer raw `<a href>` :529 + mega-menu passes names not slugs :434 + fake featured ids :457); admin Dashboard IS wired — the stub is /admin/profile (App.tsx:275-283)
- [x] 3. ARCHITECTURE_REPORT.md
- [x] 4. TECH_DECISIONS.md
- [x] 5. SECURITY_REVIEW.md
- [x] 6. PROJECT_AUDIT.md (git inspected read-only: 19 commits, branches main + origin/test [4 ahead, unmerged], authors Mahmoud Sidawi 12 / malik-halimeh 8, none from Haya's account)
- [x] 7. EVALUATION_MAPPING.md
- [x] 8. PLANNING_PHASE.md (requirements, roles matrix, 13-collection data model + index list, reconstructed sprints, pre-dev decisions)
- [x] 9. FUTURE_FEATURE.md (Smart Energy Advisor — schema claim verified against models/Product.ts: `meta` is SEO-only, so a sibling `energySpec` subdoc is recommended; filter hook verified against controllers/product.ts:48-112)

## Readable report
- [x] `presentation/OptiCart_Analysis.html` — single-file styled viewer of all 10 docs (sidebar nav, badges, dark/light, print). Rebuild after editing any .md: `node presentation/_build/build.mjs` (the .md files remain the source of truth).

## Fix pass — COMPLETE (2026-07-11)
- [x] Re-verified every finding against the moved HEAD (`c7f10b8`) — team had already fixed: W3, W5, W10, mega-menu/drawer wiring, dashboard tiles
- [x] Fixed this session: W1 (webhook raw body + fail-closed), W2 (lazy JWT secret + prod fail-fast — also fixed a latent bug where the fallback secret was ALWAYS used due to ESM import hoisting), W4 (limiter 1000/15min), W6 (user.ts AppError pipeline), W9 (atomic stock $inc), W11 (review images dropped), W13 (Stripe/mock refund + refund_decision audit), AuditLog indexes, /admin/profile real page, README + server/.env.example (+ .gitignore negation)
- [x] Verified: server tsc clean · client build clean · `server/src/test_fixes.ts` 20/20 · HTTP smoke vs real server (health/products/categories/webhook-raw-mount/404+401 envelopes)
- [x] FIXES_APPLIED.md written; banners added to SECURITY_REVIEW.md + FEATURE_INVENTORY.md; HTML report rebuilt with the new doc

## Phase 2 — HTML deliverables (2026-07-11, per new GLOBAL RULES: self-contained dark-theme HTML, design system, current code = ground truth)
- [x] Delta re-survey vs new HEAD `175e68e`: NEW Purchases feature verified (models/Purchase.ts = 14th collection; controllers/purchase.ts atomic weighted-avg-cost pipeline + compensation + guarded revert; routes /api/purchases staff-only; admin/Purchases.tsx + nav + dashboard month-spend tile + analytics purchase-spend chart); StorefrontLayout reworked again (header search back as submit-to-/products form, two-row header, footer contact/social); seed.ts now uses real Unsplash photos; update_product_images.ts one-off live-DB image script; server/dist committed again [GIT HYGIENE]; DB structure MDs now DELETED at HEAD; audit action types = 9 (stock_purchase added); analytics endpoints = 5 (purchase-spend added)
- [x] Shared HTML template built (scratchpad/html2/template.html) — reused for every file
- [x] 1. repo_map.html (32.6 KB, 10 TOC entries)
- [x] 2. feature_inventory.html (34.6 KB, 23 sections — all statuses re-verified vs current code; 22 features COMPLETE, limitations stated inline)
- [x] 3. architecture_report.html (27.2 KB — layered-architecture inline SVG, full lifecycle, auth flow incl. rotation code block, purchases pipeline section)
- [x] 4. tech_decisions.html (24.6 KB — 18 technologies, .qa "why not X?" one-liners)
- [x] 5. security_review.html (23.2 KB — S1–S20 strengths, B found→fixed→proven table, O1–O9 genuinely open items re-verified)
- [x] 6. project_audit.html (24.0 KB — 12 criteria, mean 7.8 ▲ from 7.25; git re-inspected: 26 commits, dist re-tracked = 47 files [top cleanup item])
- [x] 7. evaluation_mapping.html (17.5 KB — criterion table + 10-step demo narrative + credentials)
- [x] 8. planning_phase.html (27.1 KB — FR/NFR, roles matrix, 14-collection ERD SVG + full index inventory, RECONSTRUCTED sprint plan [Jira CSVs still NOT FOUND], pre-dev decisions)
- [x] 9. future_feature.html (19.4 KB — Smart Energy Advisor; schema/pipeline claims re-verified; precompute precedent now includes Purchase.totalCostCents)
- [x] diagrams/architecture.mmd, erd.mmd, auth_flow.mmd (plain-text sources; SVG renderings embedded inline in architecture_report + planning_phase)
- [x] Structural verification: all 9 files pass (no placeholders, balanced details/table/svg tags, template chrome present); shared template = scratchpad/html2/template.html reused for every file

## Status corrections vs the old MD analysis (statuses that MUST NOT be carried forward)
- Webhook (old W1) → FIXED: express.raw mount server.ts + fail-closed constructEvent (order.ts stripeWebhook)
- Refunds (old W13) → COMPLETE: stripe.refunds.create / mock id, order.refund populated, refund_decision audit written (order.ts updateOrderStatus)
- Reset password (old W5) → COMPLETE: 6-digit code flow (auth.ts resetPassword + ForgotPassword.tsx)
- Coupon checkout bypass (old W3) → FIXED (order.ts createCheckoutSession re-validates all limits)
- LowStock index (old W10) → FIXED: partial unique {productId,variantSku} status:'active' + syncIndexes at boot
- JWT fallback secret (old W2) → FIXED: lazy getAccessSecret, prod fail-fast (utils/tokens.ts)
- Rate limiter mismatch (old W4) → FIXED: 1000/15min, comment accurate
- user.ts raw errors (old W6) → FIXED: AppError pipeline throughout
- Review images (old W11) → FIXED: body images ignored
- Stock race (old W9) → FIXED: atomic conditional $inc + oversell clamp
- AuditLog indexes → ADDED (actorId, actionType, targetEntityId)
- /admin/profile stub → REAL PAGE (pages/admin/Profile.tsx)
- Mega-menu/drawer → FIXED (API categories, slugs, SPA nav) — header search RESTORED in 175e68e as submit form (no live-suggestion dropdown anymore)
- README drift → FIXED; server/.env.example exists
- STILL OPEN (re-verified): register email enumeration (auth.ts:101 409 AUTH_EMAIL_IN_USE); view-event spoofing bounded not prevented (routes/productEvents.ts public); JWT role staleness ≤15min (inherent); hard-delete users (user.ts deleteUser); in-process cron + in-memory rate-limit store (scaling); morgan dev logging; no CI/Docker; 546kB client bundle; server/dist tracked in git; DB spec docs deleted from repo

## Next phases (not yet requested in detail — awaiting instructions)
- [ ] Manuals (per-presenter speaker material) — build FROM 00_ANALYSIS only
- [ ] Question bank — build FROM 00_ANALYSIS only
- [ ] PowerPoint / deck — build FROM 00_ANALYSIS only

## Key findings log (source of truth summaries)
- **[KNOWN ISSUE]** Stripe webhook signature verification structurally broken: `express.json()` (server.ts:29) consumes raw body → `constructEvent` always throws → falls back to trusting unverified body (order.ts:192-201). SECURITY_REVIEW W1.
- **[KNOWN ISSUE]** Coupon usage/per-user limits not re-checked in `createCheckoutSession` (order.ts:110-121) — bypass by sending couponCode straight to checkout. W3.
- **[KNOWN ISSUE]** LowStockAlert unique index `(productId, variantSku, status)` blocks a second *resolved* doc per variant → repeat resolve throws E11000 (model comment believes otherwise). W10.
- **[PARTIAL]** Password reset dead-ends: console-logged link → `/reset-password` has no client route and no server endpoint; `ResetPasswordValidator` is dead code. W5.
- **[PARTIAL]** Refunds: status-only; `IRefund` subdoc never populated, no Stripe refund call, `refund_decision` audit action never written (grep-verified). W13.
- **[MISMATCH]** Global rate limiter comment says 100/15min, code `max: 10000` (rateLimiter.ts:46-49). W4.
- **[MISMATCH]** Hardcoded fallback JWT secret in tokens.ts:4 + auth.ts:462. W2.
- **[DOC DRIFT]** README: "CartContext" (real: ShopContext), "React Router v6" (installed v7), references missing `server/.env.example`, lists JWT_SECRET/JWT_REFRESH_SECRET that code never reads. DB spec files deleted from working tree (exist at HEAD). Notifications collection (13th) absent from v4 doc. AuditLog doc promises 4 indexes, code has only timestamp.
- Collections: **13** (mission said 12) — User, Product, Category, Cart, Wishlist, Order, Coupon, Review, LowStockAlert, AuditLog, Notification, ProductEvent, ProductRecommendation.
- productEvents batch route has no authenticate → client view events always `userId: null`; only webhook purchase events carry userId (that's what the recommendation engine consumes).
- Git hygiene material: `.env` leak+cleanup cycle (ba03320→64c6488), `hi` commits vs exemplary `b9d48b3`, stray `client/a.json` (committed API dump), unmerged `test` branch with substantial polish work.
- Seed credentials for demos: customer@opticart.dev / Customer123!, manager@opticart.dev / Manager123!, admin@opticart.dev / Admin123! (README + seed.ts).
