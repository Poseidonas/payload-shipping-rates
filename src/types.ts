import type { CollectionConfig } from 'payload'

/**
 * Unit weight bands are entered in. Bands are converted to whole grams before
 * they are compared, so the comparison never leaves the integers.
 */
export type WeightUnit = 'g' | 'kg' | 'lb' | 'oz'

/**
 * How a method turns a cart into a cost.
 *
 * - `flat` charges `amount` on every order.
 * - `free_over` charges nothing at or above `threshold` and is withdrawn below it.
 * - `weight_bands` charges the band the cart weight falls into.
 * - `price_bands` charges the band the cart subtotal falls into.
 * - `local_pickup` charges `amount`, which is normally zero.
 */
export type ShippingMethodType =
  | 'flat'
  | 'free_over'
  | 'local_pickup'
  | 'price_bands'
  | 'weight_bands'

export type ShippingRatesConfig = {
  /**
   * Slug of the carts collection. The chosen method is recorded here too when the
   * collection exists. Defaults to 'carts'.
   */
  cartsSlug?: string
  /**
   * Stops the quote endpoint from being registered while leaving every collection
   * and field in place, so an existing database keeps its shape.
   */
  disabled?: boolean
  /**
   * Path of the quote endpoint, relative to the Payload API route.
   * Defaults to '/shipping-rates/quote'.
   */
  endpointPath?: string
  /**
   * Name of the group holding the chosen method on orders and carts.
   * Defaults to 'shipping'.
   */
  fieldName?: string
  /**
   * Slug of the orders collection. Defaults to 'orders'.
   */
  ordersSlug?: string
  /**
   * Field on products and variants holding the shipping class.
   * Defaults to 'shippingClass', the name payload-shipping-classes writes.
   */
  shippingClassFieldName?: string
  /**
   * Field on products and variants holding the canonical weight in whole grams.
   * Defaults to 'weightGrams', the name payload-shipping-classes writes.
   */
  weightFieldName?: string
  /**
   * Unit weight band boundaries are entered in. Defaults to 'kg'.
   */
  weightUnit?: WeightUnit
  /**
   * Merged over the generated zones collection. Use it to narrow access or to
   * change the admin group.
   */
  zonesOverrides?: Partial<CollectionConfig>
  /**
   * Slug of the collection holding shipping zones. Defaults to 'shipping-zones'.
   */
  zonesSlug?: string
}

export type ResolvedConfig = {
  cartsSlug: string
  disabled: boolean
  endpointPath: string
  fieldName: string
  ordersSlug: string
  shippingClassFieldName: string
  weightFieldName: string
  weightUnit: WeightUnit
  zonesOverrides: Partial<CollectionConfig>
  zonesSlug: string
}
