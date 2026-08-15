import type { GtfsFeedIndex } from './gtfs/types'
import { findStopCandidates } from './gtfs/matchStop'
import { buildTripLegs, resolveStopChain, buildAdjacency } from './gtfs/routeShape'
import { getGtfsAdjacency } from './gtfs/loadGtfs'
import type { GeocodeProgress, GeocodedLocation, Trip } from '../types'
import { classifyPlaceType } from './classifyPlace'
import { lookupStation } from './stationLookup'

const CACHE_KEY = 'presto-map-geocode-cache-v3'
const NOMINATIM_DELAY_MS = 1100

type Cache = Record<string, GeocodedLocation>

function loadCache(): Cache {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Cache) : {}
  } catch {
    return {}
  }
}

function saveCache(cache: Cache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
}

function cacheKey(location: string, agency: string): string {
  return `${location.trim().toLowerCase()}|${agency.trim().toLowerCase()}`
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function nominatimSearch(query: string): Promise<GeocodedLocation | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'ca')
  // Bias toward the GTHA without excluding GO / 905 stops outside Toronto.
  url.searchParams.set('viewbox', '-80.15,43.20,-78.70,44.35')
  url.searchParams.set('bounded', '0')

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  })
  if (!res.ok) return null

  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>
  if (!data.length) return null

  const hit = data[0]
  return {
    location: query,
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    placeType: 'other',
    displayName: hit.display_name,
  }
}

function buildNominatimQuery(location: string, agency: string): string {
  if (/^\d{4,6}$/.test(location.trim())) {
    return `TTC bus stop ${location}, Toronto, Ontario`
  }
  if (/toronto\s*tra/i.test(agency)) {
    return `${location}, Toronto TTC, Ontario`
  }
  if (/union\s*pea/i.test(agency)) {
    return `${location}, Union Pearson Express, Toronto`
  }
  if (/go\s*transit|metrolinx/i.test(agency)) {
    return `${location}, GO Transit, Ontario`
  }
  return `${location}, Ontario, Canada`
}

function geocodeFromGtfs(
  location: string,
  agency: string,
  gtfs: GtfsFeedIndex,
): { geocoded: GeocodedLocation; stopId: string | null } | null {
  const stop = findStopCandidates(gtfs, location, agency, 1)[0]
  if (stop) {
    return {
      stopId: stop.id,
      geocoded: {
        location,
        lat: stop.lat,
        lng: stop.lon,
        placeType: classifyPlaceType(location, agency),
        displayName: stop.name,
      },
    }
  }

  const known = lookupStation(location)
  if (known) {
    return {
      stopId: null,
      geocoded: {
        location,
        lat: known.lat,
        lng: known.lng,
        placeType: known.placeType,
        displayName: known.label,
      },
    }
  }

  return null
}

export async function geocodeLocation(
  location: string,
  agency: string,
  cache: Cache,
  gtfs?: GtfsFeedIndex | null,
): Promise<GeocodedLocation | null> {
  const key = cacheKey(location, agency)

  if (gtfs) {
    const fromGtfs = geocodeFromGtfs(location, agency, gtfs)
    if (fromGtfs) {
      cache[key] = fromGtfs.geocoded
      return fromGtfs.geocoded
    }
  }

  if (cache[key]) return cache[key]

  const known = lookupStation(location)
  if (known) {
    const entry: GeocodedLocation = {
      location,
      lat: known.lat,
      lng: known.lng,
      placeType: known.placeType,
      displayName: known.label,
    }
    cache[key] = entry
    return entry
  }

  const placeType = classifyPlaceType(location, agency)
  const query = buildNominatimQuery(location, agency)
  const hit = await nominatimSearch(query)
  if (!hit) return null

  const entry: GeocodedLocation = {
    ...hit,
    location,
    placeType,
    displayName: hit.displayName.split(',').slice(0, 2).join(', '),
  }
  cache[key] = entry
  return entry
}

export function enrichTripsWithGtfs(trips: Trip[], gtfs: GtfsFeedIndex | null): Trip[] {
  return trips.map((trip) => attachGtfsAndLegs(trip, gtfs))
}

function attachGtfsAndLegs(trip: Trip, gtfs: GtfsFeedIndex | null): Trip {
  if (!gtfs) return trip

  const adj = getGtfsAdjacency() ?? buildAdjacency(gtfs)

  const candidateSets = trip.stops.map((stop) =>
    findStopCandidates(gtfs, stop.transaction.location, stop.transaction.agency).map((s) => s.id),
  )

  const resolvedIds = resolveStopChain(candidateSets, gtfs, adj)

  const stops = trip.stops.map((stop, idx) => {
    const candidates = findStopCandidates(
      gtfs,
      stop.transaction.location,
      stop.transaction.agency,
    )
    const resolvedId = resolvedIds[idx]
    const match =
      (resolvedId ? gtfs.stops[resolvedId] : null) ??
      candidates.find((c) => c.id === resolvedId) ??
      candidates[0] ??
      null

    if (match) {
      return {
        ...stop,
        gtfsStopId: match.id,
        geocoded: {
          location: stop.transaction.location,
          lat: match.lat,
          lng: match.lon,
          placeType: classifyPlaceType(stop.transaction.location, stop.transaction.agency),
          displayName: match.name,
        },
      }
    }

    const known = lookupStation(stop.transaction.location)
    if (known) {
      return {
        ...stop,
        geocoded: {
          location: stop.transaction.location,
          lat: known.lat,
          lng: known.lng,
          placeType: known.placeType,
          displayName: known.label,
        },
      }
    }

    return stop
  })

  const coords = stops.map((s) =>
    s.geocoded ? ([s.geocoded.lat, s.geocoded.lng] as [number, number]) : null,
  )
  const legs = buildTripLegs(gtfs, adj, resolvedIds, coords)

  return {
    ...trip,
    stops,
    origin: stops[0] ?? trip.origin,
    legs,
  }
}

export async function geocodeTrips(
  trips: Trip[],
  onProgress?: (progress: GeocodeProgress) => void,
  gtfs?: GtfsFeedIndex | null,
): Promise<Trip[]> {
  const cache = loadCache()
  const uniqueLocations = new Map<string, { location: string; agency: string }>()

  for (const trip of trips) {
    for (const stop of trip.stops) {
      const key = cacheKey(stop.transaction.location, stop.transaction.agency)
      if (!uniqueLocations.has(key)) {
        uniqueLocations.set(key, {
          location: stop.transaction.location,
          agency: stop.transaction.agency,
        })
      }
    }
  }

  const entries = [...uniqueLocations.values()]
  const total = entries.length

  for (let i = 0; i < entries.length; i++) {
    const { location, agency } = entries[i]
    onProgress?.({ done: i, total, current: location })

    const key = cacheKey(location, agency)
    const fromGtfs = gtfs ? geocodeFromGtfs(location, agency, gtfs) : null
    if (fromGtfs) {
      cache[key] = fromGtfs.geocoded
      continue
    }

    if (cache[key]) continue

    const known = lookupStation(location)
    if (known) {
      cache[key] = {
        location,
        lat: known.lat,
        lng: known.lng,
        placeType: known.placeType,
        displayName: known.label,
      }
      continue
    }

    if (!cache[key]) {
      await sleep(NOMINATIM_DELAY_MS)
      await geocodeLocation(location, agency, cache, gtfs)
    }
  }

  saveCache(cache)
  onProgress?.({ done: total, total })

  const geocoded = trips.map((trip) => ({
    ...trip,
    stops: trip.stops.map((stop) => {
      const key = cacheKey(stop.transaction.location, stop.transaction.agency)
      return { ...stop, geocoded: cache[key] ?? null }
    }),
    origin: {
      ...trip.origin,
      geocoded:
        cache[cacheKey(trip.origin.transaction.location, trip.origin.transaction.agency)] ?? null,
    },
  }))

  return geocoded.map((trip) => attachGtfsAndLegs(trip, gtfs ?? null))
}
