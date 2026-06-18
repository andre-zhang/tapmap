export type GtfsStopRecord = {
  id: string
  name: string
  code: string
  lat: number
  lon: number
  norm: string
}

export type GtfsShapePoint = [lat: number, lon: number, dist: number]

export type GtfsSegmentRef = {
  s: string
  d0: number
  d1: number
  r: string
}

export type GtfsFeedIndex = {
  version: number
  agency: string
  builtAt: string
  stops: Record<string, GtfsStopRecord>
  nameIndex: Record<string, string[]>
  codeIndex: Record<string, string>
  /** All GTFS stop_ids sharing a station or exact street location. */
  stopClusters?: Record<string, string[]>
  /** token -> stop ids for fast PRESTO location search */
  tokenIndex?: Record<string, string[]>
  shapes: Record<string, GtfsShapePoint[]>
  segments: Record<string, GtfsSegmentRef>
}

export type LatLngTuple = [number, number]

export type TripLegGeometry = {
  positions: LatLngTuple[]
  routeName?: string
  shapeMatched: boolean
}
