# SeafoodVision — Sprint 1.5B final Dodo TEST mapping report

Date: 2026-07-19
Branch: `feature/marketplace-cart-credits-dodo`
Status: **16/16 TEST mappings prepared locally — not applied to Supabase**

## Sprint 1.5B diagnosis — published credit packs

The defect is **cause F: the Rocket deployment does not correspond to the current Git branch**.

- The published `/pricing` page was inspected read-only on 2026-07-19. It renders all four credit-pack cards, but its DOM contains no credit purchase button.
- The current branch renders an explicit native `button` for every entry in `CREDIT_PACKS`, calls `purchaseCreditPack(pack.id)`, posts only `{ packCode }` to `/api/payments/dodo/credit-checkout`, displays a loading state, and disables all pack buttons while checkout starts.
- That implementation is already present in commit `339d6e3` and therefore in the current branch head `6e87123`.
- The button is not conditional on a Dodo mapping or either Dodo feature flag. A missing TEST mapping would return a visible server error only after a click; it cannot remove the button.
- No runtime error was needed to explain the published state: the expected interactive elements are absent from the delivered DOM.

No Pricing implementation was changed because the requested direct-checkout behavior already exists. Rocket must resynchronize the branch at least through commit `339d6e3` (preferably current head `6e87123`) and redeploy. The exact commit currently deployed by Rocket is not exposed by the page metadata and could not be identified.

## Git recovery state

- Initial worktree: clean and synchronized with `origin/feature/marketplace-cart-credits-dodo`.
- Initial commit: `6e87123 chore: ignore Supabase CLI temporary files`.
- No reset, commit, push, live payment, or Dodo API call was performed.

## Existing mapping model

SeafoodVision reuses `unit_products.product_code`, `credit_packs.pack_code`, `pricing_plans.plan_code`, and `payment_product_mappings`. The mapping row stores `internal_product_type`, internal UUID, `dodo_product_id`, optional `dodo_price_id`, `environment`, `billing_cycle`, `currency`, and `is_active`.

There is no provider column because this existing table is Dodo-specific. The internal environment enum is `test | production`; the provider converts `production` to Dodo `live_mode`. No `test`/`production` fallback exists.

The Admin interface `/admin/commerce/mappings` lists mappings but currently directs administrators to Supabase Studio for writes.

## Mapping reconciliation

| Product | Actual internal code | Cycle | Internal price | Supplied Dodo price | Before | Planned after migration |
|---|---|---|---:|---:|---|---|
| Photo Web | `photo_web` | — | 5 EUR | 5 EUR | absent | active TEST mapping prepared |
| Photo HD | `photo_hd` | — | 20 EUR | 20 EUR | absent | active TEST mapping prepared |
| Photo Ultra HD | `photo_ultrahd` | — | 40 EUR | 40 EUR | absent | active TEST mapping prepared |
| Video | `video` | — | 75 EUR | 75 EUR | absent | active TEST mapping prepared |
| View 360 | `view_360` | — | 50 EUR | 50 EUR | absent | active TEST mapping prepared |
| Pack 10 Images | `pack_10` | — | 150 EUR | 150 EUR | absent | active TEST mapping prepared |
| Credit 100 | `credits_100` | — | 9 EUR | 9 EUR | absent | active TEST mapping prepared |
| Credit 250 | `credits_250` | — | 19 EUR | 19 EUR | absent | active TEST mapping prepared |
| Credit 500 | `credits_500` | — | 35 EUR | 35 EUR | absent | active TEST mapping prepared |
| Credit 1000 | `credits_1000` | — | 59 EUR | 59 EUR | absent | active TEST mapping prepared |
| Explorer | canonical `explorer`¹ | monthly | 29 EUR | 29 EUR | historical mapping differs | active TEST cycle normalized |
| Professional | canonical `professional`¹ | monthly | 79 EUR | 79 EUR | matching mapping exists | active TEST cycle normalized |
| Business | canonical `business`¹ | monthly | 199 EUR | 199 EUR | historical mapping ambiguous | active TEST cycle normalized |
| Explorer | canonical `explorer`¹ | annual | 290 EUR | 290 EUR | absent | active TEST mapping prepared |
| Professional | canonical `professional`¹ | annual | 790 EUR | 790 EUR | absent | active TEST mapping prepared |
| Business | canonical `business`¹ | annual | 1990 EUR | 1990 EUR | absent | active TEST mapping prepared |

¹ Current database rows may retain the compatible aliases `*_monthly`; checkout normalization uses canonical plan code plus a separate billing cycle.

## Complete Product IDs prepared

| Internal product | Cycle | Dodo TEST Product ID |
|---|---|---|
| `photo_web` | one-time | `pdt_0NjWshHafg7cviI5DWtIC` |
| `photo_hd` | one-time | `pdt_0NjWsoHpPgM1pbUVaHJfr` |
| `photo_ultrahd` | one-time | `pdt_0NjWsy1RvRix3wTCalm9m` |
| `video` | one-time | `pdt_0NjWt709qq5LizExnEFAJ` |
| `view_360` | one-time | `pdt_0NjWtHcROzLiZ4zZnNKbo` |
| `pack_10` | one-time | `pdt_0NjWtPcFWTkxVoTnssvcD` |
| `credits_100` | one-time | `pdt_0NjWs5ltiwaGybbv3lt7G` |
| `credits_250` | one-time | `pdt_0NjWsGANLBfyWsyQkFPXk` |
| `credits_500` | one-time | `pdt_0NjWsPF3TgzjkrKoTEb74` |
| `credits_1000` | one-time | `pdt_0NjWsWtbJw11tr0KvWEUh` |
| `explorer` | monthly | `pdt_0NjJwwWYNVeTj06MeYCGW` |
| `professional` | monthly | `pdt_0NjJxdsjq65AH2w2HuWDL` |
| `business` | monthly | `pdt_0NjJyA1OFHe9XEuAT6AIR` |
| `explorer` | annual | `pdt_0NjX0mLZim94JaL68vey` |
| `professional` | annual | `pdt_0NjX0x2DixcGgjMFi2Ml2` |
| `business` | annual | `pdt_0NjX1AAHCwtq0QNpDgY8r` |

The migration is `supabase/migrations/20260719120000_dodo_test_certain_mappings.sql`. It is transactional and SQL-idempotent. It uses partial unique-index inference matching the Sprint 1 exact-once indexes, preserves any existing `dodo_price_id`, and never mutates production mappings.

The migration has **not** been applied remotely. Therefore no Supabase data was modified in this worktree operation.

## Mapping completion

- All 16 Product IDs supplied for TEST are present exactly once as distinct business mappings.
- The six unit products use `one_time_asset_license`; `pack_10` remains the existing internal code and `image_pack_10` is absent.
- Explorer, Professional, and Business monthly/annual mappings use distinct Product IDs and a separate `billing_cycle`.
- No production mapping is read or mutated.

## Environment variables

The following names exist in `.env.local`; their values were not displayed or modified:

- `DODO_PAYMENTS_API_KEY`
- `DODO_PAYMENTS_WEBHOOK_SECRET`
- `DODO_PAYMENTS_ENVIRONMENT`
- `DODO_PAYMENTS_RETURN_URL`
- `DODO_PAYMENTS_CANCEL_URL`
- `DODO_PAYMENTS_WEBHOOK_URL`
- `NEXT_PUBLIC_DODO_PAYMENTS_ENABLED`
- `NEXT_PUBLIC_SITE_URL`

They are not loaded into the current PowerShell process. Next.js loads `.env.local` itself. The canonical project names above must be retained; no `DODO_API_KEY` or `DODO_ENVIRONMENT` alias should be introduced.

## Manual Dodo Dashboard checks

For every Product ID before operational testing:

- confirm Test Mode, exact copied ID, EUR currency, and expected amount;
- confirm unit products and credit packs are one-time payments;
- confirm monthly subscriptions recur monthly, not merely that “Monthly” appears in the name;
- confirm annual subscriptions recur annually;
- confirm products are active and checkout-enabled;
- confirm no Product ID is shared by two incompatible products or cycles;
- confirm webhook endpoint and signing secret are from Test Mode.

No API call was made to infer these properties.

## Operational test checklist — do not execute automatically

### A. Credit pack 100

- authenticate a test user;
- resolve `credits_100` to the TEST Product ID;
- create or reuse one compatible draft;
- complete a Dodo Test payment;
- receive a signed webhook;
- verify one payment transaction, paid order, and exactly 100 wallet credits;
- replay the webhook and verify no second credit movement.

### B. Photo HD

- select a truly commercial asset with accessible original and valid license;
- resolve `photo_hd`, confirm server price 20 EUR, and open Dodo Test checkout;
- after the signed webhook, verify one paid order, purchased license, and entitlement;
- verify signed download and replay without duplication.

### C. Explorer Monthly

- confirm actual monthly recurrence in Dodo;
- resolve canonical `explorer + monthly` without an annual fallback;
- verify unique external subscription and idempotent webhook replay.

### D. Explorer Annual

- confirm actual annual recurrence in Dodo;
- resolve canonical `explorer + annual` to `pdt_0NjX0mLZim94JaL68vey`;
- verify stored plan and annual cycle with no monthly confusion;
- replay the activation webhook and verify one subscription.

## Tests added

`dodoTestMappings.test.ts` verifies all sixteen TEST mappings, exact Product ID transcription, uniqueness, six unit-product server prices, four credit quantities, distinct monthly/annual IDs, cycle and environment filtering, missing-production refusal, currency refusal, idempotent SQL structure, absence of production mutations, and absence of Product IDs in frontend app/components. It also covers the four rendered credit packs, their native button, direct server route, code-only request body, loading/double-click protection, authentication redirect, intent resume, server authentication, and visible mapping errors.

Final local validation:

| Command | Result |
|---|---|
| `npm run typecheck` | PASS — 0 errors |
| `npm run lint` | PASS — 0 errors, 219 visible legacy warnings |
| `npm test -- --runInBand` | PASS — 5 suites, 162/162 tests |
| `npm run build` | PASS — compiled in 108 s, 154/154 pages generated |
| `git diff --check` | PASS |

The isolated build artifact was removed and Next-generated config references were restored. The migration remains unapplied pending explicit authorization and operational TEST verification.
