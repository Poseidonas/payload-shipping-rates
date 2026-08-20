import type { PayloadRequest } from 'payload'

import type { ResolvedConfig } from './types.js'

export type CartShipping = {
  currency: null | string
  quantity: number
  shippingClasses: string[]
  subtotal: null | number
  unitsWithoutWeight: number
  weightGrams: null | number
}

const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined

const wholeNonNegative = (value: unknown): null | number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null

const readShippingClass = (
  document: Record<string, unknown> | undefined,
  name: string,
): null | string => {
  const value = document?.[name]

  if (typeof value === 'string') {
    return value.trim() === '' ? null : value.trim()
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  const populated = record(value)

  if (populated) {
    if (typeof populated.slug === 'string' && populated.slug.trim() !== '') {
      return populated.slug.trim()
    }

    if (typeof populated.id === 'string' && populated.id.trim() !== '') {
      return populated.id.trim()
    }

    if (typeof populated.id === 'number' && Number.isFinite(populated.id)) {
      return String(populated.id)
    }
  }

  return null
}

const readQuantity = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 1

/**
 * Reads the shipping relevant totals of a cart document.
 *
 * The variant of a line overrides its product, measurement by measurement, and a
 * weight of zero counts as an override. Weight is left null when no line resolved
 * a weight, so a caller can tell an unweighed cart from a weightless one.
 */
export const readCartShipping = (cart: unknown, config: ResolvedConfig): CartShipping => {
  const document = record(cart)
  const items = Array.isArray(document?.items) ? document.items : []
  const classes = new Set<string>()

  let quantity = 0
  let unitsWithoutWeight = 0
  let weightGrams = 0
  let resolvedAny = false

  for (const entry of items) {
    const item = record(entry)

    if (!item) {
      continue
    }

    const product = record(item.product)
    const variant = record(item.variant)
    const lineQuantity = readQuantity(item.quantity)
    const variantWeight = wholeNonNegative(variant?.[config.weightFieldName])
    const productWeight = wholeNonNegative(product?.[config.weightFieldName])
    const weight = variantWeight ?? productWeight

    quantity += lineQuantity

    if (weight === null) {
      unitsWithoutWeight += lineQuantity
    } else {
      resolvedAny = true
      weightGrams += weight * lineQuantity
    }

    const shippingClass =
      readShippingClass(variant, config.shippingClassFieldName) ??
      readShippingClass(product, config.shippingClassFieldName)

    if (shippingClass !== null) {
      classes.add(shippingClass)
    }
  }

  return {
    currency: typeof document?.currency === 'string' ? document.currency : null,
    quantity,
    shippingClasses: [...classes].sort(),
    subtotal: wholeNonNegative(document?.subtotal),
    unitsWithoutWeight,
    weightGrams: resolvedAny ? weightGrams : null,
  }
}

/**
 * Loads a cart through the request, so the read joins the transaction the request
 * already opened rather than taking a second connection from the pool.
 */
export const loadCart = async (
  config: ResolvedConfig,
  req: PayloadRequest,
  cartID: number | string,
  secret?: string,
): Promise<null | unknown> => {
  if (secret) {
    req.query = req.query ?? {}
    ;(req.query as Record<string, unknown>).secret = secret
  }

  try {
    return await req.payload.findByID({
      id: cartID,
      collection: config.cartsSlug,
      depth: 2,
      overrideAccess: false,
      req,
    })
  } catch {
    return null
  }
}
