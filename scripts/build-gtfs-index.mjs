import AdmZip from 'adm-zip'
import { parse } from 'csv-parse'
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const GTFS_DATA = join(ROOT, 'gtfs-data')
const GTFS_ZIP = join(GTFS_DATA, 'ttc.zip')
const GTFS_DIR = join(GTFS_DATA, 'ttc')
const OUT_DIR = join(ROOT, 'public', 'gtfs')
const OUT_FILE = join(OUT_DIR, 'ttc-index.json')

const TTC_GTFS_URL =
  'https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/7795b45e-e65a-4465-81fc-c36b9dfff169/resource/cfb6b2b8-6191-41e3-bda1-b175c51148cb/download/TTC%20Routes%20and%20Schedules%20Data.zip'

function normalizeStopName(name) {
  return name
    .toUpperCase()
    .replace(/\bSTN\b/g, 'STATION')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function stationClusterKey(stopName) {
  if (/ - /i.test(stopName)) {
    const [left, ...rest] = stopName.split(' - ')
    const right = rest.join(' - ')
    if (/platform|towards/i.test(right) && /station/i.test(left)) {
      return normalizeStopName(left)
    }
    const stationInRight = right.match(/([A-Za-z\s]+Station)/i)
    if (stationInRight) return normalizeStopName(stationInRight[1])
  }
  if (/\bStation\b/i.test(stopName) && !/\bat\b/i.test(stopName)) {
    return normalizeStopName(stopName.split(' - ')[0])
  }
  return `loc:${stopName.trim().toUpperCase()}`
}

async function downloadGtfs() {
  if (existsSync(GTFS_ZIP)) {
    console.log('Using existing', GTFS_ZIP)
    return
  }
  mkdirSync(GTFS_DATA, { recursive: true })
  console.log('Downloading TTC GTFS…')
  const res = await fetch(TTC_GTFS_URL)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(GTFS_ZIP, buf)
  console.log(`Saved ${(buf.length / 1e6).toFixed(1)} MB`)
}

function extractGtfs() {
  if (existsSync(join(GTFS_DIR, 'stops.txt'))) {
    console.log('Using extracted GTFS at', GTFS_DIR)
    return
  }
  mkdirSync(GTFS_DIR, { recursive: true })
  console.log('Extracting GTFS zip…')
  const zip = new AdmZip(GTFS_ZIP)
  zip.extractAllTo(GTFS_DIR, true)
}

async function parseCsvFile(filePath) {
  const records = []
  const parser = createReadStream(filePath).pipe(
    parse({ columns: true, skip_empty_lines: true, relax_column_count: true }),
  )
  for await (const row of parser) records.push(row)
  return records
}

async function parseShapes(filePath) {
  const shapes = new Map()
  const parser = createReadStream(filePath).pipe(
    parse({ columns: true, skip_empty_lines: true }),
  )
  for await (const row of parser) {
    const id = row.shape_id
    if (!shapes.has(id)) shapes.set(id, [])
    shapes.get(id).push({
      lat: Number(row.shape_pt_lat),
      lon: Number(row.shape_pt_lon),
      dist: Number(row.shape_dist_traveled),
    })
  }
  return shapes
}

async function parseTrips(filePath) {
  const trips = new Map()
  const parser = createReadStream(filePath).pipe(
    parse({ columns: true, skip_empty_lines: true }),
  )
  for await (const row of parser) {
    trips.set(row.trip_id, {
      routeId: row.route_id,
      shapeId: row.shape_id || null,
    })
  }
  return trips
}

async function parseRoutes(filePath) {
  const routes = new Map()
  const parser = createReadStream(filePath).pipe(
    parse({ columns: true, skip_empty_lines: true }),
  )
  for await (const row of parser) {
    routes.set(row.route_id, {
      shortName: row.route_short_name || '',
      longName: row.route_long_name || '',
    })
  }
  return routes
}

/** Stream stop_times.txt (large) and build segment index. */
async function buildSegments(stopTimesPath, trips, routes) {
  const segments = new Map()
  const parser = createReadStream(stopTimesPath).pipe(
    parse({ columns: true, skip_empty_lines: true, relax_column_count: true }),
  )

  let currentTripId = null
  let currentStops = []

  const flushTrip = () => {
    if (currentStops.length < 2) return
    const trip = trips.get(currentTripId)
    if (!trip?.shapeId) return
    const route = routes.get(trip.routeId)
    const routeName = route?.shortName || route?.longName || trip.routeId

    for (let i = 0; i < currentStops.length - 1; i++) {
      const a = currentStops[i]
      const b = currentStops[i + 1]
      const key = `${a.stopId}|${b.stopId}`
      const d0 = a.dist
      const d1 = b.dist
      if (d0 == null || d1 == null || !Number.isFinite(d0) || !Number.isFinite(d1)) continue

      const existing = segments.get(key)
      const span = Math.abs(d1 - d0)
      if (!existing || span < existing.span) {
        segments.set(key, {
          shapeId: trip.shapeId,
          d0: Math.min(d0, d1),
          d1: Math.max(d0, d1),
          routeName,
          span,
        })
      }
    }
  }

  for await (const row of parser) {
    const tripId = row.trip_id
    if (tripId !== currentTripId) {
      flushTrip()
      currentTripId = tripId
      currentStops = []
    }
    const dist = row.shape_dist_traveled ? Number(row.shape_dist_traveled) : null
    currentStops.push({ stopId: row.stop_id, dist })
  }
  flushTrip()

  const out = {}
  for (const [key, seg] of segments) {
    out[key] = {
      s: seg.shapeId,
      d0: Math.round(seg.d0 * 10) / 10,
      d1: Math.round(seg.d1 * 10) / 10,
      r: seg.routeName,
    }
  }
  return out
}

async function main() {
  const skipDownload = process.argv.includes('--skip-download')
  if (!skipDownload) await downloadGtfs()
  if (!existsSync(GTFS_ZIP) && !existsSync(join(GTFS_DIR, 'stops.txt'))) {
    console.error('No GTFS data found. Run without --skip-download or place files in gtfs-data/ttc/')
    process.exit(1)
  }
  if (existsSync(GTFS_ZIP)) extractGtfs()

  console.log('Parsing stops…')
  const stopRows = await parseCsvFile(join(GTFS_DIR, 'stops.txt'))
  const stops = stopRows.map((row) => ({
    id: row.stop_id,
    name: row.stop_name,
    code: row.stop_code || '',
    lat: Number(row.stop_lat),
    lon: Number(row.stop_lon),
    norm: normalizeStopName(row.stop_name),
  }))

  const nameIndex = {}
  const codeIndex = {}
  const clusterMembers = {}
  for (const stop of stops) {
    if (!nameIndex[stop.norm]) nameIndex[stop.norm] = []
    nameIndex[stop.norm].push(stop.id)
    if (stop.code) codeIndex[stop.code] = stop.id

    const cluster = stationClusterKey(stop.name)
    if (!clusterMembers[cluster]) clusterMembers[cluster] = []
    clusterMembers[cluster].push(stop.id)
  }

  const stopClusters = {}
  for (const stop of stops) {
    const cluster = stationClusterKey(stop.name)
    stopClusters[stop.id] = clusterMembers[cluster] ?? [stop.id]
  }

  console.log('Parsing shapes…')
  const shapeMap = await parseShapes(join(GTFS_DIR, 'shapes.txt'))
  const shapes = {}
  for (const [id, pts] of shapeMap) {
    shapes[id] = pts.map((p) => [
      Math.round(p.lat * 1e5) / 1e5,
      Math.round(p.lon * 1e5) / 1e5,
      Math.round(p.dist * 10) / 10,
    ])
  }

  console.log('Parsing trips & routes…')
  const trips = await parseTrips(join(GTFS_DIR, 'trips.txt'))
  const routes = await parseRoutes(join(GTFS_DIR, 'routes.txt'))

  console.log('Building segment index from stop_times (this may take a minute)…')
  const segments = await buildSegments(join(GTFS_DIR, 'stop_times.txt'), trips, routes)

  const stopById = Object.fromEntries(stops.map((s) => [s.id, s]))

  const index = {
    version: 2,
    agency: 'TTC',
    builtAt: new Date().toISOString(),
    stops: stopById,
    nameIndex,
    codeIndex,
    stopClusters,
    shapes,
    segments,
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(index))
  const sizeMb = (JSON.stringify(index).length / 1e6).toFixed(1)
  console.log(`Wrote ${OUT_FILE} (${sizeMb} MB, ${stops.length} stops, ${Object.keys(segments).length} segments)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
