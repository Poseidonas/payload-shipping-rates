import type { WeightUnit } from './types.js'

const gramsPerWeightUnit: Record<WeightUnit, number> = {
  g: 1,
  kg: 1000,
  lb: 453.59237,
  oz: 28.349523125,
}

export const isWeightUnit = (value: unknown): value is WeightUnit =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(gramsPerWeightUnit, value)

/**
 * Converts a weight expressed in the given unit to whole grams, rounded to the
 * nearest gram. This is the same conversion payload-shipping-classes applies when
 * it stores a weight, so a band boundary entered in the same unit lines up exactly.
 */
export const weightToGrams = (value: number, unit: WeightUnit): number =>
  Math.round(value * gramsPerWeightUnit[unit])

/**
 * Converts whole grams back to the given unit, without rounding.
 */
export const gramsToWeight = (grams: number, unit: WeightUnit): number =>
  grams / gramsPerWeightUnit[unit]
