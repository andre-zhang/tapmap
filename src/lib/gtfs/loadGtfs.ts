import type { GtfsFeedIndex } from './types'
import { buildTokenIndex } from './matchStop'
import { buildAdjacency, type GtfsAdjacency } from './routeShape'

let cached: GtfsFeedIndex | null = null
let adjacency: GtfsAdjacency | null = null
let loadPromise: Promise<GtfsFeedIndex | null> | null = null

export async function loadGtfsIndex(): Promise<GtfsFeedIndex | null> {
  if (cached) return cached
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      const res = await fetch('/gtfs/ttc-index.json')
      if (!res.ok) return null
      cached = (await res.json()) as GtfsFeedIndex
      cached.tokenIndex = buildTokenIndex(cached)
      adjacency = buildAdjacency(cached)
      return cached
    } catch {
      return null
    } finally {
      loadPromise = null
    }
  })()

  return loadPromise
}

export function getGtfsIndex(): GtfsFeedIndex | null {
  return cached
}

export function getGtfsAdjacency(): GtfsAdjacency | null {
  return adjacency
}
