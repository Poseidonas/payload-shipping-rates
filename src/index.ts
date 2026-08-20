import type { CollectionConfig, Config } from 'payload'

import type { ResolvedConfig, ShippingRatesConfig } from './types.js'

import { shippingZonesCollection } from './collections.js'
import { resolveConfig } from './config.js'
import { quoteEndpoint } from './endpoint.js'
import { shippingSelectionField } from './fields.js'

export { readCartShipping } from './cart.js'
export type { CartShipping } from './cart.js'
export { bandFor, methodCode, methodLabel, quoteMethods, slugify } from './methods.js'
export type {
  MethodContext,
  QuotedMethod,
  UnavailableMethod,
  UnavailableReason,
} from './methods.js'
export { matchesAnyPostcode, matchesPostcode, normalisePostcode } from './postcode.js'
export { quoteShipping } from './quote.js'
export type { QuoteInput, QuotedZone, QuoteReason, ShippingQuote } from './quote.js'
export type { ShippingMethodType, ShippingRatesConfig, WeightUnit } from './types.js'
export { gramsToWeight, weightToGrams } from './units.js'
export { matchZones, normaliseCountry, selectZone } from './zones.js'
export type {
  CountryMatch,
  ShippingBandInput,
  ShippingDestination,
  ShippingMethodInput,
  ShippingZoneInput,
  ZoneMatch,
} from './zones.js'

const withSelectionField = (
  collection: CollectionConfig,
  config: ResolvedConfig,
): CollectionConfig => ({
  ...collection,
  fields: [...collection.fields, shippingSelectionField(config)],
})

export const shippingRatesPlugin =
  (incoming: ShippingRatesConfig = {}) =>
  (incomingConfig: Config): Config => {
    const config = resolveConfig(incoming)
    const collections = incomingConfig.collections ?? []
    const targets = new Set([config.cartsSlug, config.ordersSlug])
    const alreadyDeclared = collections.some(
      (collection) => collection.slug === config.zonesSlug,
    )

    return {
      ...incomingConfig,
      collections: [
        ...collections.map((collection) =>
          targets.has(collection.slug) ? withSelectionField(collection, config) : collection,
        ),
        ...(alreadyDeclared ? [] : [shippingZonesCollection(config)]),
      ],
      endpoints: [
        ...(incomingConfig.endpoints ?? []),
        ...(config.disabled ? [] : [quoteEndpoint(config)]),
      ],
    }
  }
