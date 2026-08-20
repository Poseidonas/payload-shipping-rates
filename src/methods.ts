import type { ShippingMethodType, WeightUnit } from './types.js'
import type { ShippingBandInput, ShippingMethodInput } from './zones.js'

import { weightToGrams } from './units.js'

/**
 * Why a configured method is not on offer for this cart.
 *
 * - `below_threshold` a free over method whose threshold the subtotal has not reached
 * - `class_excluded` the cart contains a shipping class the method refuses
 * - `misconfigured` the method is missing a value it cannot work without
 * - `no_band` no band covers the cart
 * - `subtotal_unknown` the caller supplied no subtotal and the method needs one
 * - `weight_unknown` the caller supplied no weight and the method needs one
 */
export type UnavailableReason =
  | 'below_threshold'
  | 'class_excluded'
  | 'misconfigured'
  | 'no_band'
  | 'subtotal_unknown'
  | 'weight_unknown'

export type QuotedMethod = {
  /** Cost in integer minor units of the cart currency. */
  amount: number
  code: string
  label: string
  type: ShippingMethodType
}

export type UnavailableMethod = {
  code: string
  label: string
  reason: UnavailableReason
  type: null | ShippingMethodType
}

export type MethodContext = {
  shippingClasses: string[]
  subtotal: null | number
  weightGrams: null | number
  weightUnit: WeightUnit
}

type Band = {
  amount: number
  from: number
  to: null | number
}

const methodTypes: ShippingMethodType[] = [
  'flat',
  'free_over',
  'local_pickup',
  'price_bands',
  'weight_bands',
]

const isMethodType = (value: unknown): value is ShippingMethodType =>
  typeof value === 'string' && methodTypes.includes(value as ShippingMethodType)

const minorUnits = (value: unknown): null | number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null

export const slugify = (value: string): string =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * The identifier a method is referred to by. An explicit `code` wins; otherwise
 * the label is slugified; otherwise the position in the zone is used. Duplicates
 * are suffixed with the position, so a zone never offers two methods under the
 * same code.
 */
export const methodCode = (method: ShippingMethodInput, index: number, taken: Set<string>): string => {
  const explicit = typeof method.code === 'string' ? slugify(method.code) : ''
  const fromLabel = typeof method.label === 'string' ? slugify(method.label) : ''
  const base = explicit || fromLabel || `method-${index + 1}`
  const code = taken.has(base) ? `${base}-${index + 1}` : base

  taken.add(code)

  return code
}

export const methodLabel = (method: ShippingMethodInput, code: string): string =>
  typeof method.label === 'string' && method.label.trim() !== '' ? method.label.trim() : code

const toBands = (
  input: (null | ShippingBandInput)[] | null | undefined,
  toBoundary: (value: number) => number,
): Band[] => {
  const bands: Band[] = []

  for (const band of input ?? []) {
    if (!band) {
      continue
    }

    const amount = minorUnits(band.amount)

    if (amount === null) {
      continue
    }

    const rawFrom = typeof band.from === 'number' && Number.isFinite(band.from) ? band.from : 0
    const rawTo = typeof band.to === 'number' && Number.isFinite(band.to) ? band.to : null

    if (rawFrom < 0 || (rawTo !== null && rawTo < 0)) {
      continue
    }

    const from = toBoundary(rawFrom)
    const to = rawTo === null ? null : toBoundary(rawTo)

    if (to !== null && to <= from) {
      continue
    }

    bands.push({ amount, from, to })
  }

  return bands.sort((left, right) => left.from - right.from)
}

/**
 * The first band that covers the value, treating each band as `from` inclusive
 * and `to` exclusive. A band with no `to` is unbounded above.
 */
export const bandFor = (bands: Band[], value: number): Band | undefined =>
  bands.find((band) => value >= band.from && (band.to === null || value < band.to))

const excluded = (method: ShippingMethodInput, shippingClasses: string[]): boolean => {
  const list = (method.excludedShippingClasses ?? [])
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
    .map((entry) => entry.trim())

  return list.some((entry) => shippingClasses.includes(entry))
}

const evaluate = (
  method: ShippingMethodInput,
  context: MethodContext,
): { amount: number } | { reason: UnavailableReason } => {
  const type = method.type

  if (!isMethodType(type)) {
    return { reason: 'misconfigured' }
  }

  if (excluded(method, context.shippingClasses)) {
    return { reason: 'class_excluded' }
  }

  const amount = minorUnits(method.amount)

  if (type === 'flat') {
    return amount === null ? { reason: 'misconfigured' } : { amount }
  }

  if (type === 'local_pickup') {
    return { amount: amount ?? 0 }
  }

  if (type === 'free_over') {
    const threshold = minorUnits(method.threshold)

    if (threshold === null) {
      return { reason: 'misconfigured' }
    }

    if (context.subtotal === null) {
      return { reason: 'subtotal_unknown' }
    }

    return context.subtotal >= threshold ? { amount: 0 } : { reason: 'below_threshold' }
  }

  if (type === 'price_bands') {
    const bands = toBands(method.bands, (value) => Math.round(value))

    if (bands.length === 0) {
      return { reason: 'misconfigured' }
    }

    if (context.subtotal === null) {
      return { reason: 'subtotal_unknown' }
    }

    const band = bandFor(bands, context.subtotal)

    return band ? { amount: band.amount } : { reason: 'no_band' }
  }

  const bands = toBands(method.bands, (value) => weightToGrams(value, context.weightUnit))

  if (bands.length === 0) {
    return { reason: 'misconfigured' }
  }

  if (context.weightGrams === null) {
    return { reason: 'weight_unknown' }
  }

  const band = bandFor(bands, context.weightGrams)

  return band ? { amount: band.amount } : { reason: 'no_band' }
}

/**
 * Costs every method of one zone. Available methods come back cheapest first,
 * ties broken by the order the methods are declared in. A method that cannot be
 * costed is never given a cost of zero: it is listed as unavailable with a reason.
 */
export const quoteMethods = (
  methods: (null | ShippingMethodInput)[],
  context: MethodContext,
): { available: QuotedMethod[]; unavailable: UnavailableMethod[] } => {
  const taken = new Set<string>()
  const available: { method: QuotedMethod; position: number }[] = []
  const unavailable: UnavailableMethod[] = []

  methods.forEach((method, index) => {
    if (!method) {
      return
    }

    const code = methodCode(method, index, taken)
    const label = methodLabel(method, code)
    const outcome = evaluate(method, context)

    if ('reason' in outcome) {
      unavailable.push({
        code,
        label,
        reason: outcome.reason,
        type: isMethodType(method.type) ? method.type : null,
      })

      return
    }

    available.push({
      method: { amount: outcome.amount, code, label, type: method.type as ShippingMethodType },
      position: index,
    })
  })

  return {
    available: available
      .sort((left, right) =>
        left.method.amount === right.method.amount
          ? left.position - right.position
          : left.method.amount - right.method.amount,
      )
      .map((entry) => entry.method),
    unavailable,
  }
}
