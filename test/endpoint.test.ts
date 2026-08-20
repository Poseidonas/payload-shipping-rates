import { describe, expect, it, vi } from 'vitest'

vi.mock('payload', () => ({ addDataAndFileToRequest: async () => undefined }))

const { resolveConfig } = await import('../src/config.js')
const { quoteHandler } = await import('../src/endpoint.js')

const zones = [
  {
    id: 1,
    countries: ['GB'],
    methods: [
      { amount: 490, label: 'Standard', type: 'flat' },
      { bands: [{ amount: 900, from: 0, to: 30 }], label: 'By weight', type: 'weight_bands' },
    ],
    name: 'United Kingdom',
  },
]

type FakeRequest = {
  data: Record<string, unknown>
  payload: {
    find: (args: unknown) => Promise<{ docs: unknown[] }>
    findByID: (args: unknown) => Promise<unknown>
  }
  query?: Record<string, unknown>
}

const request = (data: Record<string, unknown>, cart?: unknown): FakeRequest => ({
  data,
  payload: {
    find: async () => ({ docs: zones }),
    findByID: async () => {
      if (cart === undefined) {
        throw new Error('not found')
      }

      return cart
    },
  },
})

const call = async (data: Record<string, unknown>, cart?: unknown) => {
  const handler = quoteHandler(resolveConfig())
  const response = await handler(request(data, cart) as never)

  return { body: (await response.json()) as Record<string, unknown>, status: response.status }
}

describe('quoteHandler', () => {
  it('refuses a request with no destination country', async () => {
    const { body, status } = await call({ subtotal: 1000 })

    expect(status).toBe(400)
    expect(body.message).toBe('A destination country is required to quote shipping.')
  })

  it('quotes from the values given in the body', async () => {
    const { body, status } = await call({
      address: { country: 'GB', postalCode: 'SW1A 1AA' },
      subtotal: 2000,
      weightGrams: 1200,
    })

    expect(status).toBe(200)
    expect(body.available).toBe(true)
    expect(body.methods).toEqual([
      { amount: 490, code: 'standard', label: 'Standard', type: 'flat' },
      { amount: 900, code: 'by-weight', label: 'By weight', type: 'weight_bands' },
    ])
  })

  it('echoes the inputs it used, so the caller can see what was quoted', async () => {
    const { body } = await call({
      address: { country: 'GB' },
      currency: 'GBP',
      subtotal: 2000,
      weightGrams: 1200,
    })

    expect(body).toMatchObject({
      currency: 'GBP',
      destination: { country: 'GB', postalCode: null },
      subtotal: 2000,
      weightGrams: 1200,
    })
  })

  it('withdraws the weight method rather than costing it at zero when no weight is known', async () => {
    const { body } = await call({ address: { country: 'GB' }, subtotal: 2000 })

    expect(body.methods).toEqual([
      { amount: 490, code: 'standard', label: 'Standard', type: 'flat' },
    ])
    expect(body.unavailable).toEqual([
      { code: 'by-weight', label: 'By weight', reason: 'weight_unknown', type: 'weight_bands' },
    ])
  })

  it('says explicitly when no zone covers the destination', async () => {
    const { body, status } = await call({ address: { country: 'FR' }, subtotal: 2000 })

    expect(status).toBe(200)
    expect(body).toMatchObject({ available: false, reason: 'no_matching_zone', zone: null })
    expect(body.methods).toEqual([])
  })

  it('reads the subtotal, currency, weight and classes from a cart', async () => {
    const cart = {
      currency: 'GBP',
      items: [{ product: { weightGrams: 600, shippingClass: { slug: 'bulky' } }, quantity: 2 }],
      subtotal: 3000,
    }
    const { body } = await call({ address: { country: 'GB' }, cartID: 'cart-1' }, cart)

    expect(body).toMatchObject({
      currency: 'GBP',
      shippingClasses: ['bulky'],
      subtotal: 3000,
      weightGrams: 1200,
    })
  })

  it('lets the body override what the cart says', async () => {
    const cart = { currency: 'GBP', items: [{ product: { weightGrams: 600 } }], subtotal: 3000 }
    const { body } = await call(
      { address: { country: 'GB' }, cartID: 'cart-1', subtotal: 9999, weightGrams: 10 },
      cart,
    )

    expect(body).toMatchObject({ subtotal: 9999, weightGrams: 10 })
  })

  it('returns 404 when the cart cannot be read', async () => {
    const { body, status } = await call({ address: { country: 'GB' }, cartID: 'missing' })

    expect(status).toBe(404)
    expect(body.message).toBe('Cart with ID missing not found.')
  })

  it('puts the cart secret on the query, the way the official plugin does', async () => {
    const config = resolveConfig()
    const req = request({ address: { country: 'GB' }, cartID: 'c1', secret: 's3cret' }, { items: [] })

    await quoteHandler(config)(req as never)

    expect(req.query?.secret).toBe('s3cret')
  })

  it('quotes on price alone when nothing carries a weight', async () => {
    const { body } = await call(
      { address: { country: 'GB' }, cartID: 'cart-1' },
      { currency: 'GBP', items: [{ product: { title: 'Gift card' }, quantity: 1 }], subtotal: 2500 },
    )

    expect(body.weightGrams).toBeNull()
    expect(body.methods).toEqual([
      { amount: 490, code: 'standard', label: 'Standard', type: 'flat' },
    ])
  })
})
