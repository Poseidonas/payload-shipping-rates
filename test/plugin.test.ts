import type { CollectionConfig, Config } from 'payload'

import { describe, expect, it, vi } from 'vitest'

vi.mock('payload', () => ({ addDataAndFileToRequest: async () => undefined }))

const { shippingRatesPlugin } = await import('../src/index.js')

const orders: CollectionConfig = { slug: 'orders', fields: [{ name: 'status', type: 'text' }] }
const carts: CollectionConfig = { slug: 'carts', fields: [{ name: 'subtotal', type: 'number' }] }

const baseConfig = (collections: CollectionConfig[]): Config => ({ collections }) as Config

const collection = (config: Config, slug: string): CollectionConfig | undefined =>
  config.collections?.find((entry) => entry.slug === slug)

const fieldNames = (config: Config, slug: string): string[] =>
  (collection(config, slug)?.fields ?? []).map((field) =>
    'name' in field && typeof field.name === 'string' ? field.name : '',
  )

describe('shippingRatesPlugin', () => {
  it('adds the shipping group to orders', () => {
    const result = shippingRatesPlugin()(baseConfig([orders]))

    expect(fieldNames(result, 'orders')).toEqual(['status', 'shipping'])
  })

  it('adds the same group to carts', () => {
    const result = shippingRatesPlugin()(baseConfig([orders, carts]))

    expect(fieldNames(result, 'carts')).toContain('shipping')
  })

  it('carries the method, its label, its type, the zone and the amount', () => {
    const result = shippingRatesPlugin()(baseConfig([orders]))
    const group = (collection(result, 'orders')?.fields ?? []).find(
      (field) => 'name' in field && field.name === 'shipping',
    )
    const names =
      group && 'fields' in group
        ? group.fields.map((field) => ('name' in field ? field.name : ''))
        : []

    expect(names).toEqual(['method', 'label', 'type', 'zone', 'amount'])
  })

  it('adds the zones collection', () => {
    const result = shippingRatesPlugin()(baseConfig([orders]))

    expect(result.collections?.map((entry) => entry.slug)).toContain('shipping-zones')
  })

  it('does not add a second zones collection when the shop declared one', () => {
    const declared: CollectionConfig = { slug: 'shipping-zones', fields: [] }
    const result = shippingRatesPlugin()(baseConfig([orders, declared]))

    expect(result.collections?.filter((entry) => entry.slug === 'shipping-zones')).toHaveLength(1)
  })

  it('registers the quote endpoint', () => {
    const result = shippingRatesPlugin()(baseConfig([orders]))

    expect(result.endpoints).toHaveLength(1)
    expect(result.endpoints?.[0]).toMatchObject({
      method: 'post',
      path: '/shipping-rates/quote',
    })
  })

  it('keeps endpoints the shop already registered', () => {
    const existing = { handler: () => new Response(), method: 'get' as const, path: '/health' }
    const result = shippingRatesPlugin()({
      collections: [orders],
      endpoints: [existing],
    } as unknown as Config)

    expect(result.endpoints).toHaveLength(2)
    expect(result.endpoints?.[0]).toBe(existing)
  })

  it('registers no endpoint when disabled, but keeps the collection and the fields', () => {
    const result = shippingRatesPlugin({ disabled: true })(baseConfig([orders]))

    expect(result.endpoints).toEqual([])
    expect(fieldNames(result, 'orders')).toContain('shipping')
    expect(result.collections?.map((entry) => entry.slug)).toContain('shipping-zones')
  })

  it('works on a config with no collections at all', () => {
    const result = shippingRatesPlugin()({} as Config)

    expect(result.collections?.map((entry) => entry.slug)).toEqual(['shipping-zones'])
  })

  it('leaves other collections untouched', () => {
    const other: CollectionConfig = { slug: 'products', fields: [{ name: 'title', type: 'text' }] }
    const result = shippingRatesPlugin()(baseConfig([orders, other]))

    expect(fieldNames(result, 'products')).toEqual(['title'])
  })

  it('honours custom slugs, field names and endpoint path', () => {
    const result = shippingRatesPlugin({
      endpointPath: '/rates',
      fieldName: 'delivery',
      ordersSlug: 'purchases',
      zonesSlug: 'delivery-zones',
    })(baseConfig([{ slug: 'purchases', fields: [] }]))

    expect(fieldNames(result, 'purchases')).toEqual(['delivery'])
    expect(result.collections?.map((entry) => entry.slug)).toContain('delivery-zones')
    expect(result.endpoints?.[0]?.path).toBe('/rates')
  })

  it('applies the zones overrides last', () => {
    const result = shippingRatesPlugin({ zonesOverrides: { admin: { group: 'Shipping' } } })(
      baseConfig([orders]),
    )

    expect(collection(result, 'shipping-zones')?.admin?.group).toBe('Shipping')
  })

  it('describes the weight band boundaries in the configured unit', () => {
    const result = shippingRatesPlugin({ weightUnit: 'lb' })(baseConfig([orders]))
    const methods = (collection(result, 'shipping-zones')?.fields ?? []).find(
      (field) => 'name' in field && field.name === 'methods',
    )
    const bands =
      methods && 'fields' in methods
        ? methods.fields.find((field) => 'name' in field && field.name === 'bands')
        : undefined

    const description =
      bands && 'admin' in bands
        ? (bands.admin as undefined | { description?: unknown })?.description
        : undefined

    expect(String(description)).toContain('lb')
  })
})
