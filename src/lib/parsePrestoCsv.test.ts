import { describe, expect, it } from 'vitest'
import { parsePrestoCsv, parsePrestoDate, PrestoCsvError } from './parsePrestoCsv'

const SAMPLE = `Date,,Sequence,Agency,Location,Transaction Type
17 June 2024,,0,Toronto Transit Commission,Union Station,Fare Payment
17 June 2024,,1,Toronto Transit Commission,DUFFERIN,Free Transfer
1 June 2024,,2,PRESTO System,,Load Amount
`

const OFFICIAL = `"Date","Transit Agency","Location","Type ","Service Class","Discount","Amount","Balance"
"11/2/2018 11:31:00 AM","Go Transit","Exhibition GO Station Rail","Fare Payment","","$0.00","$5.30","$24.70"
"11/2/2018 11:44:00 AM","Go Transit","Union Station Rail","Fare Payment","","$0.59","($0.59)","$25.29"
"11/2/2018 11:48:05 AM","Toronto Transit Commission","UNION STATION","Fare Payment","Regular","$0.00","$1.50","$23.79"
"11/2/2018 12:10:00 PM","PRESTO System","","Load Amount","","$0.00","$20.00","$43.79"
`

describe('parsePrestoDate', () => {
  it('parses day-month-year sample dates without a timestamp', () => {
    const parsed = parsePrestoDate('17 June 2024')
    expect(parsed?.iso).toBe('2024-06-17')
    expect(parsed?.timestamp).toBeNull()
  })

  it('parses official PRESTO US datetimes', () => {
    const parsed = parsePrestoDate('11/2/2018 11:31:00 AM')
    expect(parsed?.iso).toBe('2018-11-02')
    expect(parsed?.timestamp).toBeTypeOf('number')
  })

  it('parses ISO dates', () => {
    expect(parsePrestoDate('2024-06-17')?.iso).toBe('2024-06-17')
  })
})

describe('parsePrestoCsv', () => {
  it('parses the bundled sample format', () => {
    const rows = parsePrestoCsv(SAMPLE)
    expect(rows).toHaveLength(2)
    expect(rows[0].location).toBe('Union Station')
    expect(rows[1].transactionType).toBe('Free Transfer')
  })

  it('parses official prestocard.ca transaction history', () => {
    const rows = parsePrestoCsv(OFFICIAL)
    expect(rows.map((r) => r.location)).toEqual([
      'Exhibition GO Station Rail',
      'Union Station Rail',
      'UNION STATION',
    ])
    expect(rows[0].agency).toBe('Go Transit')
    expect(rows[0].timestamp).toBeTypeOf('number')
    expect(rows[2].timestamp).toBeGreaterThan(rows[0].timestamp ?? 0)
  })

  it('strips a UTF-8 BOM', () => {
    const rows = parsePrestoCsv(`\uFEFF${SAMPLE}`)
    expect(rows).toHaveLength(2)
  })

  it('rejects a Transit Usage Report without locations', () => {
    const csv = `Date,Transit Agency,Type,Amount
2017-01-01,Toronto Transit Commission,Fare Payment,-3
`
    expect(() => parsePrestoCsv(csv)).toThrow(PrestoCsvError)
  })
})
