import { createServiceClient } from '@/lib/supabase/server';
import { DodoPaymentsProvider } from './dodo/DodoPaymentsProvider';
import { getDodoCancelUrl, getDodoReturnUrl } from './dodo/config';
import { updateOrderCheckoutRef } from './PaymentService';
import {
  assertCommercialValidation,
  validateAssetLicensePurchase,
  validateCreditPackPurchase,
} from './CommercialValidationService';

const CART_KIND = 'multi_product';
const CART_CHECKOUT_KEY = 'cart:v1';
export const MAX_CART_LINES = 50;
export const MAX_CART_QUANTITY = 10;

type Environment = 'test' | 'production';
type CartItemType = 'asset_license' | 'credit_pack';

export type CartItemRequest =
  | {
      itemType: 'asset_license';
      assetId: string;
      licenseTypeCode: string;
      unitProductCode: string;
      quantity?: number;
    }
  | {
      itemType: 'credit_pack';
      packCode: string;
      quantity?: number;
    };

export interface CartLine {
  id: string;
  itemType: CartItemType;
  internalProductId: string;
  assetId: string | null;
  licenseTypeId: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  productCode: string;
  productName: string;
  assetTitle: string | null;
  licenseName: string | null;
  format: string | null;
  credits: number | null;
  validationError: string | null;
}

export interface CartSnapshot {
  id: string | null;
  status: 'empty' | 'draft' | 'pending';
  currency: string;
  subtotal: number;
  total: number;
  lineCount: number;
  quantityCount: number;
  locked: boolean;
  checkoutUrl?: string;
  items: CartLine[];
}

export interface CartValidationResult {
  valid: boolean;
  priceChanged: boolean;
  errors: Array<{ itemId: string; message: string }>;
  cart: CartSnapshot;
}

type ValidatedLine = {
  itemType: CartItemType;
  internalProductId: string;
  assetId: string | null;
  licenseTypeId: string | null;
  quantity: number;
  unitPrice: number;
  currency: string;
  dodoProductId: string;
  metadata: Record<string, unknown>;
};

export class CartError extends Error {
  public readonly code: string;
  public readonly status: number;
  constructor(
    code: string,
    message: string,
    status = 400
  ) {
    super(message);
    this.name = 'CartError';
    this.code = code;
    this.status = status;
  }
}

function environment(): Environment {
  return (process.env.DODO_PAYMENTS_ENVIRONMENT ?? 'test') as Environment;
}

function orderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `SV-CART-${date}-${random}`;
}

export function normalizeCartQuantity(itemType: CartItemType, quantity: unknown): number {
  const value = Number(quantity ?? 1);
  if (!Number.isInteger(value) || value < 1) {
    throw new CartError('invalid_quantity', 'Quantity must be a positive integer');
  }
  if (itemType === 'asset_license' && value !== 1) {
    throw new CartError('invalid_quantity', 'Asset licenses have a fixed quantity of one');
  }
  if (value > MAX_CART_QUANTITY) {
    throw new CartError('invalid_quantity', `Quantity cannot exceed ${MAX_CART_QUANTITY}`);
  }
  return value;
}

export function cartLineIdentity(line: {
  itemType: string;
  internalProductId: string;
  assetId?: string | null;
  licenseTypeId?: string | null;
}): string {
  return [line.itemType, line.internalProductId, line.assetId ?? '', line.licenseTypeId ?? ''].join(':');
}

export function cartItemsCanMerge(existing: CartLine, requested: ValidatedLine): boolean {
  return existing.itemType === 'credit_pack'
    && cartLineIdentity(existing) === cartLineIdentity(requested);
}

function emptyCart(): CartSnapshot {
  return {
    id: null,
    status: 'empty',
    currency: 'EUR',
    subtotal: 0,
    total: 0,
    lineCount: 0,
    quantityCount: 0,
    locked: false,
    items: [],
  };
}

function mapCart(order: Record<string, any> | null): CartSnapshot {
  if (!order) return emptyCart();
  const orderMetadata = (order.metadata ?? {}) as Record<string, unknown>;
  const items = ((order.order_items ?? []) as Array<Record<string, any>>)
    .map((item): CartLine => {
      const metadata = (item.metadata ?? {}) as Record<string, unknown>;
      return {
        id: String(item.id),
        itemType: item.item_type as CartItemType,
        internalProductId: String(item.internal_product_id ?? ''),
        assetId: item.asset_id ? String(item.asset_id) : null,
        licenseTypeId: item.license_type_id ? String(item.license_type_id) : null,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        subtotal: Number(item.total_price),
        productCode: String(metadata.productCode ?? ''),
        productName: String(metadata.productName ?? 'Marketplace item'),
        assetTitle: metadata.assetTitle ? String(metadata.assetTitle) : null,
        licenseName: metadata.licenseName ? String(metadata.licenseName) : null,
        format: metadata.format ? String(metadata.format) : null,
        credits: metadata.credits ? Number(metadata.credits) : null,
        validationError: metadata.validationError ? String(metadata.validationError) : null,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    id: String(order.id),
    status: order.status === 'pending' ? 'pending' : 'draft',
    currency: String(order.currency ?? 'EUR'),
    subtotal: Number(order.subtotal ?? 0),
    total: Number(order.total_amount ?? 0),
    lineCount: items.length,
    quantityCount: items.reduce((sum, item) => sum + item.quantity, 0),
    locked: order.status !== 'draft',
    checkoutUrl: typeof orderMetadata.checkout_url === 'string' ? orderMetadata.checkout_url : undefined,
    items,
  };
}

async function findActiveCart(userId: string, client = createServiceClient()) {
  const { data, error } = await client
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', userId)
    .eq('environment', environment())
    .contains('metadata', { cart_kind: CART_KIND })
    .in('status', ['draft', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new CartError('cart_read_failed', `Unable to read cart: ${error.message}`, 500);
  return data as Record<string, any> | null;
}

async function createDraftCart(userId: string, client = createServiceClient()) {
  const metadata = { cart_kind: CART_KIND, checkout_key: CART_CHECKOUT_KEY, cart_version: 1 };
  const { data, error } = await client.from('orders').insert({
    user_id: userId,
    order_number: orderNumber(),
    order_type: 'asset_license',
    currency: 'EUR',
    subtotal: 0,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 0,
    status: 'draft',
    environment: environment(),
    metadata,
  }).select('*').single();

  if (error?.code === '23505') {
    const winner = await findActiveCart(userId, client);
    if (winner) return winner;
  }
  if (error || !data) throw new CartError('cart_create_failed', `Unable to create cart: ${error?.message}`, 500);
  return { ...data, order_items: [] } as Record<string, any>;
}

async function requireDraftCart(userId: string, client = createServiceClient()) {
  const order = (await findActiveCart(userId, client)) ?? (await createDraftCart(userId, client));
  if (order.status !== 'draft') {
    throw new CartError('cart_locked', 'This cart already has an active checkout session', 409);
  }
  return order;
}

async function resolveRequest(request: CartItemRequest, client = createServiceClient()): Promise<ValidatedLine> {
  if (request.itemType === 'asset_license') {
    const quantity = normalizeCartQuantity('asset_license', request.quantity);
    const validation = await validateAssetLicensePurchase({
      assetId: request.assetId,
      licenseTypeCode: request.licenseTypeCode,
      unitProductCode: request.unitProductCode,
      environment: environment(),
    }, client);
    if (!validation.valid) {
      throw new CartError('commercial_validation_failed', `Asset cannot be added to cart: ${validation.blockers.join('; ')}`, 409);
    }
    assertCommercialValidation(validation, 'Asset cannot be added to cart');
    const normalized = validation.normalized_product as {
      asset: { id: string; title?: string };
      license: { id: string; name: string; code: string };
      product: { id: string; name: string; product_code: string; resolution_allowed?: string };
    };
    return {
      itemType: 'asset_license',
      internalProductId: normalized.product.id,
      assetId: normalized.asset.id,
      licenseTypeId: normalized.license.id,
      quantity,
      unitPrice: validation.authoritative_price,
      currency: validation.currency,
      dodoProductId: validation.dodo_product_id,
      metadata: {
        productCode: normalized.product.product_code,
        productName: normalized.product.name,
        assetTitle: normalized.asset.title ?? 'Seafood asset',
        licenseName: normalized.license.name,
        licenseTypeCode: normalized.license.code,
        format: normalized.product.resolution_allowed ?? normalized.product.product_code,
      },
    };
  }

  const quantity = normalizeCartQuantity('credit_pack', request.quantity);
  const validation = await validateCreditPackPurchase({ packCode: request.packCode, environment: environment() }, client);
  if (!validation.valid) {
    throw new CartError('commercial_validation_failed', `Credit pack cannot be added to cart: ${validation.blockers.join('; ')}`, 409);
  }
  assertCommercialValidation(validation, 'Credit pack cannot be added to cart');
  const pack = validation.normalized_product as { id: string; name: string; pack_code: string; credits: number };
  return {
    itemType: 'credit_pack',
    internalProductId: pack.id,
    assetId: null,
    licenseTypeId: null,
    quantity,
    unitPrice: validation.authoritative_price,
    currency: validation.currency,
    dodoProductId: validation.dodo_product_id,
    metadata: {
      productCode: pack.pack_code,
      productName: pack.name,
      credits: Number(pack.credits),
    },
  };
}

async function recalculate(orderId: string, client = createServiceClient()): Promise<void> {
  const { data: items, error } = await client.from('order_items').select('quantity, unit_price').eq('order_id', orderId);
  if (error) throw new CartError('cart_recalculate_failed', `Unable to recalculate cart: ${error.message}`, 500);
  const subtotal = Math.round((items ?? []).reduce(
    (sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0
  ) * 100) / 100;
  const { error: updateError } = await client.from('orders').update({
    subtotal,
    total_amount: subtotal,
    updated_at: new Date().toISOString(),
  }).eq('id', orderId).eq('status', 'draft');
  if (updateError) throw new CartError('cart_recalculate_failed', `Unable to update cart total: ${updateError.message}`, 500);
}

export async function getCart(userId: string, create = false): Promise<CartSnapshot> {
  const client = createServiceClient();
  const order = (await findActiveCart(userId, client)) ?? (create ? await createDraftCart(userId, client) : null);
  return mapCart(order);
}

export async function addCartItem(userId: string, request: CartItemRequest): Promise<CartSnapshot> {
  const client = createServiceClient();
  const validated = await resolveRequest(request, client);
  const order = await requireDraftCart(userId, client);
  const current = mapCart(order);
  if (current.currency !== 'EUR' && current.currency !== validated.currency) {
    throw new CartError('currency_mismatch', 'Cart items must use the same currency');
  }
  if (current.items.length >= MAX_CART_LINES) throw new CartError('cart_limit', `Cart cannot exceed ${MAX_CART_LINES} lines`);

  const identical = current.items.find((item) => cartLineIdentity(item) === cartLineIdentity(validated));
  if (identical && cartItemsCanMerge(identical, validated)) {
    const quantity = normalizeCartQuantity('credit_pack', identical.quantity + validated.quantity);
    const { error } = await client.from('order_items').update({
      quantity,
      total_price: validated.unitPrice * quantity,
      unit_price: validated.unitPrice,
      metadata: { ...validated.metadata, dodoProductId: validated.dodoProductId },
    }).eq('id', identical.id).eq('order_id', order.id);
    if (error) throw new CartError('cart_update_failed', `Unable to merge cart line: ${error.message}`, 500);
  } else if (!identical) {
    const { error } = await client.from('order_items').insert({
      order_id: order.id,
      item_type: validated.itemType,
      internal_product_id: validated.internalProductId,
      asset_id: validated.assetId,
      license_type_id: validated.licenseTypeId,
      quantity: validated.quantity,
      unit_price: validated.unitPrice,
      total_price: validated.unitPrice * validated.quantity,
      metadata: { ...validated.metadata, dodoProductId: validated.dodoProductId },
    });
    if (error) throw new CartError('cart_add_failed', `Unable to add cart line: ${error.message}`, 500);
  }

  await recalculate(order.id, client);
  return mapCart(await findActiveCart(userId, client));
}

export async function updateCartItem(userId: string, itemId: string, quantity: number): Promise<CartSnapshot> {
  const client = createServiceClient();
  const order = await requireDraftCart(userId, client);
  const current = mapCart(order);
  const item = current.items.find((line) => line.id === itemId);
  if (!item) throw new CartError('item_not_found', 'Cart line was not found', 404);
  const normalized = normalizeCartQuantity(item.itemType, quantity);
  const { error } = await client.from('order_items').update({
    quantity: normalized,
    total_price: item.unitPrice * normalized,
  }).eq('id', itemId).eq('order_id', order.id);
  if (error) throw new CartError('cart_update_failed', `Unable to update cart line: ${error.message}`, 500);
  await recalculate(order.id, client);
  return mapCart(await findActiveCart(userId, client));
}

export async function removeCartItem(userId: string, itemId: string): Promise<CartSnapshot> {
  const client = createServiceClient();
  const order = await requireDraftCart(userId, client);
  const { error } = await client.from('order_items').delete().eq('id', itemId).eq('order_id', order.id);
  if (error) throw new CartError('cart_remove_failed', `Unable to remove cart line: ${error.message}`, 500);
  await recalculate(order.id, client);
  return mapCart(await findActiveCart(userId, client));
}

export async function clearCart(userId: string): Promise<CartSnapshot> {
  const client = createServiceClient();
  const order = await findActiveCart(userId, client);
  if (!order) return emptyCart();
  if (order.status !== 'draft') throw new CartError('cart_locked', 'This cart already has an active checkout session', 409);
  const { error } = await client.from('order_items').delete().eq('order_id', order.id);
  if (error) throw new CartError('cart_clear_failed', `Unable to empty cart: ${error.message}`, 500);
  await recalculate(order.id, client);
  return mapCart(await findActiveCart(userId, client));
}

async function revalidateStoredLine(item: CartLine, client = createServiceClient()): Promise<ValidatedLine> {
  if (item.itemType === 'asset_license') {
    const [productResult, licenseResult] = await Promise.all([
      client.from('unit_products').select('product_code').eq('id', item.internalProductId).maybeSingle(),
      client.from('license_types').select('code').eq('id', item.licenseTypeId).maybeSingle(),
    ]);
    const product = productResult.data;
    const license = licenseResult.data;
    if (!item.assetId || !product?.product_code || !license?.code) {
      throw new CartError('invalid_line', 'Asset cart line references are incomplete');
    }
    return resolveRequest({
      itemType: 'asset_license',
      assetId: item.assetId,
      unitProductCode: product.product_code,
      licenseTypeCode: license.code,
      quantity: item.quantity,
    }, client);
  }
  const { data: pack } = await client.from('credit_packs').select('pack_code').eq('id', item.internalProductId).maybeSingle();
  if (!pack?.pack_code) throw new CartError('invalid_line', 'Credit pack cart line reference is incomplete');
  return resolveRequest({ itemType: 'credit_pack', packCode: pack.pack_code, quantity: item.quantity }, client);
}

export async function validateCart(userId: string): Promise<CartValidationResult> {
  const client = createServiceClient();
  const order = await requireDraftCart(userId, client);
  const cart = mapCart(order);
  if (!cart.items.length) throw new CartError('empty_cart', 'Cart is empty');
  const errors: Array<{ itemId: string; message: string }> = [];
  let priceChanged = false;
  let currency: string | null = null;

  for (const item of cart.items) {
    try {
      const validated = await revalidateStoredLine(item, client);
      if (currency && currency !== validated.currency) throw new CartError('currency_mismatch', 'Cart contains multiple currencies');
      currency = validated.currency;
      priceChanged ||= item.unitPrice !== validated.unitPrice;
      await client.from('order_items').update({
        unit_price: validated.unitPrice,
        total_price: validated.unitPrice * item.quantity,
        metadata: { ...validated.metadata, dodoProductId: validated.dodoProductId, validationError: null },
      }).eq('id', item.id).eq('order_id', order.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Line validation failed';
      errors.push({ itemId: item.id, message });
      const { data: stored } = await client.from('order_items').select('metadata').eq('id', item.id).maybeSingle();
      await client.from('order_items').update({
        metadata: { ...((stored?.metadata ?? {}) as Record<string, unknown>), validationError: message },
      }).eq('id', item.id).eq('order_id', order.id);
    }
  }

  await recalculate(order.id, client);
  const { data: currentOrder } = await client.from('orders').select('metadata').eq('id', order.id).single();
  await client.from('orders').update({
    currency: currency ?? cart.currency,
    metadata: {
      ...((currentOrder?.metadata ?? {}) as Record<string, unknown>),
      cart_validation: {
        validatedAt: new Date().toISOString(),
        valid: errors.length === 0,
        priceChanged,
      },
    },
  }).eq('id', order.id).eq('status', 'draft');

  return {
    valid: errors.length === 0,
    priceChanged,
    errors,
    cart: mapCart(await findActiveCart(userId, client)),
  };
}

export async function initiateCartCheckout(params: { userId: string; userEmail: string }) {
  const validation = await validateCart(params.userId);
  if (!validation.valid) throw new CartError('cart_invalid', 'Cart contains invalid lines', 409);
  if (validation.priceChanged) throw new CartError('price_changed', 'Cart prices changed. Review and confirm the updated total.', 409);

  const client = createServiceClient();
  const order = await findActiveCart(params.userId, client);
  if (!order) throw new CartError('cart_not_found', 'Cart was not found', 404);
  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  if (order.status === 'pending') {
    if (typeof metadata.checkout_url === 'string') {
      return { checkoutUrl: metadata.checkout_url, orderId: String(order.id), reused: true };
    }
    throw new CartError('checkout_initializing', 'Checkout is already being initialized', 409);
  }

  const provider = new DodoPaymentsProvider();
  if (!provider.getConfig().isCheckoutReady) throw new CartError('provider_unavailable', 'Dodo Payments is not configured for checkout', 503);
  if (environment() !== 'test') throw new CartError('environment_forbidden', 'Sprint 2 cart checkout is restricted to Dodo TEST', 503);

  const { data: locked, error: lockError } = await client.from('orders').update({
    status: 'pending',
    metadata: { ...metadata, checkout_initializing: true, checkout_locked_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  }).eq('id', order.id).eq('user_id', params.userId).eq('status', 'draft').select('id').maybeSingle();
  if (lockError) throw new CartError('checkout_lock_failed', `Unable to lock cart: ${lockError.message}`, 500);
  if (!locked) throw new CartError('checkout_already_started', 'Checkout has already started for this cart', 409);

  let providerSessionCreated = false;
  try {
    const refreshed = await findActiveCart(params.userId, client);
    const productCart = ((refreshed?.order_items ?? []) as Array<Record<string, any>>).map((item) => {
      const itemMetadata = (item.metadata ?? {}) as Record<string, unknown>;
      const productId = String(itemMetadata.dodoProductId ?? '');
      if (!productId) throw new CartError('mapping_missing', `Dodo mapping is missing for cart line ${item.id}`, 409);
      return { productId, quantity: Number(item.quantity) };
    });
    const result = await provider.createCheckout({
      orderId: String(order.id),
      userId: params.userId,
      userEmail: params.userEmail,
      amount: Number(refreshed?.total_amount ?? 0),
      currency: String(refreshed?.currency ?? 'EUR'),
      productName: `SeafoodVision cart (${productCart.length} lines)`,
      successUrl: `${getDodoReturnUrl()}?order=${order.id}&type=cart`,
      cancelUrl: `${getDodoCancelUrl()}?order=${order.id}&type=cart`,
      metadata: { cart: CART_KIND },
      productCart,
    });
    providerSessionCreated = true;
    await updateOrderCheckoutRef(String(order.id), result.externalCheckoutId, result.checkoutUrl);
    return { checkoutUrl: result.checkoutUrl, orderId: String(order.id), reused: false };
  } catch (error) {
    // Once Dodo has accepted a session, never unlock the order automatically:
    // doing so could create a second provider session on retry. A session that
    // failed before provider creation is safe to return to draft.
    if (!providerSessionCreated) {
      await client.from('orders').update({
        status: 'draft',
        external_checkout_id: null,
        metadata: { ...metadata, checkout_initializing: false },
        updated_at: new Date().toISOString(),
      }).eq('id', order.id).eq('status', 'pending').is('external_checkout_id', null);
    }
    throw error;
  }
}
