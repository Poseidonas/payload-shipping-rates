import type { ShippingMethodType } from './types.js'

import { matchesAnyPostcode, normalisePostcode } from './postcode.js'

export type ShippingBandInput = {
  amount?: null | number
  from?: null | number
  to?: null | number
}

export type ShippingMethodInput = {
  amount?: null | number
  bands?: (null | ShippingBandInput)[] | null
  code?: null | string
  excludedShippingClasses?: (null | string)[] | null
  label?: null | string
  threshold?: null | number
  type?: null | ShippingMethodType | string
}

export type ShippingZoneInput = {
  countries?: (null | string)[] | null
  id?: null | number | string
  methods?: (null | ShippingMethodInput)[] | null
  name?: null | string
  postcodes?: (null | string)[] | null
  priority?: null | number
}

/**
 * The destination a quote is asked for. Only the country is required.
 */
export type ShippingDestination = {
  country?: null | string
  postalCode?: null | string
}

export type CountryMatch = 'explicit' | 'wildcard'

export type ZoneMatch = {
  /** 'explicit' when the country is listed by name, 'wildcard' when matched by `*`. */
  countryMatch: CountryMatch
  /** True when the zone restricts postcodes and one of its patterns matched. */
  postcodeMatch: boolean
  /** 2 for a postcode match, plus 1 for an explicit country. Higher is more specific. */
  specificity: number
  zone: ShippingZoneInput
}

export const wildcardCountry = '*'

export const normaliseCountry = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toUpperCase() : ''

const listedCountries = (zone: ShippingZoneInput): string[] =>
  (zone.countries ?? [])
    .map((country) => normaliseCountry(country))
    .filter((country) => country !== '')

const listedPostcodes = (zone: ShippingZoneInput): string[] =>
  (zone.postcodes ?? [])
    .filter((pattern): pattern is string => typeof pattern === 'string' && pattern.trim() !== '')

const priorityOf = (zone: ShippingZoneInput): number =>
  typeof zone.priority === 'number' && Number.isFinite(zone.priority) ? zone.priority : 0

const compareIds = (left: ShippingZoneInput, right: ShippingZoneInput): number => {
  const a = left.id
  const b = right.id

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }

  return String(a ?? '').localeCompare(String(b ?? ''))
}

/**
 * Every zone that covers the destination, most specific first.
 *
 * A zone covers the destination when its country list contains the destination
 * country or the wildcard `*`, and, if it restricts postcodes, when one of its
 * patterns matches the destination postcode. A zone with an empty country list
 * covers nothing.
 */
export const matchZones = (
  zones: ShippingZoneInput[],
  destination: ShippingDestination,
): ZoneMatch[] => {
  const country = normaliseCountry(destination.country)
  const postcode = normalisePostcode(destination.postalCode)

  if (country === '') {
    return []
  }

  const matches: ZoneMatch[] = []

  for (const zone of zones) {
    const countries = listedCountries(zone)
    const explicit = countries.includes(country)
    const wildcard = countries.includes(wildcardCountry)

    if (!explicit && !wildcard) {
      continue
    }

    const patterns = listedPostcodes(zone)
    const postcodeMatch = patterns.length > 0 && matchesAnyPostcode(patterns, postcode)

    if (patterns.length > 0 && !postcodeMatch) {
      continue
    }

    matches.push({
      countryMatch: explicit ? 'explicit' : 'wildcard',
      postcodeMatch,
      specificity: (postcodeMatch ? 2 : 0) + (explicit ? 1 : 0),
      zone,
    })
  }

  return matches.sort((left, right) => {
    const byPriority = priorityOf(right.zone) - priorityOf(left.zone)

    if (byPriority !== 0) {
      return byPriority
    }

    const bySpecificity = right.specificity - left.specificity

    if (bySpecificity !== 0) {
      return bySpecificity
    }

    return compareIds(left.zone, right.zone)
  })
}

/**
 * The single zone that serves the destination, or null when none covers it.
 *
 * Precedence, applied in this order and never any other:
 * 1. the higher `priority`
 * 2. the higher specificity, where a postcode match counts 2 and an explicit
 *    country counts 1
 * 3. the lower zone id, so the answer is stable across requests
 */
export const selectZone = (
  zones: ShippingZoneInput[],
  destination: ShippingDestination,
): ZoneMatch | null => matchZones(zones, destination)[0] ?? null
