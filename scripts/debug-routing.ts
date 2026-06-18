import { readFileSync } from 'fs'
import { buildTrips } from '../src/lib/buildTrips'
import { enrichTripsWithGtfs } from '../src/lib/geocode'
import { buildTokenIndex } from '../src/lib/gtfs/matchStop'
import { parsePrestoCsv } from '../src/lib/parsePrestoCsv'
import type { GtfsFeedIndex } from '../src/lib/gtfs/types'

const idx = JSON.parse(readFileSync('public/gtfs/ttc-index.json', 'utf8')) as GtfsFeedIndex
idx.tokenIndex = buildTokenIndex(idx)

const csv = readFileSync('public/sample-presto.csv', 'utf8')
const trips = buildTrips(parsePrestoCsv(csv))
const enriched = enrichTripsWithGtfs(trips, idx)

for (const t of enriched) {
  const matched = t.legs?.filter((l) => l.shapeMatched).length ?? 0
  const total = t.legs?.length ?? 0
  console.log(
    t.date,
    '|',
    t.stops.map((s) => s.geocoded?.displayName?.slice(0, 28)).join(' → '),
    '|',
    `${matched}/${total} shaped`,
    '|',
    t.legs?.map((l) => `${l.shapeMatched ? 'S' : '-'}(${l.positions.length}pts)`).join(' '),
  )
}
