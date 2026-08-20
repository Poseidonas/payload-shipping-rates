import type { ShippingZoneInput } from '../src/zones.js'

import { describe, expect, it } from 'vitest'

import { matchZones, normaliseCountry, selectZone } from '../src/zones.js'

const zone = (input: ShippingZoneInput): ShippingZoneInput => input

const uk = zone({ id: 1, countries: ['GB'], name: 'United Kingdom' })
const london = zone({ id: 2, countries: ['GB'], name: 'London', postcodes: ['SW1*', 'EC*'] })
const world = zone({ id: 3, countries: ['*'], name: 'Rest of world' })

describe('normaliseCountry', () => {
  it('trims and uppercases', () => {
    expect(normaliseCountry(' gb ')).toBe('GB')
  })

  it('returns an empty string for anything that is not a string', () => {
    expect(normaliseCountry(null)).toBe('')
  })
})

describe('matchZones', () => {
  it('matches a zone by country', () => {
    expect(matchZones([uk], { country: 'GB' }).map((match) => match.zone.id)).toEqual([1])
  })

  it('matches regardless of the case the country is written in', () => {
    expect(matchZones([uk], { country: 'gb' })).toHaveLength(1)
  })

  it('does not match a country the zone does not list', () => {
    expect(matchZones([uk], { country: 'FR' })).toEqual([])
  })

  it('matches a wildcard zone for any country', () => {
    expect(matchZones([world], { country: 'JP' })).toHaveLength(1)
  })

  it('returns nothing when the destination has no country', () => {
    expect(matchZones([uk, world], {})).toEqual([])
    expect(matchZones([uk, world], { country: '  ' })).toEqual([])
  })

  it('matches a zone with no postcode restriction for any postcode', () => {
    expect(matchZones([uk], { country: 'GB', postalCode: 'ZZ99 9ZZ' })).toHaveLength(1)
  })

  it('withdraws a postcode restricted zone when the postcode does not match', () => {
    expect(matchZones([london], { country: 'GB', postalCode: 'M1 1AE' })).toEqual([])
  })

  it('keeps a postcode restricted zone when the postcode matches', () => {
    expect(matchZones([london], { country: 'GB', postalCode: 'SW1A 1AA' })).toHaveLength(1)
  })

  it('ignores a zone with an empty country list', () => {
    expect(matchZones([zone({ id: 9, countries: [], name: 'Nowhere' })], { country: 'GB' })).toEqual(
      [],
    )
  })

  it('ignores a zone with no country list at all', () => {
    expect(matchZones([zone({ id: 9, name: 'Nowhere' })], { country: 'GB' })).toEqual([])
  })

  it('records how each zone matched', () => {
    const matches = matchZones([london, world], { country: 'GB', postalCode: 'SW1A 1AA' })

    expect(matches[0]).toMatchObject({ countryMatch: 'explicit', postcodeMatch: true, specificity: 3 })
    expect(matches[1]).toMatchObject({ countryMatch: 'wildcard', postcodeMatch: false, specificity: 0 })
  })
})

describe('selectZone, precedence', () => {
  it('prefers a postcode match over a country only match', () => {
    const chosen = selectZone([uk, london], { country: 'GB', postalCode: 'SW1A 1AA' })

    expect(chosen?.zone.id).toBe(2)
  })

  it('prefers an explicit country over a wildcard', () => {
    const chosen = selectZone([world, uk], { country: 'GB' })

    expect(chosen?.zone.id).toBe(1)
  })

  it('prefers a wildcard zone with a postcode match over an explicit country zone without one', () => {
    const wildcardPostcode = zone({ id: 4, countries: ['*'], name: 'Islands', postcodes: ['HS*'] })
    const chosen = selectZone([uk, wildcardPostcode], { country: 'GB', postalCode: 'HS1 2AB' })

    expect(chosen?.zone.id).toBe(4)
  })

  it('lets priority beat specificity', () => {
    const forced = zone({ id: 5, countries: ['GB'], name: 'Forced', priority: 10 })
    const chosen = selectZone([forced, london], { country: 'GB', postalCode: 'SW1A 1AA' })

    expect(chosen?.zone.id).toBe(5)
  })

  it('treats a missing priority as zero', () => {
    const negative = zone({ id: 6, countries: ['GB'], name: 'Down', priority: -1 })
    const chosen = selectZone([negative, uk], { country: 'GB' })

    expect(chosen?.zone.id).toBe(1)
  })

  it('breaks a full tie by the lower numeric id', () => {
    const a = zone({ id: 8, countries: ['GB'], name: 'A' })
    const b = zone({ id: 3, countries: ['GB'], name: 'B' })

    expect(selectZone([a, b], { country: 'GB' })?.zone.id).toBe(3)
  })

  it('breaks a full tie by string id when the ids are strings', () => {
    const a = zone({ id: 'bbb', countries: ['GB'], name: 'A' })
    const b = zone({ id: 'aaa', countries: ['GB'], name: 'B' })

    expect(selectZone([a, b], { country: 'GB' })?.zone.id).toBe('aaa')
  })

  it('does not depend on the order the zones arrive in', () => {
    const forward = selectZone([uk, london, world], { country: 'GB', postalCode: 'EC1A 1BB' })
    const backward = selectZone([world, london, uk], { country: 'GB', postalCode: 'EC1A 1BB' })

    expect(forward?.zone.id).toBe(backward?.zone.id)
    expect(forward?.zone.id).toBe(2)
  })

  it('returns null when no zone covers the destination', () => {
    expect(selectZone([uk], { country: 'FR' })).toBeNull()
  })

  it('returns null for an empty set of zones', () => {
    expect(selectZone([], { country: 'GB' })).toBeNull()
  })
})
