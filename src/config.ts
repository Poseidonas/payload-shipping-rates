import type { ResolvedConfig, ShippingRatesConfig } from './types.js'

import { isWeightUnit } from './units.js'

const text = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback

const path = (value: unknown, fallback: string): string => {
  const raw = text(value, fallback)

  return raw.startsWith('/') ? raw : `/${raw}`
}

export const resolveConfig = (incoming: ShippingRatesConfig = {}): ResolvedConfig => ({
  cartsSlug: text(incoming.cartsSlug, 'carts'),
  disabled: incoming.disabled === true,
  endpointPath: path(incoming.endpointPath, '/shipping-rates/quote'),
  fieldName: text(incoming.fieldName, 'shipping'),
  ordersSlug: text(incoming.ordersSlug, 'orders'),
  shippingClassFieldName: text(incoming.shippingClassFieldName, 'shippingClass'),
  weightFieldName: text(incoming.weightFieldName, 'weightGrams'),
  weightUnit: isWeightUnit(incoming.weightUnit) ? incoming.weightUnit : 'kg',
  zonesOverrides: incoming.zonesOverrides ?? {},
  zonesSlug: text(incoming.zonesSlug, 'shipping-zones'),
})
