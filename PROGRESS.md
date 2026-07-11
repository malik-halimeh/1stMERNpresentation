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

## Phase 3 — 3-STEP mandate (self-contained HTML, shared template, current code = ground truth)
- [x] **STEP 1 REFRESH (gate)** — `00_ANALYSIS/analysis_refresh.html` built (35.6 KB, 7 TOC): "How verified", 21-row Changelog vs previous analysis, corrected 26-feature inventory (all COMPLETE), corrected flow descriptions, updated audit scores (mean 7.25→7.8), "Still open" warn box. **This file beats the older 00_ANALYSIS docs on conflict; code beats both.**
- [x] **Jira CSV now PROVIDED** — `OptiCart_Jira_Import_v2.csv` added to project root (untracked) 2026-07-11. Corrects the old "[NOT FOUND]" claim: 11 epics / 40 sub-tasks / owners malik+mahmod+haya / 311 story pts. Its STATUS column is a MID-SPRINT SNAPSHOT (Stories 6–11 = In Progress/To Do) — current code has delivered ALL of them. Refresh row 21 + new #sprint section document this; planning_phase.html's "reconstructed sprints" is now superseded by the refresh.
- [x] STEP 2 — shared template `presentation/assets/template.html` (DESIGN SYSTEM, scroll-spy, print)
- [x] STEP 3A — `project_master_guide.html` (33.3 KB, 22 TOC: what/layout/lifecycle/auth/data/9 feature workflows/errors/frontend/prod-readiness/strengths-weaknesses)
- [x] STEP 3B — `manuals/{malik,haya,mahmod}_manual.html` — each exactly 7 sections (scope · concepts · end-to-end trace · 26 Q&A · 10 curveballs · new-concept-learned · still-challenging); 36 .qa blocks each
- [x] STEP 3C — `diagrams/` 8 .mmd sources (architecture, request_lifecycle, auth_flow, product_create_flow, checkout_flow, database_erd, rbac, folder_structure) + `diagrams.html` gallery (8 hand-authored offline inline SVGs, each with its .mmd in a collapsible)
- [x] STEP 3D — `questions/question_bank.html` (44.3 KB, **124 .qa**, 7 sections presenter-tagged; §7 = 17 "we actually hit this" war stories incl. webhook/JWT-hoist/low-stock-index/oversell/refund/stranded-login/mega-menu/coupon-bypass)
- [x] STEP 3E — `audit/audit.html` (20.3 KB, 4 sections: 15 Strengths · 8 warn-boxed Weaknesses · 11 Improvements · 6 warn-boxed Code Smells; mean 7.8/10)
- [x] Structural verification PASS on all 8: zero placeholders, balanced details/table/svg, template chrome present, 124≥120 .qa, each manual 7 sections
- Build with: `node <scratch>/html2/build2.mjs` (skips missing bodies; mkdirs subdirs). Bodies live in `<scratch>/html2/bodies/`; shared template `presentation/assets/template.html`.

## Phase 4 — Presentation kit (2026-07-11) — COMPLETE. Output under `presentation/presentation/`
- Instructor-mandated structure honored: intro/idea → planning (requirements, design, ERD, architecture, sprint, pre-dev) → per-member live demo (Haya FE / Malik BE / Mahmod DB) → learned concepts → still-challenging → evaluation-criteria mapping → Future (Smart Energy Advisor + Lebanon argument) → Q&A.
- Shared shell `scratchpad/html2/slides_template.html` + `build_slides.mjs`; bodies in `scratchpad/html2/slidebodies/`. Rebuild: `node build_slides.mjs`.
- [x] `presentation_script.html` (61.7 KB) — 22 slide cards; each has SAY/DO/TRANSITION, loud NEXT-SLIDE banner (22 banners), EXPECTED QUESTIONS (.qa collapsed), IF INTERRUPTED (.warn). Timing toggles CORE(13 cards,~14m)/STANDARD(20,~21m)/EXTENDED(22,~23m) via inline JS; run-of-show table + variant totals. Slide numbers 1–22 are the canonical numbering reused everywhere.
- [x] `live_demo_script.html` (30 KB) — pre-demo checklist, env+accounts, 27 click-by-click steps (Part A Haya 1–8 / Part B Malik 9–18 / Part C Mahmod 19–27), screenshots table (A1–C26), global fallback plan. Every path is a refresh-verified COMPLETE feature — no step routes through anything unfinished.
- [x] `presenter_notes.html` (28 KB) — one print-clean section per person (page-break between), each: slides, demo steps, learned+challenging, top-10 Qs.
- [x] `rehearsal.html` (24 KB) — 3-pass rehearsal plan, pacing warnings (overrun-prone slides), equipment checklist, deep-dive→backup-slide map (B2–B19), day-of run sheet.
- [x] `build_pptx.py` (regenerable) → `OptiCart_Main.pptx` (22 slides, STANDARD, mirrors script numbering) + `OptiCart_Backup.pptx` (20 deep-dive slides B1–B20). Design mirrors HTML kit (dark slate/orange/teal/violet, presenter-colored accent bands). Key diagrams = NATIVE shapes (architecture bands, ERD hubs, auth sequence, middleware chain, checkout) → fully offline, no SVG→PNG dependency. python-pptx 1.0.2.
- [x] Programmatic inspector in build_pptx.py (overflow heuristic + empty-title check): **0 issues** on both decks after fixes (dynamic title sizing for long titles, taller subtitle boxes, shortened one auth label; inspector now skips decorative/empty shapes).
- [x] Structural verify of 4 HTML: 0 placeholders, balanced details/table tags, template chrome present, 22 cards = 22 banners, tag split 13 core/7 std/2 ext.
- Ground truth: eval criteria (12) from evaluation_mapping.html; demo storyline from its single-narrative ordering; Smart Energy Advisor + Lebanon TCO argument from future_feature.html; sprint board from the real `OptiCart_Jira_Import_v2.csv`. Credentials: customer/manager/admin @opticart.dev; coupons SAVE10, FLAT50.

### Phase 3 — COMPLETE (2026-07-11). Deliverable tree under `presentation/`:
- `00_ANALYSIS/analysis_refresh.html` (gate) · `project_master_guide.html`
- `manuals/{malik,haya,mahmod}_manual.html`
- `diagrams/*.mmd` (8) + `diagrams/diagrams.html`
- `questions/question_bank.html` · `audit/audit.html`
- `assets/template.html` (shared design-system template)

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
