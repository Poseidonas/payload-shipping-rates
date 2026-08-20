import type { ShippingZoneInput } from '../src/zones.js'

import { describe, expect, it } from 'vitest'

import { quoteShipping } from '../src/quote.js'

const uk: ShippingZoneInput = {
  id: 1,
  countries: ['GB'],
  methods: [
    { amount: 490, label: 'Standard', type: 'flat' },
    { label: 'Free shipping', threshold: 5000, type: 'free_over' },
  ],
  name: 'United Kingdom',
}

const world: ShippingZoneInput = {
  id: 2,
  countries: ['*'],
  methods: [{ amount: 1990, label: 'International', type: 'flat' }],
  name: 'Rest of world',
}

describe('quoteShipping', () => {
  it('quotes the methods of the winning zone', () => {
    const quote = quoteShipping({
      destination: { country: 'GB' },
      subtotal: 2000,
      zones: [uk, world],
    })

    expect(quote.available).toBe(true)
    expect(quote.zone).toEqual({ id: 1, name: 'United Kingdom', priority: 0 })
    expect(quote.methods.map((method) => method.code)).toEqual(['standard'])
  })

  it('offers both methods once the threshold is reached, cheapest first', () => {
    const quote = quoteShipping({
      destination: { country: 'GB' },
      subtotal: 6000,
      zones: [uk],
    })

    expect(quote.methods.map((method) => [method.code, method.amount])).toEqual([
      ['free-shipping', 0],
      ['standard', 490],
    ])
  })

  it('never quotes a cost when no zone covers the destination', () => {
    const quote = quoteShipping({ destination: { country: 'FR' }, subtotal: 6000, zones: [uk] })

    expect(quote).toEqual({
      available: false,
      methods: [],
      reason: 'no_matching_zone',
      unavailable: [],
      zone: null,
    })
  })

  it('says so when the destination has no country', () => {
    expect(quoteShipping({ destination: {}, zones: [uk] }).reason).toBe('no_destination_country')
    expect(quoteShipping({ destination: { country: '  ' }, zones: [uk] }).reason).toBe(
      'no_destination_country',
    )
  })

  it('reports a zone whose methods could none of them be costed', () => {
    const quote = quoteShipping({
      destination: { country: 'GB' },
      subtotal: null,
      zones: [{ id: 3, countries: ['GB'], methods: [{ label: 'Free', threshold: 100, type: 'free_over' }], name: 'GB' }],
    })

    expect(quote.available).toBe(false)
    expect(quote.reason).toBe('no_method_available')
    expect(quote.zone?.id).toBe(3)
    expect(quote.unavailable[0]?.reason).toBe('subtotal_unknown')
  })

  it('serves only the winning zone, never a union of zones', () => {
    const quote = quoteShipping({ destination: { country: 'GB' }, subtotal: 100, zones: [uk, world] })

    expect(quote.methods.some((method) => method.code === 'international')).toBe(false)
  })

  it('reads the weight unit for band boundaries from the input', () => {
    const zones: ShippingZoneInput[] = [
      {
        id: 4,
        countries: ['US'],
        methods: [
          { bands: [{ amount: 600, from: 0, to: 5 }], label: 'Ground', type: 'weight_bands' },
        ],
        name: 'United States',
      },
    ]
    const quote = quoteShipping({
      destination: { country: 'US' },
      weightGrams: 2267,
      weightUnit: 'lb',
      zones,
    })

    expect(quote.methods[0]?.amount).toBe(600)
  })

  it('rounds a fractional subtotal rather than carrying it into the comparison', () => {
    const quote = quoteShipping({
      destination: { country: 'GB' },
      subtotal: 4999.6,
      zones: [uk],
    })

    expect(quote.methods.map((method) => method.code)).toContain('free-shipping')
  })

  it('treats a negative subtotal as unknown rather than as zero', () => {
    const quote = quoteShipping({ destination: { country: 'GB' }, subtotal: -1, zones: [uk] })

    expect(quote.unavailable.map((method) => method.reason)).toContain('subtotal_unknown')
  })

  it('ignores shipping class entries that are not usable strings', () => {
    const zones: ShippingZoneInput[] = [
      {
        id: 5,
        countries: ['GB'],
        methods: [
          { amount: 490, excludedShippingClasses: ['bulky'], label: 'Standard', type: 'flat' },
        ],
        name: 'GB',
      },
    ]
    const quote = quoteShipping({
      destination: { country: 'GB' },
      shippingClasses: [null, '  '],
      subtotal: 1000,
      zones,
    })

    expect(quote.available).toBe(true)
  })

  it('names a zone by its id when it has no name', () => {
    const quote = quoteShipping({
      destination: { country: 'GB' },
      subtotal: 1,
      zones: [{ id: 11, countries: ['GB'], methods: [{ amount: 1, label: 'A', type: 'flat' }] }],
    })

    expect(quote.zone?.name).toBe('11')
  })

  it('returns an empty quote for an empty set of zones', () => {
    expect(quoteShipping({ destination: { country: 'GB' }, zones: [] }).reason).toBe(
      'no_matching_zone',
    )
  })

  it('is pure, so the same input always gives the same answer', () => {
    const input = { destination: { country: 'GB', postalCode: 'SW1A 1AA' }, subtotal: 6000, zones: [uk, world] }

    expect(quoteShipping(input)).toEqual(quoteShipping(input))
  })
})
