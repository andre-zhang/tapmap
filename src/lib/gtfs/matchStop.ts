import type { GtfsFeedIndex, GtfsStopRecord } from './types'

const TTC_AGENCY = /toronto\s*tra/i

/** Single-word or short names that are TTC subway stations in PRESTO exports. */
const SUBWAY_STATION_PHRASES = new Set([
  'UNION',
  'UNION STATION',
  'SPADINA',
  'DUFFERIN',
  'BLOOR',
  'PAPE',
  'OSSINGTON',
  'CHRISTIE',
  'BATHURST',
  'FINCH',
  'SHEPPARD',
  'KENNEDY',
  'EGLINTON',
  'ST CLAIR',
  'STGEORGE',
  'ST GEORGE',
  'OLD MILL',
  'WILSON',
  'YORKDALE',
  'LAWRENCE',
  'KING',
  'QUEEN',
  'MUSEUM',
  'ROSEDALE',
  'SUMMERHILL',
  'DAVISVILLE',
  'EGLINTON WEST',
  'LANSDOWNE',
  'TMU',
  'TMU STATION',
])

function expandAbbreviations(text: string): string {
  return text
    .toUpperCase()
    .replace(/\bSTATI(ON)?\b/g, 'STATION')
    .replace(/\bSTN\b/g, 'STATION')
    .replace(/\bST\b/g, 'STREET')
    .replace(/\bAVE\b/g, 'AVENUE')
    .replace(/\bRD\b/g, 'ROAD')
    .replace(/\bBLVD\b/g, 'BOULEVARD')
    .replace(/\bDR\b/g, 'DRIVE')
    .replace(/\bCT\b/g, 'COURT')
    .replace(/\bCRES\b/g, 'CRESCENT')
}

function prestoSearchPhrase(location: string): string {
  return expandAbbreviations(location)
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function prestoTokens(location: string): string[] {
  const phrase = prestoSearchPhrase(location)
  return phrase
    .split(' ')
    .filter((t) => t.length >= 3 && !['THE', 'AND', 'STATION', 'STREET', 'AVENUE'].includes(t))
}

function isSubwayStyleTap(location: string): boolean {
  const trimmed = location.trim()
  if (/^\d+$/.test(trimmed)) return false
  if (/\bat\b/i.test(trimmed)) return false

  const phrase = prestoSearchPhrase(trimmed)
  if (SUBWAY_STATION_PHRASES.has(phrase)) return true
  if (SUBWAY_STATION_PHRASES.has(phrase.replace(/\s+STATION$/, ''))) return true

  return /^[A-Z][A-Z0-9\s]{1,}$/.test(trimmed) || /station$/i.test(trimmed)
}

function scoreStop(stop: GtfsStopRecord, location: string, tokens: string[], phrase: string): number {
  const name = stop.name.toUpperCase()
  let score = 0

  if (stop.code && stop.code === location.trim()) score += 200
  if (stop.id === location.trim()) score += 200

  if (phrase.length >= 3 && name.includes(phrase)) score += 100
  if (phrase.startsWith('QUEEN STREET WEST') && name.startsWith('QUEEN ST WEST')) score += 70

  const matchedTokens = tokens.filter((token) => name.includes(token))
  score += matchedTokens.length * 15
  if (tokens.length > 1 && matchedTokens.length < tokens.length) score -= 40

  const subwayTap = isSubwayStyleTap(location)
  const isPlatform = /PLATFORM/i.test(stop.name)
  const stationRoot = phrase.replace(/\s+STATION$/, '')

  if (subwayTap) {
    if (name.includes(`${stationRoot} STATION`) && isPlatform) score += 80
    if (name === `${stationRoot} STATION` || name.startsWith(`${stationRoot} STATION `)) score += 40
    if (/\bat\b/i.test(stop.name)) score -= 50
  } else {
    if (!isPlatform) score += 25
    if (/\bat\b/i.test(location) && /\bat\b/i.test(stop.name)) score += 30
  }

  return score
}

function collectCandidateIds(index: GtfsFeedIndex, tokens: string[]): Set<string> {
  const significant = tokens.filter((t) => t.length >= 3)
  if (significant.length === 0) {
    return new Set(Object.keys(index.stops))
  }

  const lists = significant.map((token) => index.tokenIndex?.[token] ?? [])
  let intersection = new Set(lists[0] ?? [])

  for (let i = 1; i < lists.length; i++) {
    const next = new Set(lists[i])
    intersection = new Set([...intersection].filter((id) => next.has(id)))
  }

  if (intersection.size > 0) return intersection

  // Fallback: union of tokens if intersection is empty
  const union = new Set<string>()
  for (const token of significant) {
    for (const id of index.tokenIndex?.[token] ?? []) union.add(id)
  }
  return union
}

export function findStopCandidates(
  index: GtfsFeedIndex,
  location: string,
  agency: string,
  limit = 12,
): GtfsStopRecord[] {
  if (!TTC_AGENCY.test(agency)) return []

  const trimmed = location.trim()
  if (!trimmed) return []

  if (/^\d{3,6}$/.test(trimmed)) {
    const byCode = index.codeIndex[trimmed]
    if (byCode && index.stops[byCode]) return [index.stops[byCode]]
    const byId = index.stops[trimmed]
    if (byId) return [byId]
  }

  const phrase = prestoSearchPhrase(trimmed)
  const tokens = prestoTokens(trimmed)
  const candidateIds = collectCandidateIds(index, tokens)
  const scored: Array<{ stop: GtfsStopRecord; score: number }> = []

  for (const id of candidateIds) {
    const stop = index.stops[id]
    if (!stop) continue
    const score = scoreStop(stop, trimmed, tokens, phrase)
    if (score >= 30) scored.push({ stop, score })
  }

  scored.sort((a, b) => b.score - a.score)

  const seen = new Set<string>()
  const out: GtfsStopRecord[] = []
  for (const { stop } of scored) {
    if (seen.has(stop.id)) continue
    seen.add(stop.id)
    out.push(stop)
    if (out.length >= limit) break
  }

  return out
}

export function matchGtfsStop(
  index: GtfsFeedIndex,
  location: string,
  agency: string,
): GtfsStopRecord | null {
  return findStopCandidates(index, location, agency, 1)[0] ?? null
}

export function buildTokenIndex(index: GtfsFeedIndex): Record<string, string[]> {
  const tokenIndex: Record<string, string[]> = {}

  const addToken = (token: string, stopId: string) => {
    if (token.length < 3) return
    if (!tokenIndex[token]) tokenIndex[token] = []
    tokenIndex[token].push(stopId)
  }

  for (const stop of Object.values(index.stops)) {
    const phrase = prestoSearchPhrase(stop.name)
    for (const token of phrase.split(' ')) {
      addToken(token, stop.id)
    }
    if (stop.norm) {
      for (const token of stop.norm.split(' ')) {
        addToken(token, stop.id)
      }
    }
  }

  return tokenIndex
}
