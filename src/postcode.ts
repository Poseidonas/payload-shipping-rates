const rangeSeparator = '...'

/**
 * Strips everything that is not a letter or a digit and uppercases the rest, so
 * that `sw1a 1aa`, `SW1A-1AA` and `SW1A1AA` are the same postcode.
 */
export const normalisePostcode = (value: unknown): string =>
  typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '') : ''

const normalisePattern = (value: string): string =>
  value.toUpperCase().replace(/[^A-Z0-9*.]/g, '')

const isDigits = (value: string): boolean => value !== '' && /^[0-9]+$/.test(value)

/**
 * Matches one postcode pattern against an already normalised postcode.
 *
 * Three forms are understood, in this order:
 * 1. a numeric range, `1000...1999`, inclusive at both ends, which applies only
 *    when the postcode itself is all digits
 * 2. a prefix wildcard, `SW1*`, which matches any postcode starting with `SW1`
 * 3. an exact match
 *
 * A bare `*` is a prefix wildcard with an empty prefix, so it matches everything,
 * including an empty postcode.
 */
export const matchesPostcode = (pattern: string, postcode: string): boolean => {
  const cleaned = normalisePattern(pattern)

  if (cleaned === '') {
    return false
  }

  if (cleaned.includes(rangeSeparator)) {
    const parts = cleaned.split(rangeSeparator)
    const from = parts[0] ?? ''
    const to = parts[1] ?? ''

    if (parts.length !== 2 || !isDigits(from) || !isDigits(to) || !isDigits(postcode)) {
      return false
    }

    const value = Number(postcode)

    return value >= Number(from) && value <= Number(to)
  }

  if (cleaned.endsWith('*')) {
    return postcode.startsWith(cleaned.slice(0, -1))
  }

  return cleaned === postcode
}

/**
 * True when at least one pattern in the list matches the postcode.
 */
export const matchesAnyPostcode = (
  patterns: (null | string | undefined)[],
  postcode: string,
): boolean =>
  patterns.some(
    (pattern) => typeof pattern === 'string' && matchesPostcode(pattern, postcode),
  )
