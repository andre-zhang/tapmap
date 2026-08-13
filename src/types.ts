export type PlaceType =
  | 'subway_station'
  | 'train_station'
  | 'bus_stop'
  | 'streetcar_stop'
  | 'intersection'
  | 'other'

export const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  subway_station: 'Subway',
  train_station: 'Train / UPX',
  bus_stop: 'Bus stop',
  streetcar_stop: 'Streetcar',
  intersection: 'Intersection',
  other: 'Other',
}

export const PLACE_TYPE_COLORS: Record<PlaceType, string> = {
  subway_station: '#ff3b30',
  train_station: '#5856d6',
  bus_stop: '#34c759',
  streetcar_stop: '#ff9500',
  intersection: '#007aff',
  other: '#8e8e93',
}

export type PrestoTransaction = {
  id: string
  date: string
  dateLabel: string
  sequence: number
  agency: string
  location: string
  transactionType: string
  timestamp: number | null
}

export type GeocodedLocation = {
  location: string
  lat: number
  lng: number
  placeType: PlaceType
  displayName: string
}

export type TripStop = {
  transaction: PrestoTransaction
  geocoded: GeocodedLocation | null
  gtfsStopId?: string | null
}

export type TripLegGeometry = {
  positions: [number, number][]
  routeName?: string
  shapeMatched: boolean
}

export type Trip = {
  id: string
  date: string
  origin: TripStop
  stops: TripStop[]
  originPlaceType: PlaceType
  legs?: TripLegGeometry[]
}

export type GeocodeProgress = {
  done: number
  total: number
  current?: string
}
