# SeafoodVision — Sprint 1 marketplace stabilization report

Date: 2026-07-19
Branch: `feature/marketplace-cart-credits-dodo`

## Recovery state

At recovery, the branch was correct and the worktree contained 24 tracked file changes plus four untracked deliverable groups: the report, CommonJS Jest configuration, payment tests/service, and `20260718100000_marketplace_exact_once.sql`. No reset, restore, commit, or push was performed. The interrupted files were readable and syntactically complete.

The pre-recovery work already included service-role isolation, webhook verification/retry handling, server-side download authorization and quota reservation, Next/Supabase type compatibility, the first version of centralized commercial validation, reusable draft orders, webhook fulfillment, and the exact-once migration. Recovery completed and verified those changes instead of rebuilding them.

## P0 corrections

### Database exact-once

The single existing migration `20260718100000_marketplace_exact_once.sql` was completed; no competing migration or marketplace table was created. It is transactional, reconciles legacy duplicates before constraint creation, and is safe against a failed partial application because PostgreSQL rolls the transaction back.

Exact-once business keys:

- payment transaction: `(provider, environment, external_payment_id)` when the external id exists;
- credit purchase: one `credit_ledger` purchase per `order_id`;
- purchased license: the pre-existing `(user_id, asset_id, license_type_id, order_id)` constraint is retained;
- download entitlement: one row per `purchased_license_id`;
- subscription: `(environment, external_subscription_id)` when the external id exists;
- refund: one row per `external_refund_id`;
- refund item: one row per `(refund_id, order_item_id)` when an item is known;
- checkout draft: one active draft/pending order per `(user_id, environment, checkout_key)`.

Legacy reconciliation remaps foreign keys before deletion: licenses and refunds for duplicate transactions; entitlements, subscription events, and webhook references for duplicate subscriptions; download events for duplicate entitlements; refund items for duplicate refunds. Duplicate credit purchases are removed and affected wallet balances are recalculated. Credit insertion uses `apply_credit_purchase`, a service-role-only function with a per-user advisory transaction lock.

The migration was statically and contract-tested but was not applied to a remote database during this sprint. No service-role credentials were available for a protected read-only duplicate count, so the migration deliberately performs reconciliation at deployment time instead of assuming the current remote state.

### Draft orders and concurrency

`PaymentService` now owns draft idempotency. A compatible recent draft is refreshed and reused; a recent pending order is reused only when both a provider checkout id and stored checkout URL exist. Paid, cancelled, expired, refunded, stale, or incompatible orders are never reused. A unique-index race recovers the winning order, and a failed order-item insert removes only the new unusable draft.

The redundant route-level subscription lookup was removed so there is one canonical implementation.

### Centralized commercial rules

`CommercialValidationService` is reused by asset-license, subscription, and credit-pack checkout. It returns the normalized structure `valid`, `blockers`, `normalized_product`, `authoritative_price`, `currency`, `dodo_product_id`, and `fulfillment_metadata`.

It validates server-side:

- asset review/publication/commercial status, rights, restrictions, demo status, readiness and original-file storage;
- license activity, compatibility and exclusive-license availability;
- unit product activity, authoritative price/currency and license compatibility;
- credit pack activity, credits, authoritative price/currency;
- canonical plan code, separate billing cycle, monthly/annual authoritative price, active subscription state;
- environment-specific and cycle-specific Dodo mappings.

Frontend prices are ignored. The asset UI now uses existing database codes: `commercial` + `photo_hd`, and `extended` + `photo_ultrahd`.

### Fulfillment and refunds

A successful payment creates or reuses exactly one transaction, license, entitlement, credit movement, or subscription as appropriate. Unique-conflict recovery handles concurrent webhook processing; a failed intermediate step remains retryable and cannot mark an order paid prematurely.

Refund webhooks persist the existing `refunds` and `refund_items` tables. Full refunds allocate item amounts when possible and revoke licenses/entitlements. Partial refunds preserve access and create a specific item record only when the payload identifies it; missing information is not invented. Refund replay is keyed by the external refund id. Payment lookup is scoped to Dodo and the configured environment.

## Checkout completion

- Monthly and annual subscriptions keep `plan_code` separate from `billing_cycle`.
- Pricing sends authenticated users to checkout resume and preserves the selected cycle through authentication.
- A missing annual mapping fails closed with the explicit server blocker `Dodo annual mapping is missing for this plan`.
- The four existing credit packs (`credits_100`, `credits_250`, `credits_500`, `credits_1000`) now have purchase actions on Pricing.
- Credit checkout preserves intent through sign-in, has a loading lock against double clicks, and displays missing-mapping/provider errors.
- Credit webhook fulfillment uses the atomic exact-once database function.
- No cart was created.

## Lint and build configuration

- `next lint` was replaced with ESLint 9 direct execution through `eslint.config.mjs`.
- `ignoreBuildErrors` remains disabled.
- `ignoreDuringBuilds` was removed.
- Legacy style/content debt remains visible as warnings rather than triggering a broad unrelated rewrite.
- `npm run typecheck` was added and disables incremental cache writing for deterministic validation.
- Jest uses the existing CommonJS configuration without adding dependencies.

## Tests

Four suites and 124 tests pass. Marketplace additions cover commercial asset blockers, webhook replay statuses, normalized plan codes, server prices, currencies, monthly/annual subscriptions, absent Dodo mappings, active-subscription blocking, all four credit packs, inactive products, non-commercial assets, draft/pending reuse rules, excluded paid/cancelled/expired/refunded orders, incompatible items, and schema/source contracts for transactions, credits, licenses, entitlements, subscriptions, refunds, checkout concurrency, replay recovery and atomic credits.

No live Dodo request was made.

## Final validation

| Command | Result |
|---|---|
| `npm run typecheck` | PASS — 0 errors |
| `npm run lint` | PASS — 0 errors, 219 documented legacy warnings |
| `npm test -- --runInBand` | PASS — 4 suites, 124/124 tests |
| `npm run build` | PASS — compiled in 86 s, 154/154 pages generated |
| `git diff --check` | PASS |

The production build used temporary `DIST_DIR=.next-sprint1`. Its artifact and build-generated Next config references were removed afterward.

## Remaining operational prerequisites

No code-level P0 identified in this sprint remains open. Before enabling test purchases, an administrator must:

1. apply and verify the exact-once migration on the intended Supabase environment;
2. review the migration's legacy reconciliation counts in a backup/test environment;
3. configure test Dodo Product IDs for Explorer, Professional and Business annual cycles;
4. configure test Dodo Product IDs for `credits_100`, `credits_250`, `credits_500`, and `credits_1000`;
5. configure test Dodo Product IDs for commercial unit products, including `photo_hd` and `photo_ultrahd`;
6. execute a signed test webhook, replay it, and verify one transaction plus the expected single fulfillment record.

Existing monthly test mappings remain untouched. Missing mappings fail closed. No environment file or secret was changed, no Sprint 2/cart work was started, and no commit or push was created.
