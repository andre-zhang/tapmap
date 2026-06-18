import type { TripLegGeometry } from '../../types'
import type { GtfsFeedIndex, GtfsSegmentRef, GtfsShapePoint, LatLngTuple } from './types'

export type GtfsAdjacency = Record<string, Array<{ to: string; seg: GtfsSegmentRef }>>

export function buildAdjacency(index: GtfsFeedIndex): GtfsAdjacency {
  const adj: GtfsAdjacency = {}
  for (const [key, seg] of Object.entries(index.segments)) {
    const pipe = key.indexOf('|')
    const from = key.slice(0, pipe)
    const to = key.slice(pipe + 1)
    if (!adj[from]) adj[from] = []
    adj[from].push({ to, seg })
  }
  return adj
}

function sliceShape(shape: GtfsShapePoint[], d0: number, d1: number): LatLngTuple[] {
  const lo = Math.min(d0, d1)
  const hi = Math.max(d0, d1)
  const out: LatLngTuple[] = []

  for (const [lat, lon, dist] of shape) {
    if (dist >= lo && dist <= hi) out.push([lat, lon])
  }

  if (out.length < 2) {
    let nearestLo: LatLngTuple | null = null
    let nearestHi: LatLngTuple | null = null
    let gapLo = Infinity
    let gapHi = Infinity
    for (const [lat, lon, dist] of shape) {
      const g0 = Math.abs(dist - lo)
      const g1 = Math.abs(dist - hi)
      if (g0 < gapLo) {
        gapLo = g0
        nearestLo = [lat, lon]
      }
      if (g1 < gapHi) {
        gapHi = g1
        nearestHi = [lat, lon]
      }
    }
    if (nearestLo) out.unshift(nearestLo)
    if (nearestHi) out.push(nearestHi)
  }

  return out
}

function appendPositions(base: LatLngTuple[], extra: LatLngTuple[]) {
  if (extra.length === 0) return
  if (base.length === 0) {
    base.push(...extra)
    return
  }
  const [lastLat, lastLng] = base[base.length - 1]
  const [firstLat, firstLng] = extra[0]
  if (Math.abs(lastLat - firstLat) < 1e-6 && Math.abs(lastLng - firstLng) < 1e-6) {
    base.push(...extra.slice(1))
  } else {
    base.push(...extra)
  }
}

function clusterStopIds(index: GtfsFeedIndex, stopId: string): string[] {
  return index.stopClusters?.[stopId] ?? [stopId]
}

export function lookupSegment(
  index: GtfsFeedIndex,
  fromStopId: string,
  toStopId: string,
): GtfsSegmentRef | null {
  const direct = index.segments[`${fromStopId}|${toStopId}`]
  if (direct) return direct

  const fromIds = clusterStopIds(index, fromStopId)
  const toIds = clusterStopIds(index, toStopId)

  let best: GtfsSegmentRef | null = null
  let bestSpan = Infinity

  for (const fromId of fromIds) {
    for (const toId of toIds) {
      const seg = index.segments[`${fromId}|${toId}`]
      if (!seg) continue
      const span = Math.abs(seg.d1 - seg.d0)
      if (span < bestSpan) {
        bestSpan = span
        best = seg
      }
    }
  }

  return best
}

type PathResult = {
  stopPath: string[]
  segments: GtfsSegmentRef[]
}

/** BFS along GTFS segment graph between stop clusters. */
export function pathfindStops(
  index: GtfsFeedIndex,
  adj: GtfsAdjacency,
  fromStopId: string,
  toStopId: string,
  maxHops = 64,
): PathResult | null {
  const goal = new Set(clusterStopIds(index, toStopId))
  const starts = clusterStopIds(index, fromStopId)

  type QueueNode = { stopId: string; path: string[]; segs: GtfsSegmentRef[] }
  const queue: QueueNode[] = starts.map((stopId) => ({ stopId, path: [stopId], segs: [] }))
  const visited = new Set(starts)

  while (queue.length > 0) {
    const node = queue.shift()!
    if (goal.has(node.stopId) && node.segs.length > 0) {
      return { stopPath: node.path, segments: node.segs }
    }
    if (node.segs.length >= maxHops) continue

    for (const edge of adj[node.stopId] ?? []) {
      if (visited.has(edge.to)) continue
      visited.add(edge.to)
      queue.push({
        stopId: edge.to,
        path: [...node.path, edge.to],
        segs: [...node.segs, edge.seg],
      })
    }
  }

  return null
}

function pathToPositions(index: GtfsFeedIndex, segments: GtfsSegmentRef[]): LatLngTuple[] {
  const positions: LatLngTuple[] = []
  for (const seg of segments) {
    const shape = index.shapes[seg.s]
    if (!shape) continue
    appendPositions(positions, sliceShape(shape, seg.d0, seg.d1))
  }
  return positions
}

export function resolveStopChain(
  candidateSets: string[][],
  index: GtfsFeedIndex,
  adj: GtfsAdjacency,
): (string | null)[] {
  if (candidateSets.length === 0) return []
  if (candidateSets.every((set) => set.length === 0)) {
    return candidateSets.map(() => null)
  }

  type State = { step: number; ids: string[] }
  let states: State[] = candidateSets[0].map((id) => ({ step: 0, ids: [id] }))

  for (let step = 0; step < candidateSets.length - 1; step++) {
    const nextCandidates = candidateSets[step + 1]
    const nextStates: State[] = []

    for (const state of states) {
      if (state.step !== step) continue
      const fromId = state.ids[state.ids.length - 1]

      for (const toId of nextCandidates) {
        const path = pathfindStops(index, adj, fromId, toId)
        if (path) {
          nextStates.push({ step: step + 1, ids: [...state.ids, toId] })
        }
      }
    }

    if (nextStates.length === 0) break
    states = nextStates
  }

  const complete = states.filter((s) => s.step === candidateSets.length - 1)
  if (complete.length > 0) {
    return complete[0].ids
  }

  return candidateSets.map((set) => set[0] ?? null)
}

export function routeLeg(
  index: GtfsFeedIndex,
  adj: GtfsAdjacency,
  fromStopId: string,
  toStopId: string,
  fallback: LatLngTuple[],
): { positions: LatLngTuple[]; routeName?: string; shapeMatched: boolean } {
  const path = pathfindStops(index, adj, fromStopId, toStopId)
  if (!path || path.segments.length === 0) {
    return { positions: fallback, shapeMatched: false }
  }

  const positions = pathToPositions(index, path.segments)
  if (positions.length < 2) {
    return { positions: fallback, shapeMatched: false }
  }

  return {
    positions,
    routeName: path.segments[0]?.r,
    shapeMatched: true,
  }
}

export function buildTripLegs(
  index: GtfsFeedIndex,
  adj: GtfsAdjacency,
  resolvedStopIds: (string | null)[],
  coords: (LatLngTuple | null)[],
): TripLegGeometry[] {
  const legs: TripLegGeometry[] = []

  for (let i = 0; i < resolvedStopIds.length - 1; i++) {
    const fromId = resolvedStopIds[i]
    const toId = resolvedStopIds[i + 1]
    const from = coords[i]
    const to = coords[i + 1]
    if (!from || !to) continue

    const fallback: LatLngTuple[] = [from, to]
    if (fromId && toId) {
      legs.push(routeLeg(index, adj, fromId, toId, fallback))
    } else {
      legs.push({ positions: fallback, shapeMatched: false })
    }
  }

  return legs
}
