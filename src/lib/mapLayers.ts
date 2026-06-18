import type { LatLngTuple } from './gtfs/types'
import type { Trip } from '../types'
import { PLACE_TYPE_COLORS } from '../types'

export type MapLine = {
  id: string
  positions: LatLngTuple[]
  color: string
  dashed: boolean
}

export type StopVisit = {
  dateLabel: string
  transactionType: string
  tripId: string
  isOrigin: boolean
}

export type MapStopCluster = {
  key: string
  lat: number
  lng: number
  displayName: string
  visits: number
  originCount: number
  color: string
  events: StopVisit[]
}

function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

export function buildMapLayers(trips: Trip[]): { lines: MapLine[]; stops: MapStopCluster[] } {
  const lines: MapLine[] = []
  const stopMap = new Map<string, MapStopCluster>()

  for (const trip of trips) {
    const color = PLACE_TYPE_COLORS[trip.originPlaceType]

    if (trip.legs?.length) {
      for (let i = 0; i < trip.legs.length; i++) {
        const leg = trip.legs[i]
        if (leg.positions.length < 2) continue
        lines.push({
          id: `${trip.id}-leg-${i}`,
          positions: leg.positions,
          color,
          dashed: !leg.shapeMatched,
        })
      }
    } else {
      const coords = trip.stops
        .filter((s) => s.geocoded)
        .map((s) => [s.geocoded!.lat, s.geocoded!.lng] as LatLngTuple)
      if (coords.length >= 2) {
        lines.push({
          id: `${trip.id}-fallback`,
          positions: coords,
          color,
          dashed: true,
        })
      }
    }

    for (let i = 0; i < trip.stops.length; i++) {
      const stop = trip.stops[i]
      if (!stop.geocoded) continue

      const key = stop.gtfsStopId ?? coordKey(stop.geocoded.lat, stop.geocoded.lng)
      const existing = stopMap.get(key)
      const event: StopVisit = {
        dateLabel: stop.transaction.dateLabel,
        transactionType: stop.transaction.transactionType,
        tripId: trip.id,
        isOrigin: i === 0,
      }

      if (existing) {
        existing.visits += 1
        if (i === 0) existing.originCount += 1
        existing.events.push(event)
      } else {
        stopMap.set(key, {
          key,
          lat: stop.geocoded.lat,
          lng: stop.geocoded.lng,
          displayName: stop.geocoded.displayName,
          visits: 1,
          originCount: i === 0 ? 1 : 0,
          color: i === 0 ? color : '#fff200',
          events: [event],
        })
      }
    }
  }

  return {
    lines,
    stops: [...stopMap.values()].sort((a, b) => b.visits - a.visits),
  }
}

export function stopMarkerRadius(cluster: MapStopCluster, zoom: number): number {
  const base = cluster.originCount > 0 ? 7 : 5
  const scale = cluster.visits > 1 ? Math.min(4, Math.log2(cluster.visits)) : 0
  const zoomBoost = zoom >= 14 ? 1.5 : zoom >= 12 ? 1 : 0.75
  return (base + scale) * zoomBoost
}

export function shouldShowStop(cluster: MapStopCluster, zoom: number, totalStops: number): boolean {
  if (zoom >= 13) return true
  if (totalStops <= 40) return true
  return cluster.visits >= 2 || cluster.originCount > 0
}
