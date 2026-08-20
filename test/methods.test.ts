import type { MethodContext } from '../src/methods.js'
import type { ShippingMethodInput } from '../src/zones.js'

import { describe, expect, it } from 'vitest'

import { methodCode, quoteMethods, slugify } from '../src/methods.js'

const context = (overrides: Partial<MethodContext> = {}): MethodContext => ({
  shippingClasses: [],
  subtotal: 5000,
  weightGrams: 1000,
  weightUnit: 'kg',
  ...overrides,
})

const quote = (methods: ShippingMethodInput[], overrides: Partial<MethodContext> = {}) =>
  quoteMethods(methods, context(overrides))

describe('flat rate', () => {
  it('charges the amount whatever the cart holds', () => {
    const result = quote([{ amount: 490, label: 'Standard', type: 'flat' }])

    expect(result.available).toEqual([
      { amount: 490, code: 'standard', label: 'Standard', type: 'flat' },
    ])
  })

  it('charges zero when the amount is zero', () => {
    expect(quote([{ amount: 0, label: 'Free', type: 'flat' }]).available[0]?.amount).toBe(0)
  })

  it('is unavailable when no amount was set, rather than free', () => {
    const result = quote([{ label: 'Standard', type: 'flat' }])

    expect(result.available).toEqual([])
    expect(result.unavailable[0]?.reason).toBe('misconfigured')
  })

  it('refuses a negative amount', () => {
    expect(quote([{ amount: -100, label: 'Standard', type: 'flat' }]).unavailable[0]?.reason).toBe(
      'misconfigured',
    )
  })
})

describe('local pickup', () => {
  it('costs nothing when no amount was set', () => {
    expect(quote([{ label: 'Collect in store', type: 'local_pickup' }]).available[0]?.amount).toBe(0)
  })

  it('costs the amount when one was set', () => {
    expect(
      quote([{ amount: 200, label: 'Collect in store', type: 'local_pickup' }]).available[0]?.amount,
    ).toBe(200)
  })
})

describe('free over a threshold', () => {
  const method: ShippingMethodInput = { label: 'Free shipping', threshold: 5000, type: 'free_over' }

  it('is free exactly at the threshold', () => {
    expect(quote([method], { subtotal: 5000 }).available[0]?.amount).toBe(0)
  })

  it('is free above the threshold', () => {
    expect(quote([method], { subtotal: 5001 }).available[0]?.amount).toBe(0)
  })

  it('is withdrawn one minor unit below the threshold', () => {
    const result = quote([method], { subtotal: 4999 })

    expect(result.available).toEqual([])
    expect(result.unavailable[0]?.reason).toBe('below_threshold')
  })

  it('is withdrawn when the subtotal is unknown', () => {
    expect(quote([method], { subtotal: null }).unavailable[0]?.reason).toBe('subtotal_unknown')
  })

  it('is misconfigured without a threshold', () => {
    expect(quote([{ label: 'Free', type: 'free_over' }]).unavailable[0]?.reason).toBe(
      'misconfigured',
    )
  })
})

describe('weight bands', () => {
  const method: ShippingMethodInput = {
    bands: [
      { amount: 350, from: 0, to: 1 },
      { amount: 550, from: 1, to: 5 },
      { amount: 950, from: 5 },
    ],
    label: 'By weight',
    type: 'weight_bands',
  }

  it('takes the first band at zero', () => {
    expect(quote([method], { weightGrams: 0 }).available[0]?.amount).toBe(350)
  })

  it('treats from as inclusive and to as exclusive', () => {
    expect(quote([method], { weightGrams: 999 }).available[0]?.amount).toBe(350)
    expect(quote([method], { weightGrams: 1000 }).available[0]?.amount).toBe(550)
    expect(quote([method], { weightGrams: 4999 }).available[0]?.amount).toBe(550)
    expect(quote([method], { weightGrams: 5000 }).available[0]?.amount).toBe(950)
  })

  it('lets the last band run without an upper bound', () => {
    expect(quote([method], { weightGrams: 250000 }).available[0]?.amount).toBe(950)
  })

  it('converts the boundaries from the configured unit', () => {
    const pounds: ShippingMethodInput = {
      bands: [{ amount: 400, from: 0, to: 5 }],
      label: 'By weight',
      type: 'weight_bands',
    }

    expect(quote([pounds], { weightGrams: 2267, weightUnit: 'lb' }).available[0]?.amount).toBe(400)
    expect(quote([pounds], { weightGrams: 2268, weightUnit: 'lb' }).unavailable[0]?.reason).toBe(
      'no_band',
    )
  })

  it('is withdrawn when the weight is unknown, rather than costing zero', () => {
    const result = quote([method], { weightGrams: null })

    expect(result.available).toEqual([])
    expect(result.unavailable[0]?.reason).toBe('weight_unknown')
  })

  it('is withdrawn when no band covers the weight', () => {
    const gapped: ShippingMethodInput = {
      bands: [{ amount: 350, from: 0, to: 1 }],
      label: 'Light only',
      type: 'weight_bands',
    }

    expect(quote([gapped], { weightGrams: 3000 }).unavailable[0]?.reason).toBe('no_band')
  })

  it('sorts the bands, so the admin order does not change the answer', () => {
    const shuffled: ShippingMethodInput = {
      bands: [
        { amount: 950, from: 5 },
        { amount: 350, from: 0, to: 1 },
        { amount: 550, from: 1, to: 5 },
      ],
      label: 'By weight',
      type: 'weight_bands',
    }

    expect(quote([shuffled], { weightGrams: 2000 }).available[0]?.amount).toBe(550)
  })

  it('drops a band whose upper bound is not above its lower bound', () => {
    const broken: ShippingMethodInput = {
      bands: [
        { amount: 100, from: 5, to: 5 },
        { amount: 200, from: 0, to: 10 },
      ],
      label: 'By weight',
      type: 'weight_bands',
    }

    expect(quote([broken], { weightGrams: 5000 }).available[0]?.amount).toBe(200)
  })

  it('drops a band with no amount rather than treating it as free', () => {
    const broken: ShippingMethodInput = {
      bands: [{ from: 0, to: 1 }],
      label: 'By weight',
      type: 'weight_bands',
    }

    expect(quote([broken], { weightGrams: 500 }).unavailable[0]?.reason).toBe('misconfigured')
  })

  it('is misconfigured with no bands at all', () => {
    expect(
      quote([{ bands: [], label: 'By weight', type: 'weight_bands' }]).unavailable[0]?.reason,
    ).toBe('misconfigured')
  })

  it('reports a missing weight before it reports a missing band', () => {
    expect(quote([method], { weightGrams: null }).unavailable[0]?.reason).toBe('weight_unknown')
  })

  it('defaults a band without a from to zero', () => {
    const open: ShippingMethodInput = {
      bands: [{ amount: 300, to: 2 }],
      label: 'By weight',
      type: 'weight_bands',
    }

    expect(quote([open], { weightGrams: 0 }).available[0]?.amount).toBe(300)
  })
})

describe('price bands', () => {
  const method: ShippingMethodInput = {
    bands: [
      { amount: 700, from: 0, to: 2500 },
      { amount: 400, from: 2500, to: 10000 },
      { amount: 0, from: 10000 },
    ],
    label: 'By value',
    type: 'price_bands',
  }

  it('reads the boundaries as minor units, with no conversion', () => {
    expect(quote([method], { subtotal: 2499 }).available[0]?.amount).toBe(700)
    expect(quote([method], { subtotal: 2500 }).available[0]?.amount).toBe(400)
    expect(quote([method], { subtotal: 10000 }).available[0]?.amount).toBe(0)
  })

  it('is withdrawn when the subtotal is unknown', () => {
    expect(quote([method], { subtotal: null }).unavailable[0]?.reason).toBe('subtotal_unknown')
  })

  it('works with no weight at all, which is the point of a price band', () => {
    expect(quote([method], { subtotal: 3000, weightGrams: null }).available[0]?.amount).toBe(400)
  })
})

describe('shipping class exclusions', () => {
  const method: ShippingMethodInput = {
    amount: 490,
    excludedShippingClasses: ['bulky'],
    label: 'Standard',
    type: 'flat',
  }

  it('withdraws the method when the cart carries an excluded class', () => {
    const result = quote([method], { shippingClasses: ['bulky'] })

    expect(result.available).toEqual([])
    expect(result.unavailable[0]?.reason).toBe('class_excluded')
  })

  it('offers the method when the cart carries other classes', () => {
    expect(quote([method], { shippingClasses: ['fragile'] }).available).toHaveLength(1)
  })

  it('offers the method when no classes are known at all', () => {
    expect(quote([method], { shippingClasses: [] }).available).toHaveLength(1)
  })

  it('ignores an empty exclusion list', () => {
    const open: ShippingMethodInput = {
      amount: 490,
      excludedShippingClasses: [],
      label: 'Standard',
      type: 'flat',
    }

    expect(quote([open], { shippingClasses: ['bulky'] }).available).toHaveLength(1)
  })
})

describe('quoteMethods, ordering and identity', () => {
  it('returns the cheapest method first', () => {
    const result = quote([
      { amount: 990, label: 'Express', type: 'flat' },
      { amount: 490, label: 'Standard', type: 'flat' },
    ])

    expect(result.available.map((method) => method.code)).toEqual(['standard', 'express'])
  })

  it('breaks a tie on cost by the order the methods are declared in', () => {
    const result = quote([
      { amount: 490, label: 'B', type: 'flat' },
      { amount: 490, label: 'A', type: 'flat' },
    ])

    expect(result.available.map((method) => method.code)).toEqual(['b', 'a'])
  })

  it('uses an explicit code over the label', () => {
    expect(quote([{ amount: 1, code: 'std', label: 'Standard', type: 'flat' }]).available[0]?.code).toBe(
      'std',
    )
  })

  it('never repeats a code inside one zone', () => {
    const result = quote([
      { amount: 100, label: 'Standard', type: 'flat' },
      { amount: 200, label: 'Standard', type: 'flat' },
    ])

    expect(new Set(result.available.map((method) => method.code)).size).toBe(2)
  })

  it('falls back to a positional code when there is neither code nor label', () => {
    expect(methodCode({}, 0, new Set())).toBe('method-1')
  })

  it('falls back to the code as the label when no label was given', () => {
    expect(quote([{ amount: 100, code: 'std', type: 'flat' }]).available[0]?.label).toBe('std')
  })

  it('rejects a method with an unknown type', () => {
    expect(quote([{ amount: 100, label: 'Teleport', type: 'teleport' }]).unavailable[0]).toMatchObject(
      { reason: 'misconfigured', type: null },
    )
  })

  it('skips a null entry in the methods array', () => {
    expect(quoteMethods([null], context()).available).toEqual([])
  })

  it('returns nothing for a zone with no methods', () => {
    expect(quoteMethods([], context())).toEqual({ available: [], unavailable: [] })
  })
})

describe('slugify', () => {
  it('lowercases and joins words with a single hyphen', () => {
    expect(slugify('Royal Mail 48')).toBe('royal-mail-48')
  })

  it('trims leading and trailing separators', () => {
    expect(slugify('  Express!  ')).toBe('express')
  })
})
