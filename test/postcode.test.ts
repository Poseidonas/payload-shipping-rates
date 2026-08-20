import { describe, expect, it } from 'vitest'

import { matchesAnyPostcode, matchesPostcode, normalisePostcode } from '../src/postcode.js'

describe('normalisePostcode', () => {
  it('uppercases and strips spaces and punctuation', () => {
    expect(normalisePostcode('sw1a 1aa')).toBe('SW1A1AA')
    expect(normalisePostcode('105-62')).toBe('10562')
  })

  it('returns an empty string for anything that is not a string', () => {
    expect(normalisePostcode(undefined)).toBe('')
    expect(normalisePostcode(10562)).toBe('')
  })
})

describe('matchesPostcode, exact', () => {
  it('matches regardless of case and spacing', () => {
    expect(matchesPostcode('SW1A 1AA', normalisePostcode('sw1a1aa'))).toBe(true)
  })

  it('refuses a different postcode', () => {
    expect(matchesPostcode('SW1A1AA', normalisePostcode('SW1A 2AB'))).toBe(false)
  })

  it('refuses a prefix when no wildcard was given', () => {
    expect(matchesPostcode('SW1A', normalisePostcode('SW1A 1AA'))).toBe(false)
  })
})

describe('matchesPostcode, prefix wildcard', () => {
  it('matches every postcode starting with the prefix', () => {
    expect(matchesPostcode('SW1*', normalisePostcode('SW1A 1AA'))).toBe(true)
    expect(matchesPostcode('SW1*', normalisePostcode('SW19 4TP'))).toBe(true)
  })

  it('refuses a postcode outside the prefix', () => {
    expect(matchesPostcode('SW1*', normalisePostcode('SE1 9GF'))).toBe(false)
  })

  it('matches the prefix itself', () => {
    expect(matchesPostcode('SW1*', normalisePostcode('SW1'))).toBe(true)
  })

  it('treats a bare asterisk as matching everything, including an empty postcode', () => {
    expect(matchesPostcode('*', normalisePostcode('ANYTHING'))).toBe(true)
    expect(matchesPostcode('*', '')).toBe(true)
  })
})

describe('matchesPostcode, numeric range', () => {
  it('includes both ends of the range', () => {
    expect(matchesPostcode('1000...1999', '1000')).toBe(true)
    expect(matchesPostcode('1000...1999', '1999')).toBe(true)
  })

  it('excludes values outside the range', () => {
    expect(matchesPostcode('1000...1999', '999')).toBe(false)
    expect(matchesPostcode('1000...1999', '2000')).toBe(false)
  })

  it('compares as numbers, not as strings', () => {
    expect(matchesPostcode('900...1100', '1000')).toBe(true)
  })

  it('refuses to apply a range to a postcode that is not all digits', () => {
    expect(matchesPostcode('1000...1999', normalisePostcode('SW1A 1AA'))).toBe(false)
  })

  it('refuses a range whose ends are not both numeric', () => {
    expect(matchesPostcode('AB...1999', '1500')).toBe(false)
  })

  it('handles a range of one value', () => {
    expect(matchesPostcode('1500...1500', '1500')).toBe(true)
    expect(matchesPostcode('1500...1500', '1501')).toBe(false)
  })
})

describe('matchesPostcode, edge cases', () => {
  it('refuses an empty pattern', () => {
    expect(matchesPostcode('', 'SW1A1AA')).toBe(false)
    expect(matchesPostcode('   ', 'SW1A1AA')).toBe(false)
  })

  it('refuses an exact pattern against an empty postcode', () => {
    expect(matchesPostcode('SW1A1AA', '')).toBe(false)
  })
})

describe('matchesAnyPostcode', () => {
  it('is true when one pattern of several matches', () => {
    expect(matchesAnyPostcode(['SE1*', 'SW1*'], normalisePostcode('SW1A 1AA'))).toBe(true)
  })

  it('is false when none matches', () => {
    expect(matchesAnyPostcode(['SE1*', 'N1*'], normalisePostcode('SW1A 1AA'))).toBe(false)
  })

  it('ignores entries that are not strings', () => {
    expect(matchesAnyPostcode([null, undefined, 'SW1*'], normalisePostcode('SW1A 1AA'))).toBe(true)
  })

  it('is false for an empty list', () => {
    expect(matchesAnyPostcode([], 'SW1A1AA')).toBe(false)
  })
})
