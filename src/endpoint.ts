import type { Endpoint, PayloadHandler, PayloadRequest } from 'payload'

import { addDataAndFileToRequest } from 'payload'

import type { ResolvedConfig } from './types.js'
import type { ShippingDestination, ShippingZoneInput } from './zones.js'

import { loadCart, readCartShipping } from './cart.js'
import { quoteShipping } from './quote.js'

const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined

const wholeNonNegative = (value: unknown): null | number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null

const stringOrNull = (value: unknown): null | string =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
        .map((entry) => entry.trim())
    : []

export const loadZones = async (
  config: ResolvedConfig,
  req: PayloadRequest,
): Promise<ShippingZoneInput[]> => {
  const result = await req.payload.find({
    collection: config.zonesSlug,
    depth: 0,
    overrideAccess: true,
    pagination: false,
    req,
    sort: 'id',
  })

  return result.docs as ShippingZoneInput[]
}

/**
 * Answers a quote request. The body accepts either a `cartID`, from which the
 * subtotal, weight and shipping classes are read, or those values directly.
 * Values given in the body always win over values read from the cart.
 */
export const quoteHandler =
  (config: ResolvedConfig): PayloadHandler =>
  async (req) => {
    await addDataAndFileToRequest(req)

    const data = record(req.data) ?? {}
    const address = record(data.address) ?? {}
    const destination: ShippingDestination = {
      country: stringOrNull(address.country),
      postalCode: stringOrNull(address.postalCode),
    }

    if (destination.country === null) {
      return Response.json(
        { message: 'A destination country is required to quote shipping.' },
        { status: 400 },
      )
    }

    let subtotal = wholeNonNegative(data.subtotal)
    let currency = stringOrNull(data.currency)
    let weightGrams = wholeNonNegative(data.weightGrams)
    let shippingClasses = stringList(data.shippingClasses)

    const cartID = data.cartID

    if (typeof cartID === 'string' || typeof cartID === 'number') {
      const secret = stringOrNull(data.secret)
      const cart = await loadCart(config, req, cartID, secret ?? undefined)

      if (!cart) {
        return Response.json(
          { message: `Cart with ID ${String(cartID)} not found.` },
          { status: 404 },
        )
      }

      const fromCart = readCartShipping(cart, config)

      subtotal = subtotal ?? fromCart.subtotal
      currency = currency ?? fromCart.currency
      weightGrams = weightGrams ?? fromCart.weightGrams
      shippingClasses = shippingClasses.length > 0 ? shippingClasses : fromCart.shippingClasses
    }

    const zones = await loadZones(config, req)
    const quote = quoteShipping({
      destination,
      shippingClasses,
      subtotal,
      weightGrams,
      weightUnit: config.weightUnit,
      zones,
    })

    return Response.json({
      ...quote,
      currency,
      destination,
      shippingClasses,
      subtotal,
      weightGrams,
    })
  }

export const quoteEndpoint = (config: ResolvedConfig): Endpoint => ({
  handler: quoteHandler(config),
  method: 'post',
  path: config.endpointPath,
})
