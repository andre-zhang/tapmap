import type { PlaceType } from '../types'

type StationEntry = { lat: number; lng: number; label: string; placeType: PlaceType }

/** Normalized keys → coordinates for GTA transit locations. */
const STATIONS: Record<string, StationEntry> = {
  'union station': { lat: 43.6452, lng: -79.3806, label: 'Union Station', placeType: 'subway_station' },
  'union stat': { lat: 43.6452, lng: -79.3806, label: 'Union Station', placeType: 'subway_station' },
  dufferin: { lat: 43.6553, lng: -79.4359, label: 'Dufferin Station', placeType: 'subway_station' },
  'old mill': { lat: 43.6488, lng: -79.4758, label: 'Old Mill Station', placeType: 'subway_station' },
  'bloor station': { lat: 43.6514, lng: -79.3792, label: 'Bloor–Yonge Station', placeType: 'subway_station' },
  'bloor stati': { lat: 43.6514, lng: -79.3792, label: 'Bloor–Yonge Station', placeType: 'subway_station' },
  'tmu station': { lat: 43.6571, lng: -79.3798, label: 'TMU Station', placeType: 'subway_station' },
  'tmu stati': { lat: 43.6571, lng: -79.3798, label: 'TMU Station', placeType: 'subway_station' },
  'dundas station': { lat: 43.6571, lng: -79.3798, label: 'TMU Station', placeType: 'subway_station' },
  pape: { lat: 43.676, lng: -79.3525, label: 'Pape Station', placeType: 'subway_station' },
  'pape ave': { lat: 43.676, lng: -79.3525, label: 'Pape Station', placeType: 'subway_station' },
  'pape ave a': { lat: 43.676, lng: -79.3525, label: 'Pape Station', placeType: 'subway_station' },
  stclair: { lat: 43.6887, lng: -79.3922, label: 'St. Clair Station', placeType: 'subway_station' },
  'st clair': { lat: 43.6887, lng: -79.3922, label: 'St. Clair Station', placeType: 'subway_station' },
  eglinton: { lat: 43.7058, lng: -79.3984, label: 'Eglinton Station', placeType: 'subway_station' },
  finch: { lat: 43.7815, lng: -79.4154, label: 'Finch Station', placeType: 'subway_station' },
  sheppard: { lat: 43.7612, lng: -79.4109, label: 'Sheppard–Yonge Station', placeType: 'subway_station' },
  kennedy: { lat: 43.7325, lng: -79.2622, label: 'Kennedy Station', placeType: 'subway_station' },
  spadina: { lat: 43.6677, lng: -79.4031, label: 'Spadina Station', placeType: 'subway_station' },
  stgeorge: { lat: 43.6682, lng: -79.3995, label: 'St. George Station', placeType: 'subway_station' },
  'st george': { lat: 43.6682, lng: -79.3995, label: 'St. George Station', placeType: 'subway_station' },
  ossington: { lat: 43.6534, lng: -79.4262, label: 'Ossington Station', placeType: 'subway_station' },
  christie: { lat: 43.6537, lng: -79.4186, label: 'Christie Station', placeType: 'subway_station' },
  bathurst: { lat: 43.6663, lng: -79.4117, label: 'Bathurst Station', placeType: 'subway_station' },
  wilson: { lat: 43.7343, lng: -79.4502, label: 'Wilson Station', placeType: 'subway_station' },
  yorkdale: { lat: 43.7246, lng: -79.4532, label: 'Yorkdale Station', placeType: 'subway_station' },
  lawrence: { lat: 43.725, lng: -79.4033, label: 'Lawrence Station', placeType: 'subway_station' },
  'queen station': { lat: 43.6513, lng: -79.3795, label: 'Queen Station', placeType: 'subway_station' },
  king: { lat: 43.6485, lng: -79.3793, label: 'King Station', placeType: 'subway_station' },
  museum: { lat: 43.6677, lng: -79.3945, label: 'Museum Station', placeType: 'subway_station' },
  bloor: { lat: 43.6514, lng: -79.3792, label: 'Bloor–Yonge Station', placeType: 'subway_station' },
  'pearson station': { lat: 43.6822, lng: -79.614, label: 'Pearson Airport Station', placeType: 'train_station' },
  'pearson st': { lat: 43.6822, lng: -79.614, label: 'Pearson Airport Station', placeType: 'train_station' },
  'mount dennis': { lat: 43.6872, lng: -79.4703, label: 'Mount Dennis Station', placeType: 'train_station' },
  'mount der': { lat: 43.6872, lng: -79.4703, label: 'Mount Dennis Station', placeType: 'train_station' },
  'humber loop': { lat: 43.6537, lng: -79.4822, label: 'Humber Loop', placeType: 'streetcar_stop' },
  'humber lo': { lat: 43.6537, lng: -79.4822, label: 'Humber Loop', placeType: 'streetcar_stop' },
  'queen st w': { lat: 43.6465, lng: -79.4026, label: 'Queen St W & Spadina', placeType: 'streetcar_stop' },
  'queen st v': { lat: 43.6465, lng: -79.4026, label: 'Queen St W & Spadina', placeType: 'streetcar_stop' },
  'leslie st': { lat: 43.6668, lng: -79.3289, label: 'Leslie St at Eastern Ave', placeType: 'intersection' },
  'leslie st a': { lat: 43.6668, lng: -79.3289, label: 'Leslie St at Eastern Ave', placeType: 'intersection' },
  leaside: { lat: 43.7045, lng: -79.3625, label: 'Leaside', placeType: 'bus_stop' },
  sunnybrook: { lat: 43.7242, lng: -79.3741, label: 'Sunnybrook Hospital', placeType: 'bus_stop' },
  sunnybro: { lat: 43.7242, lng: -79.3741, label: 'Sunnybrook Hospital', placeType: 'bus_stop' },
}

const SUBWAY_KEYS = new Set(
  Object.entries(STATIONS)
    .filter(([, v]) => v.placeType === 'subway_station')
    .map(([k]) => k),
)

const TRAIN_KEYS = new Set(
  Object.entries(STATIONS)
    .filter(([, v]) => v.placeType === 'train_station')
    .map(([k]) => k),
)

export function normalizeLocationKey(location: string): string {
  return location
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\bstat(ion)?\b/g, 'station')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

export function isKnownSubwayStation(location: string): boolean {
  const key = normalizeLocationKey(location)
  if (SUBWAY_KEYS.has(key)) return true
  return Object.keys(STATIONS).some(
    (k) => STATIONS[k].placeType === 'subway_station' && (key.includes(k) || k.includes(key)),
  )
}

export function isKnownTrainStation(location: string): boolean {
  const key = normalizeLocationKey(location)
  if (TRAIN_KEYS.has(key)) return true
  return Object.keys(STATIONS).some(
    (k) => STATIONS[k].placeType === 'train_station' && (key.includes(k) || k.includes(key)),
  )
}

export function lookupStation(location: string): StationEntry | null {
  const key = normalizeLocationKey(location)
  if (STATIONS[key]) return STATIONS[key]

  const partial = Object.entries(STATIONS).find(([k]) => key.includes(k) || k.includes(key))
  return partial ? partial[1] : null
}
