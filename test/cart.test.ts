import { describe, expect, it } from 'vitest'

import { readCartShipping } from '../src/cart.js'
import { resolveConfig } from '../src/config.js'

const config = resolveConfig()

describe('readCartShipping', () => {
  it('totals the weight of every line', () => {
    const totals = readCartShipping(
      {
        items: [
          { product: { weightGrams: 250 }, quantity: 3 },
          { product: { weightGrams: 1000 }, quantity: 1 },
        ],
      },
      config,
    )

    expect(totals.weightGrams).toBe(1750)
    expect(totals.quantity).toBe(4)
  })

  it('takes the variant weight over the product weight', () => {
    const totals = readCartShipping(
      { items: [{ product: { weightGrams: 1000 }, quantity: 1, variant: { weightGrams: 200 } }] },
      config,
    )

    expect(totals.weightGrams).toBe(200)
  })

  it('treats a variant weight of zero as an override', () => {
    const totals = readCartShipping(
      { items: [{ product: { weightGrams: 1000 }, quantity: 1, variant: { weightGrams: 0 } }] },
      config,
    )

    expect(totals.weightGrams).toBe(0)
  })

  it('leaves the weight null when no line resolved one', () => {
    const totals = readCartShipping({ items: [{ product: { title: 'Poster' }, quantity: 2 }] }, config)

    expect(totals.weightGrams).toBeNull()
    expect(totals.unitsWithoutWeight).toBe(2)
  })

  it('distinguishes a weightless cart from an unweighed one', () => {
    const weightless = readCartShipping(
      { items: [{ product: { weightGrams: 0 }, quantity: 1 }] },
      config,
    )

    expect(weightless.weightGrams).toBe(0)
    expect(weightless.unitsWithoutWeight).toBe(0)
  })

  it('counts the units of a partially weighed cart', () => {
    const totals = readCartShipping(
      {
        items: [
          { product: { weightGrams: 500 }, quantity: 1 },
          { product: { title: 'Gift card' }, quantity: 3 },
        ],
      },
      config,
    )

    expect(totals.weightGrams).toBe(500)
    expect(totals.unitsWithoutWeight).toBe(3)
  })

  it('collects distinct shipping classes in ascending order', () => {
    const totals = readCartShipping(
      {
        items: [
          { product: { shippingClass: { slug: 'fragile' } } },
          { product: { shippingClass: { slug: 'bulky' } } },
          { product: { shippingClass: { slug: 'fragile' } } },
        ],
      },
      config,
    )

    expect(totals.shippingClasses).toEqual(['bulky', 'fragile'])
  })

  it('reads a shipping class that was not populated', () => {
    const totals = readCartShipping({ items: [{ product: { shippingClass: 7 } }] }, config)

    expect(totals.shippingClasses).toEqual(['7'])
  })

  it('reads the subtotal and currency the official plugin stores', () => {
    const totals = readCartShipping({ currency: 'GBP', items: [], subtotal: 4990 }, config)

    expect(totals.subtotal).toBe(4990)
    expect(totals.currency).toBe('GBP')
  })

  it('leaves the subtotal null when the cart has none', () => {
    expect(readCartShipping({ items: [] }, config).subtotal).toBeNull()
  })

  it('reads the configured field names', () => {
    const named = resolveConfig({ shippingClassFieldName: 'classRef', weightFieldName: 'grams' })
    const totals = readCartShipping(
      { items: [{ product: { classRef: { slug: 'heavy' }, grams: 800 } }] },
      named,
    )

    expect(totals.weightGrams).toBe(800)
    expect(totals.shippingClasses).toEqual(['heavy'])
  })

  it('survives a cart with no items array', () => {
    expect(readCartShipping({}, config)).toEqual({
      currency: null,
      quantity: 0,
      shippingClasses: [],
      subtotal: null,
      unitsWithoutWeight: 0,
      weightGrams: null,
    })
  })

  it('survives a cart that is not an object at all', () => {
    expect(readCartShipping(null, config).weightGrams).toBeNull()
  })

  it('defaults a missing quantity to one', () => {
    expect(readCartShipping({ items: [{ product: { weightGrams: 300 } }] }, config).quantity).toBe(1)
  })

  it('clamps a negative quantity to zero', () => {
    const totals = readCartShipping(
      { items: [{ product: { weightGrams: 300 }, quantity: -2 }] },
      config,
    )

    expect(totals.quantity).toBe(0)
    expect(totals.weightGrams).toBe(0)
  })
})
