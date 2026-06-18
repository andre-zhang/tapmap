import type { PlaceType } from '../types'
import { isKnownSubwayStation, isKnownTrainStation } from './stationLookup'

const SUBWAY_AGENCY = /toronto\s*tra/i
const TRAIN_AGENCY = /union\s*pea|go\s*transit|metrolinx/i

export function classifyPlaceType(location: string, agency: string): PlaceType {
  const trimmed = location.trim()
  if (!trimmed) return 'other'

  if (/^\d{4,6}$/.test(trimmed)) return 'bus_stop'

  if (isKnownTrainStation(trimmed) || TRAIN_AGENCY.test(agency)) {
    if (isKnownTrainStation(trimmed) || /pearson|mount\s*der|union/i.test(trimmed)) {
      return 'train_station'
    }
  }

  if (isKnownSubwayStation(trimmed) || (SUBWAY_AGENCY.test(agency) && /^[A-Z][A-Z0-9\s]{2,}$/.test(trimmed))) {
    return 'subway_station'
  }

  if (/\b(loop|carhouse)\b/i.test(trimmed)) return 'streetcar_stop'

  if (/\bat\b|&|\/|intersection/i.test(trimmed)) return 'intersection'

  if (/\b(st|street|ave|avenue|rd|road|blvd|dr|drive|way|cres|crescent)\b/i.test(trimmed)) {
    return /loop/i.test(trimmed) ? 'streetcar_stop' : 'intersection'
  }

  if (SUBWAY_AGENCY.test(agency) && /stati?on?$/i.test(trimmed)) return 'subway_station'

  return 'other'
}
