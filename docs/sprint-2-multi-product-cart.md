# Sprint 2 — Multi-product cart and unified Dodo checkout

## Architecture decision

The cart reuses `orders` (`status = draft`) and `order_items`. No `cart` or
`cart_items` table exists. `pending` is the checkout lock and `paid` means that
the signed payment webhook completed every supported line. A failed line leaves
the order pending so a webhook replay can resume exact-once fulfillment.

The navigation badge counts lines, not the sum of quantities.

## Compatibility matrix

| Line | One-time cart | Quantity | Fulfillment |
|---|---:|---:|---|
| Asset + format + license | Yes | Fixed at 1 | Purchased license + download entitlement per line |
| Credit pack | Yes | 1–10 | One atomic ledger movement containing the aggregate credits |
| Subscription | No | 1 | Existing direct subscription checkout |
| Pack 10 images | Not yet | — | Existing data does not define a safe allocation/entitlement model |
| Mixed currency/environment | No | — | Rejected server-side |

Identical credit pack lines merge by increasing quantity. Asset lines remain
distinct when their asset, format (unit product), or license differs. Repeated
clicks on the exact same asset line do not duplicate it.

## Security and validation

- Every route authenticates with Supabase and passes the authenticated user ID
  to a service-role operation scoped by `orders.user_id`.
- React sends references only. Prices, totals, Dodo IDs, product status,
  licenses, rights, original availability, currency, and environment are read
  and validated server-side.
- A maximum of 50 lines and quantity 10 per credit line is enforced.
- Checkout first revalidates every line, requires explicit reconfirmation after
  a price change, and atomically changes the order from `draft` to `pending`
  before the single provider request.
- Sprint 2 cart checkout refuses any environment other than Dodo TEST.

## Required migration

`20260720120000_multi_product_cart_line_fulfillment.sql` adds only
`purchased_licenses.order_item_id` and exact-once indexes. It is required to
deliver two formats of the same asset/license as distinct lines. The code keeps
a legacy fallback until the migration is applied, but multi-format fulfillment
must not be accepted in manual testing before the migration is present remotely.

## Manual checklist (no real payment)

### Test A — Two HD photos

- Add two different commercial-ready assets as Photo HD.
- Confirm two lines, one internal order, and one Dodo TEST session.
- With a signed test webhook fixture, confirm two licenses and entitlements.

### Test B — Photo HD and 100 credits

- Add one Photo HD and `credits_100`.
- Confirm one order and one checkout containing two Dodo products.
- Replay the signed test fixture and confirm one license, one entitlement,
  exactly +100 credits, and no duplicate records.

### Test C — Multiple formats

- Add the same asset as Photo Web and Photo HD with compatible licenses.
- Confirm two separate lines and, after the migration, two line-keyed licenses
  and entitlements with their respective resolutions.

### Test D — Product becomes unavailable

- Add a product with a test fixture, then mark the fixture inactive.
- Validate the cart and confirm the affected line is blocked.
- Confirm no provider method is called.

### Test E — Double click

- Submit two checkout requests concurrently using provider mocks.
- Confirm one `draft → pending` transition, one session, one transaction, and
  exact-once fulfillment on webhook replay.

Coupons remain outside Sprint 2 because the existing promotion data does not
provide a complete reusable cart discount contract.
