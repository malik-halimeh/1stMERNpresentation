# OptiCart — Technology Decisions

> For each technology: why it fits *this* codebase (with evidence), the main alternatives, the tradeoff, and a one-sentence answer to "why not X instead?".
> Versions from `client/package.json` and `server/package.json`.

---

## Frontend

### React 19
- **Why:** component model fits a catalog UI built from repeated cards/tables (`client/src/components/ui/` — 17 reusable components); Context API covers the app's modest shared state; the team's program is React-centric.
- **Alternatives:** Vue, Angular, Svelte.
- **Tradeoff:** more decisions left to the team (routing, state) vs Angular's batteries-included; larger runtime than Svelte.
- **If asked "why not Vue/Angular?":** "React has the largest ecosystem and hiring pool, and its one-way data flow maps cleanly onto our catalog→card→action component tree — Angular's full framework would be overhead for a storefront this size."

### Vite 8
- **Why:** instant dev server + HMR for a 40+-component app; `npm run build` = `tsc -b && vite build` gives type-checking plus optimized bundles (`client/package.json:8`).
- **Alternatives:** Create React App (deprecated), Next.js, Webpack.
- **Tradeoff:** no SSR/SEO out of the box — product pages are client-rendered even though the Product model carries SEO `meta` fields (`models/Product.ts:21-27`), which only pay off with SSR.
- **Why not Next.js?:** "We ship a separate Express API with its own auth/cron/webhook concerns, so Next's server layer would duplicate our backend; Vite gives us the fast SPA toolchain without merging the two."

### TypeScript (client ~6.0, server ^5.4)
- **Why:** shared shape discipline across the stack — e.g. the `IUser` role union appears identically in `middleware/auth.ts:9-13` and `AuthContext.tsx:8`; Mongoose generics (`Schema<IProduct>`) catch schema/interface drift at compile time.
- **Alternatives:** plain JavaScript, JSDoc types.
- **Tradeoff:** build step + learning curve; some `as any` escape hatches remain (`server.ts:33`, `routes/product.ts:39`).
- **Why not plain JS?:** "With 13 collections and 60+ endpoints, the compiler is the only thing that tells us a renamed field broke five files — before the demo does."

### Tailwind CSS 3.4
- **Why:** a real token system is defined in `tailwind.config.js` (brand palette, semantic colors, full type scale), so utilities compose a consistent design without a CSS-file-per-component; purge keeps the bundle small.
- **Alternatives:** CSS Modules, styled-components, MUI/Chakra.
- **Tradeoff:** long class strings in JSX; discipline needed (the config itself documents a bug where undefined `*-bg` tokens silently rendered transparent — `tailwind.config.js:29-34`).
- **Why not a component library like MUI?:** "We wanted the OptiCart brand identity, not Material's — Tailwind tokens gave us a custom design system at utility-class cost."

### React Router 7 (declarative `<Routes>`)
- **Why:** SPA navigation with route guards as plain components — `ProtectedRoute` and `StaffGate` (`App.tsx:44-129`) express auth/role rules in ~40 lines.
- **Alternatives:** TanStack Router, file-based routing (Next), hash routing.
- **Tradeoff:** requires host rewrite-to-index config in production; raw `<a>` tags bypass it — which is exactly the mobile-drawer regression (`StorefrontLayout.tsx:529`).
- **Why not TanStack Router?:** "React Router is the course-standard, and our guard logic is simple enough that its component model is the clearest expression of it."

### Context API (no Redux)
- **Why:** exactly three shared concerns exist — session (`AuthContext`), cart-badge/wishlist ids (`ShopContext`), toasts (`ToastContext`); everything else is page-local fetch state.
- **Alternatives:** Redux Toolkit, Zustand, TanStack Query.
- **Tradeoff:** no request caching/deduplication — pages refetch on mount; a context value change re-renders all consumers.
- **Why not Redux?:** "Redux earns its boilerplate when many slices of state interact; we have three independent contexts, so Redux would be ceremony without benefit."

### Axios (+ interceptors)
- **Why:** the whole token strategy lives in two interceptors — Bearer attachment and the single-flight 401→refresh→retry (`services/api.ts:23-103`); `withCredentials` handles the refresh cookie.
- **Alternatives:** native `fetch`, ky.
- **Tradeoff:** extra dependency vs fetch.
- **Why not fetch?:** "Fetch has no interceptors — we'd hand-roll the refresh-retry logic around every call; with Axios it's written once and every request inherits it."

---

## Backend

### Express 4
- **Why:** middleware chain mirrors the security model 1:1 — helmet → CORS → parsers → rate limit → routers → error handler (`server.ts:20-45`); per-route composition (`authenticate, authorize, multer, controller` — `routes/product.ts:35-41`) keeps policies visible at the route definition.
- **Alternatives:** Fastify, NestJS, Koa.
- **Tradeoff:** no built-in structure/DI (we impose our own routes/controllers/models layering); slower than Fastify in raw benchmarks.
- **Why not NestJS?:** "Nest's decorators and DI shine on large teams with many modules; our 15 routers with explicit middleware chains are easier to audit for a security-graded project."

### Mongoose 8 + MongoDB
- **Why:** the domain is document-shaped — variants embedded in products, snapshot items embedded in orders, statusHistory as an array (`models/Order.ts`); schema-level integrity where it matters: unique compound indexes (one review per user/product — `Review.ts:81`), append-only audit hooks (`AuditLog.ts:78-94`), TTL on events (`ProductEvent.ts:44`), text index for search (`Product.ts:110`).
- **Alternatives:** PostgreSQL + Prisma/TypeORM, raw MongoDB driver.
- **Tradeoff:** no DB-enforced foreign keys — referential rules live in controllers (e.g. product delete blocked while in active orders, `controllers/product.ts:430-442`); multi-document transactions need a replica set (the code carries a standalone fallback, `controllers/review.ts:153-175`).
- **Why not PostgreSQL?:** "Our hot documents (product with variants, order with snapshot items) are read whole in one query; in SQL each would be 3–4 joins, and we'd lose nothing we actually use since our money math is integer cents, not SQL aggregates."

### JWT access token + rotating opaque refresh token
- **Why:** short-lived (15 min) stateless access tokens keep every API hop cheap; the refresh token is *stateful by design* (SHA-256 hash in the user doc) so sessions are revocable and **reuse is detectable** — rotation with a 30-s multi-tab grace window and compromise-triggered global revocation (`controllers/auth.ts:309-391`).
- **Alternatives:** server sessions (express-session + store), long-lived JWTs, OAuth-only.
- **Tradeoff:** the most complex code in the app (single-flight client logic exists solely to avoid tripping our own reuse detection — `api.ts:34-38`); access tokens can't be revoked mid-lifetime (worst case 15 min).
- **Why not plain sessions?:** "Sessions put a DB read on every request and tie us to sticky state; our hybrid keeps requests stateless while the rotating refresh hash gives us the revocation and theft-detection that pure JWTs lack."

### bcryptjs (cost 12)
- **Why:** adaptive, salted hashing (`controllers/auth.ts:79-80`); pure-JS package avoids native build issues on Windows dev machines (the team's environment).
- **Alternatives:** native `bcrypt`, argon2, scrypt.
- **Tradeoff:** ~30% slower than native bcrypt; argon2 is the modern OWASP first pick.
- **Why not argon2?:** "Argon2 is the stronger KDF on paper, but bcrypt at cost 12 is still OWASP-acceptable and bcryptjs installs everywhere with zero native toolchain — a real concern for a three-person student team on mixed machines."

### Zod
- **Why:** declarative request validation with field-level error details fed straight into the AppError envelope (`controllers/auth.ts:66-74`); the update-user validator doubles as a **security allowlist** — passwordHash/refreshTokenHash are unreachable, role/isActive excluded so they must go through audited endpoints (`validators/user.ts:34-52`).
- **Alternatives:** Joi, express-validator, class-validator.
- **Tradeoff:** only auth and user inputs are Zod-validated; product/coupon/cart controllers validate by hand — inconsistent depth.
- **Why not Joi?:** "Zod infers the TypeScript type from the schema, so the validator and the type can never drift — Joi needs both maintained separately."

### Multer 2 (memory storage) + Cloudinary 2
- **Why:** buffers stream straight to Cloudinary (`upload_stream`, `config/cloudinary.ts:38-53`) — no temp files on disk, nothing to clean up; 5 MB and field-count caps at the router (`routes/product.ts:16-27`); CDN delivery + stored `publicId` for future deletion.
- **Alternatives:** local disk + static serving, S3 presigned uploads.
- **Tradeoff:** vendor dependency; images transit our server (vs presigned direct upload); memory storage means a burst of parallel 5 MB uploads lives in RAM.
- **Why not store images locally?:** "Local files die with the dyno and don't CDN; Cloudinary gives storage, transformation and CDN in one free-tier service, and mock mode keeps dev offline-friendly."

### Stripe 15 (PaymentIntents + webhook)
- **Why:** PCI burden stays with Stripe — the card form is Stripe's `PaymentElement`, our server only ever sees a PaymentIntent id; the webhook is the single source of payment truth driving stock/coupon/cart side effects (`controllers/order.ts:180-286`); a mock mode makes the full flow demoable with no keys.
- **Alternatives:** PayPal, Checkout-hosted page, cash-on-delivery only.
- **Tradeoff:** webhook correctness is on us — and our raw-body handling defect means signature verification currently can't pass (SECURITY_REVIEW §W1).
- **Why not PayPal?:** "Stripe's PaymentIntent + webhook model matches our two-phase design (capture funds, staff confirms fulfilment) and its test tooling is the best in class for a demo."

### node-cron 4
- **Why:** one in-process daily job (02:00) recomputes recommendations and trending flags (`services/scheduler.ts:181-190`) — the design rule "never compute recommendations at request time" (`routes/index.ts:53`) needs a scheduler, not a queue.
- **Alternatives:** BullMQ + Redis, OS cron hitting an endpoint, serverless scheduled functions.
- **Tradeoff:** runs inside the web process — multiple instances would double-run it, and a crash at 02:00 skips a day; no retry/backoff.
- **Why not BullMQ?:** "A Redis-backed queue is the right answer at scale, but for one idempotent nightly aggregation an in-process cron is zero extra infrastructure."

### Helmet 7 & CORS
- **Why:** one-line secure headers baseline (`server.ts:20`); CORS locked to a single origin from `CLIENT_URL` with `credentials: true` for the refresh cookie, trailing slash defensively stripped because browsers match `Access-Control-Allow-Origin` exactly (`server.ts:21-28` — the comment documents a real bug class).
- **Why not hand-rolled headers?:** "Helmet encodes years of header best practice we'd otherwise have to track release by release."

### express-rate-limit 8
- **Why:** three scoped limiters (`middleware/rateLimiter.ts`): auth 10 failed/15 min with `skipSuccessfulRequests` (account switching never burns budget), coupon-apply 20/15 min keyed by **userId** (`keyGenerator`, `:34`), plus a global limiter. Deliberate placement: `/refresh` and `/logout` are exempt because interceptors fire them automatically (`routes/auth.ts:19-23`).
- **Tradeoff:** in-memory store — resets on restart, not shared across instances; the global limiter's `max: 10000` contradicts its "100 per 15 minutes" comment (`rateLimiter.ts:46-49`).
- **Why not a WAF/gateway limit?:** "App-level limiting lets us key by userId and skip successful logins — semantics a generic gateway can't express."

### npm workspaces monorepo
- **Why:** one repo, two packages (`package.json:5-8`), root scripts (`dev-client`, `dev-server`, `build-all`, `lint-all`) and one shared Prettier config — atomic commits across client+server when an API shape changes.
- **Alternatives:** two repos, Turborepo/Nx, pnpm workspaces.
- **Tradeoff:** no task graph/caching (fine at this size); accidental cross-imports are possible (none found).
- **Why not separate repos?:** "Every feature here touches both sides — one PR that changes the endpoint and the page that calls it beats two coordinated PRs every time."

### nodemailer 9
- **Why:** SMTP-agnostic (Gmail app-password or any host) with a console stub fallback (`services/mailer.ts:14-58`) so email flows are demonstrable without credentials.
- **Why not SendGrid/Resend SDK?:** "Nodemailer keeps us provider-neutral — swapping providers is an env-var change, not a code change."

### Morgan
- **Why:** dev request logging (`server.ts:32`).
- **Tradeoff:** `dev` format always on — production would want structured logs (see PROJECT_AUDIT).
