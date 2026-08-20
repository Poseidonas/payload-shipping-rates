import { describe, expect, it } from 'vitest'

import { resolveConfig } from '../src/config.js'

describe('resolveConfig', () => {
  it('fills in the documented defaults', () => {
    expect(resolveConfig()).toEqual({
      cartsSlug: 'carts',
      disabled: false,
      endpointPath: '/shipping-rates/quote',
      fieldName: 'shipping',
      ordersSlug: 'orders',
      shippingClassFieldName: 'shippingClass',
      weightFieldName: 'weightGrams',
      weightUnit: 'kg',
      zonesOverrides: {},
      zonesSlug: 'shipping-zones',
    })
  })

  it('rejects an unknown weight unit rather than passing it through', () => {
    expect(resolveConfig({ weightUnit: 'stone' as never }).weightUnit).toBe('kg')
  })

  it('accepts every supported weight unit', () => {
    expect(resolveConfig({ weightUnit: 'g' }).weightUnit).toBe('g')
    expect(resolveConfig({ weightUnit: 'lb' }).weightUnit).toBe('lb')
    expect(resolveConfig({ weightUnit: 'oz' }).weightUnit).toBe('oz')
  })

  it('adds the leading slash a path was given without', () => {
    expect(resolveConfig({ endpointPath: 'rates' }).endpointPath).toBe('/rates')
  })

  it('keeps a path that already has a leading slash', () => {
    expect(resolveConfig({ endpointPath: '/rates/quote' }).endpointPath).toBe('/rates/quote')
  })

  it('falls back when a name is given as an empty string', () => {
    expect(resolveConfig({ fieldName: '   ', zonesSlug: '' })).toMatchObject({
      fieldName: 'shipping',
      zonesSlug: 'shipping-zones',
    })
  })

  it('treats disabled as false unless it is exactly true', () => {
    expect(resolveConfig({}).disabled).toBe(false)
    expect(resolveConfig({ disabled: true }).disabled).toBe(true)
  })

  it('defaults the measurement field names to the ones payload-shipping-classes writes', () => {
    expect(resolveConfig()).toMatchObject({
      shippingClassFieldName: 'shippingClass',
      weightFieldName: 'weightGrams',
    })
  })
})
