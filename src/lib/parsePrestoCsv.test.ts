import { describe, expect, it } from 'vitest'
import { buildTrips } from './buildTrips'
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

const CURRENT_PRESTO = `Date,Sequence Number,Service Provider Name,Location,Type,Discount Sum,Amount,Balance
"30 July 2026 11:43 a.m.","0","GO Transit","Union Station Rail","Tap Off","5.76","-$0.27","$12.53"
"30 July 2026 11:08 a.m.","1","GO Transit","Guildwood GO Station Rail","Tap On","0","$0.66","$12.26"
"30 July 2026 10:51 a.m.","2","Toronto Transit Commission","Military Trail at Morningside Ave","Fare Payment","0","$3.30","$12.92"
"17 July 2026 07:07 p.m.","0","Union Pearson Express","Union Station","Tap Off","0","$0.00","$16.22"
"17 July 2026 06:32 p.m.","1","Union Pearson Express","Pearson Station","Tap On","0","$7.41","$16.22"
"17 July 2026 01:42 p.m.","2","Union Pearson Express","Pearson Station","Tap Off","0","-$0.09","$23.63"
"17 July 2026 01:18 p.m.","3","Union Pearson Express","Mount Dennis Station","Tap On","0","$3.39","$23.54"
"17 July 2026 01:17 p.m.","4","PRESTO System","","Load Amount","0","$25.00","$26.93"
"10 July 2026 02:34 p.m.","0","Toronto Transit Commission","Eglinton Ave East at Laird Dr East Side","Free Transfer","0","","$1.93"
"10 July 2026 02:13 p.m.","1","Toronto Transit Commission","EGLINTON STATION","Free Transfer","0","","$1.93"
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

  it('parses current PRESTO a.m./p.m. timestamps', () => {
    const morning = parsePrestoDate('30 July 2026 11:43 a.m.')
    expect(morning?.iso).toBe('2026-07-30')
    expect(morning?.timestamp).toBeTypeOf('number')
    const evening = parsePrestoDate('17 July 2026 07:07 p.m.')
    expect(evening?.iso).toBe('2026-07-17')
    expect(new Date(evening!.timestamp!).getHours()).toBe(19)
    expect(new Date(morning!.timestamp!).getHours()).toBe(11)
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

  it('parses current prestocard.ca Transaction History exports', () => {
    const rows = parsePrestoCsv(CURRENT_PRESTO)
    expect(rows.map((r) => r.location)).toEqual([
      'EGLINTON STATION',
      'Eglinton Ave East at Laird Dr East Side',
      'Mount Dennis Station',
      'Pearson Station',
      'Pearson Station',
      'Union Station',
      'Military Trail at Morningside Ave',
      'Guildwood GO Station Rail',
      'Union Station Rail',
    ])
    expect(rows[0].agency).toBe('Toronto Transit Commission')
    expect(rows.find((r) => r.location === 'Guildwood GO Station Rail')?.agency).toBe('GO Transit')
    expect(rows.find((r) => r.location === 'Pearson Station')?.agency).toBe('Union Pearson Express')
    expect(rows.find((r) => r.location === 'Union Station Rail')?.timestamp).toBeTypeOf('number')
    expect(rows.some((r) => r.transactionType === 'Load Amount')).toBe(false)

    const trips = buildTrips(rows)
    expect(trips.filter((t) => t.date === '2026-07-30')).toHaveLength(1)
    expect(trips.find((t) => t.date === '2026-07-30')?.stops).toHaveLength(3)
  })
})
