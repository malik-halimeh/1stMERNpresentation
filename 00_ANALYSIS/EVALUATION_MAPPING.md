# OptiCart — Evaluation Mapping

> Criterion → concrete evidence (file paths) → presenter → where it appears in the presentation.
> "Slide" numbers are placeholders (S-x) to be bound when the deck exists; "Demo" = live demo moment.

| Criterion | Concrete evidence in OptiCart | Presenter | Where it appears |
|---|---|---|---|
| **Code quality** | Uniform controller pattern + AppError envelope (`server/src/middleware/error.ts`, any controller); intent comments at hard spots (`controllers/auth.ts:306-309`, `client/src/services/api.ts:34-38`); shared utils (`utils/escapeRegex.ts`) | Malik | S-Architecture; code walkthrough of one controller during backend demo |
| **Project structure** | Monorepo workspaces (`package.json:5-8`); backend layering `config/middleware/models/routes/controllers/services/utils/validators`; frontend `pages/components/context/services/utils` | Malik | S-Repo-Tour (annotated tree slide, from REPO_MAP.md) |
| **UI/UX quality** | Design tokens (`client/tailwind.config.js`); 17 ui components incl. `DataTable.tsx`, `Skeleton.tsx`, `Toast.tsx`; debounced live search w/ highlight (`components/layout/StorefrontLayout.tsx:127-176`); duplicate-aware cart toasts (`pages/ProductList.tsx:162-189`) | Haya | Demo: browse → search suggestions → add to cart → toast; S-DesignSystem |
| **Backend architecture** | Middleware chain (`server/src/server.ts:20-45`); request lifecycle; two-phase payment→staff-confirm design (`controllers/order.ts:211-214`); non-blocking side effects (`order.ts:516-574`) | Malik | S-RequestLifecycle diagram; Demo: order placed → stays pending → staff confirms |
| **Database design** | v4 spec (git HEAD `OptiCart_Database_Structure_v4_full.md`); order snapshots w/ `unitCostCents` (`models/Order.ts:61-90`); unique review index (`models/Review.ts:81`); TTL events (`models/ProductEvent.ts:44`); append-only audit hooks (`models/AuditLog.ts:78-94`) | Mahmod | S-ERD + S-EmbedVsReference; Demo: show an order document vs its mutated product |
| **Security practices** | Refresh rotation + reuse detection (`controllers/auth.ts:309-391`); in-memory access token (`services/api.ts:6-11`); RBAC (`middleware/auth.ts:41-53`); rate limiters (`middleware/rateLimiter.ts`); Zod allowlist (`validators/user.ts:34-60`) | Malik | S-AuthFlow animated diagram; Demo: token reuse → `AUTH_SESSION_COMPROMISED`; Q&A ammo from SECURITY_REVIEW §B |
| **Responsiveness** | Mobile drawers storefront + admin (`StorefrontLayout.tsx:480-597`, `AdminLayout.tsx:210-219`); breakpoint grids (`ProductList.tsx:368`, `admin/Dashboard.tsx:134`); mobile filter panel (`ProductList.tsx:408-425`) | Haya | Demo: devtools device toggle live resize during storefront tour |
| **Functionality completeness** | 20+ end-to-end features (FEATURE_INVENTORY.md §1–21): guest→auth merge, checkout w/ Stripe mock, fulfilment state machine, verified reviews, coupons, low-stock, analytics, notifications, recommendations | All three | The main demo storyline: guest browse → register+verify → buy → staff fulfil → review |
| **Documentation quality** | v4 DB spec depth; README (credentials, seed, Stripe modes); inline rationale comments — plus honestly-owned drift (CartContext/ShopContext, RR v6/v7, missing `.env.example`) | Mahmod | S-Docs; ties into the talk's documentation theme — show the drift on screen deliberately |
| **Git usage** | 19 commits / 2 branches / 2 authors (`git log --oneline --all`); exemplary long-form commit `b9d48b3` vs `hi` commits; `.env` leak-and-cleanup story (`ba03320`→`64c6488`) | Malik | S-GitStory (honest before/after slide); improvement plan stated proactively |
| **Clean & maintainable code** | Typed schemas + exported interfaces (every model); validators separated (`server/src/validators/`); reusable ui kit; named constants (`ROTATION_GRACE_MS`) | Haya (frontend) + Malik (backend) | Woven into both code walkthroughs |
| **Scalability & production readiness** | Pooling+retry (`config/db.ts`); pagination caps; TTL-bounded events; precomputed recommendation cache (`services/scheduler.ts`); stateless access tokens — with stated limits (in-process cron, in-memory rate store) | Malik | S-Scale ("what breaks at 10× and what we'd change") — sourced from PROJECT_AUDIT §12 |
| **Planning phase** (if graded) | Requirements/roles/ERD/sprints reconstruction (PLANNING_PHASE.md); BRD-referencing v4 spec as pre-dev artifact | Mahmod | S-Planning at the start of the deck |
| **Future work** (if graded) | Smart Energy Advisor (FUTURE_FEATURE.md) — schema fields verified against `models/Product.ts`, filter hook verified against `controllers/product.ts:42-134` | All (Haya UI, Mahmod schema, Malik pipeline) | Closing slides — S-Future |

## Suggested demo-moment ordering (single narrative)

1. **Guest** browses catalog, live search, adds to cart (Haya) — UI/UX + responsiveness.
2. **Register → email code → session** (Malik) — auth + security; show the rotation diagram while the code email "arrives".
3. **Checkout** with mock Stripe; order appears **pending** (Malik) — backend architecture.
4. **Staff confirms → ships → delivers** in admin queue; customer bell + email fire (Haya drives UI, Malik narrates state machine).
5. **Verified review** now unlockable on the delivered product (Mahmod: unique index + transaction story).
6. **Admin analytics + audit trail** (Mahmod: append-only proof — try to edit a log in the shell, watch it throw).
7. **Honesty segment:** known issues (mega-menu links, reset-password dead end, webhook raw-body) + improvement plan (Malik) — instructors reward this.
8. **Smart Energy Advisor** future feature (all).
