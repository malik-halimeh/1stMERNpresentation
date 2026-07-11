# OptiCart — Flagship Future Feature: Smart Energy Advisor

> Store energy-consumption specs per appliance, show customers the **estimated yearly running cost under Lebanese electricity conditions** (EDL tariff + private generator subscription), and let them filter/sort by **total cost of ownership (TCO)** instead of sticker price.

---

## 1. Why this feature (justification)

**(a) Appliances are the product domain — energy is the #1 hidden purchase factor.**
OptiCart sells refrigerators, ovens, washers, microwaves (seed catalog: `server/seed.ts` — OptiCool refrigerators, OptiChef ovens/cooktops; categories "Major/Small Appliances"). For this category, the purchase price is only the down payment: a refrigerator runs 24/7 for 10+ years. No field in the current model captures that (`models/Product.ts` has price, variants, SEO meta — zero energy data), so today two fridges at $899 look identical even if one costs double to run.

**(b) Uniquely valuable in Lebanon.**
Lebanese households pay two electricity bills: the EDL grid tariff and a private **generator (moteur) subscription**, and generator power is dramatically more expensive per kWh than grid power. For an energy-hungry appliance, cumulative generator-era running costs can rival or exceed the appliance's sticker price within a couple of years — which makes "cost to run" a *decisive* local purchase factor that no regional competitor surfaces. The calculator makes this concrete per product: `yearlyCost = kWhPerYear × (gridShare × edlTariff + generatorShare × generatorTariff)`, with the grid/generator split user-adjustable (hours of state power vary by region). *(Presentation note: quote current EDL and generator per-kWh rates from a dated source at delivery time — tariffs change; hardcode them as admin-configurable constants, not literals.)*

**(c) Technically cheap — verified against the actual code.**
The claim "extends the existing Product schema and the existing filtering pipeline" holds, with one honest precision:
- **Schema:** `ProductSchema` already demonstrates the extension pattern with optional embedded subdocuments — `meta: MetaSchema` (`models/Product.ts:65-71,99`). `meta` itself is SEO-focused (title/og tags), so the right move is a **sibling** optional subdoc, not overloading meta:
  ```ts
  // models/Product.ts — addition
  export interface IEnergySpec {
    kWhPerYear?: number;        // standardized yearly consumption
    energyClass?: string;       // 'A+++'…'D' label for the badge
    standbyWatts?: number;      // optional, for always-on devices
  }
  energySpec: { type: EnergySpecSchema, required: false }
  ```
  Optional field ⇒ zero migration: existing documents simply lack it, exactly like products without `brand` today. If consumption differs per variant (capacity variants already exist — `IVariant.capacity`, `models/Product.ts:12`), an optional `kWhPerYearDelta` on `VariantSchema` mirrors the existing `priceDeltaCents` pattern.
- **Filtering/sorting:** `getProducts` builds a filter object and a `sortOption` from query params (`controllers/product.ts:48-112`). Additions are one filter branch (`maxYearlyCost` → precomputed `energySpec.estYearlyCostCents: {$lte: …}`) and one sort branch (`sort === 'tco_asc'` → sort by `basePriceCents + N×estYearlyCostCents`). To keep it index-friendly (matching the existing `(categoryId, basePriceCents)` compound-index strategy, `Product.ts:111`), precompute `estYearlyCostCents` on save (like the slug pre-validate hook, `Product.ts:132-137`) or in the existing nightly cron (`services/scheduler.ts`) when tariffs change, then index it — no per-request `$expr` math.
- **Admin input:** the product form already builds multipart FormData with structured JSON fields (`pages/admin/Products.tsx:269-277`); energy inputs are three more controlled fields in that form.
- **UI:** one badge + one calculator component on `ProductCard.tsx` / `ProductDetail.tsx` ("≈ $X/year to run · $Y over 5 years"), one sort option in the existing dropdown (`ProductList.tsx:336-345`), one filter input in the existing sidebar (`ProductList.tsx:192-297`).

**(d) Defensible differentiator + native upsell path.**
No local appliance retailer ranks by cost-of-ownership. And the upsell mechanism already exists: the recommendation system (`services/scheduler.ts` engine + `controllers/recommendation.ts` fallback chain) can be extended with an "efficient alternative" rule — same category, similar price band, lower `estYearlyCostCents` — reusing the `productRecommendations` cache pattern verbatim. "This fridge costs $120/yr to run — this one $55/yr" is the highest-margin sentence a salesperson can say in Lebanon.

## 2. Concrete implementation path (4 steps, ~small-PR sized each)

| Step | Change | Files touched | Owner |
|---|---|---|---|
| 1 | `EnergySpecSchema` + optional `energySpec` on product (+ optional variant delta); pre-save hook computing `estYearlyCostCents` from admin-configurable tariff constants | `server/src/models/Product.ts` | Mahmod |
| 2 | Filter (`maxYearlyCost`) + sort (`tco_asc`) branches in `getProducts`; accept `energySpec` JSON in create/update (same parse pattern as `variants`) | `server/src/controllers/product.ts:48-112,206-414` | Malik |
| 3 | Energy fields in the admin product form | `client/src/pages/admin/Products.tsx` | Haya |
| 4 | Energy badge + yearly/5-year cost calculator (user-adjustable grid/generator hours), TCO sort option, cost filter | `client/src/components/ui/ProductCard.tsx`, `pages/ProductDetail.tsx`, `pages/ProductList.tsx` | Haya |
| (5, stretch) | "Energy-efficient alternative" recommendation rule | `server/src/services/scheduler.ts` | Malik |

## 3. Risks / honest caveats to state if asked

- **Data sourcing:** kWh/year must come from manufacturer spec sheets entered by the inventory manager — garbage in, garbage out; mitigate with the `energyClass` label as a low-precision fallback badge.
- **Tariff volatility:** Lebanese tariffs change; hence admin-configurable constants and a recomputed `estYearlyCostCents`, never hardcoded math in the UI.
- **Coverage:** the badge/sort only covers products with `energySpec` — the optional-field design means the catalog degrades gracefully rather than blocking on backfill.

## 4. One-sentence pitch

"OptiCart stops selling appliances by their price tag and starts selling them by what they actually cost a Lebanese household — a number no competitor shows, computed from fields we can add to our existing schema in an afternoon."
