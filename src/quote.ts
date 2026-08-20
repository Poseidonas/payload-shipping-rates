import type { QuotedMethod, UnavailableMethod } from './methods.js'
import type { WeightUnit } from './types.js'
import type { ShippingDestination, ShippingZoneInput } from './zones.js'

import { quoteMethods } from './methods.js'
import { selectZone } from './zones.js'

/**
 * Why no method could be offered.
 *
 * - `no_destination_country` the caller supplied no country to ship to
 * - `no_matching_zone` no zone covers the destination, so no cost exists to quote
 * - `no_method_available` a zone was found but none of its methods could be costed
 */
export type QuoteReason = 'no_destination_country' | 'no_matching_zone' | 'no_method_available'

export type QuotedZone = {
  id: null | number | string
  name: string
  priority: number
}

export type ShippingQuote = {
  available: boolean
  methods: QuotedMethod[]
  reason: null | QuoteReason
  unavailable: UnavailableMethod[]
  zone: null | QuotedZone
}

export type QuoteInput = {
  destination: ShippingDestination
  /** Shipping classes present in the cart. Leave empty when they are not known. */
  shippingClasses?: (null | string)[] | null
  /** Cart subtotal in integer minor units, or null when it is not known. */
  subtotal?: null | number
  /** Cart weight in whole grams, or null when it is not known. */
  weightGrams?: null | number
  /** Unit the zone's weight band boundaries are written in. Defaults to 'kg'. */
  weightUnit?: WeightUnit
  zones: ShippingZoneInput[]
}

const wholeNonNegative = (value: unknown): null | number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null

const empty = (reason: QuoteReason): ShippingQuote => ({
  available: false,
  methods: [],
  reason,
  unavailable: [],
  zone: null,
})

/**
 * Costs a cart against a set of zones.
 *
 * The function is pure: it reads nothing and writes nothing. When no zone covers
 * the destination it says so, and never falls back to a cost of zero.
 */
export const quoteShipping = (input: QuoteInput): ShippingQuote => {
  const country = input.destination.country

  if (typeof country !== 'string' || country.trim() === '') {
    return empty('no_destination_country')
  }

  const match = selectZone(input.zones, input.destination)

  if (!match) {
    return empty('no_matching_zone')
  }

  const zone: QuotedZone = {
    id: match.zone.id ?? null,
    name:
      typeof match.zone.name === 'string' && match.zone.name.trim() !== ''
        ? match.zone.name.trim()
        : String(match.zone.id ?? ''),
    priority:
      typeof match.zone.priority === 'number' && Number.isFinite(match.zone.priority)
        ? match.zone.priority
        : 0,
  }

  const { available, unavailable } = quoteMethods(match.zone.methods ?? [], {
    shippingClasses: (input.shippingClasses ?? []).filter(
      (entry): entry is string => typeof entry === 'string' && entry.trim() !== '',
    ),
    subtotal: wholeNonNegative(input.subtotal),
    weightGrams: wholeNonNegative(input.weightGrams),
    weightUnit: input.weightUnit ?? 'kg',
  })

  return {
    available: available.length > 0,
    methods: available,
    reason: available.length > 0 ? null : 'no_method_available',
    unavailable,
    zone,
  }
}
