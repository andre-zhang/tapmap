import Papa from 'papaparse'
import type { PrestoTransaction } from '../types'

const TRAVEL_TYPES = /fare\s*pay|free\s*trans|\btransfer\b|tap\s*on|tap\s*off|default\s*fare/i
const SKIP_TYPES = /load\s*amou|auto\s*load|refund|adjustment|pass\s*purchase|monthly\s*pass/i

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
}

const DATE_HEADERS = ['date', 'transaction date', 'tap date', 'datetime', 'date time']
const TIME_HEADERS = ['time', 'tap time', 'transaction time']
const AGENCY_HEADERS = ['agency', 'transit agency', 'operator', 'transit operator']
const LOCATION_HEADERS = ['location', 'stop', 'station', 'stop name', 'tap location', 'stop location']
const TYPE_HEADERS = ['transaction type', 'type', 'transaction', 'activity', 'desc', 'description']
const SEQUENCE_HEADERS = ['sequence', 'seq', 'order']

export class PrestoCsvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PrestoCsvError'
  }
}

type ColumnMap = {
  date: number
  time: number
  agency: number
  location: number
  type: number
  sequence: number
}

type ParsedDate = {
  iso: string
  label: string
  timestamp: number | null
}

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1)
  return text
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function findColumn(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader)
  for (const alias of aliases) {
    const exact = normalized.indexOf(alias)
    if (exact >= 0) return exact
  }
  for (const alias of aliases) {
    const partial = normalized.findIndex(
      (header) => header === alias || header.startsWith(`${alias} `) || header.endsWith(` ${alias}`),
    )
    if (partial >= 0) return partial
  }
  return -1
}

function parseTime(raw: string | undefined): { h: number; m: number; s: number } | null {
  if (!raw) return null
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]\.?)?$/)
  if (!match) return null

  let hour = Number(match[1])
  const minute = Number(match[2])
  const second = Number(match[3] ?? 0)
  const ampm = match[4]

  if (ampm) {
    const pm = ampm.toLowerCase() === 'p'
    if (pm && hour < 12) hour += 12
    if (!pm && hour === 12) hour = 0
  }

  if (hour > 23 || minute > 59 || second > 59) return null
  return { h: hour, m: minute, s: second }
}

function finishDate(year: number, month: number, day: number, time: { h: number; m: number; s: number } | null, raw: string): ParsedDate | null {
  let resolvedYear = year
  if (resolvedYear < 100) resolvedYear += 2000
  if (month < 0 || month > 11 || day < 1 || day > 31) return null

  const hours = time?.h ?? 12
  const minutes = time?.m ?? 0
  const seconds = time?.s ?? 0
  const date = new Date(resolvedYear, month, day, hours, minutes, seconds)
  if (Number.isNaN(date.getTime())) return null
  if (date.getMonth() !== month || date.getDate() !== day) return null

  return {
    iso: `${resolvedYear}-${pad(month + 1)}-${pad(day)}`,
    label: raw.trim(),
    timestamp: time ? date.getTime() : null,
  }
}

export function parsePrestoDate(raw: string): ParsedDate | null {
  const label = raw.trim()
  if (!label) return null

  const dayMonthYear = label.match(
    /^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{2,4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp]\.?[Mm]\.?)?))?$/,
  )
  if (dayMonthYear) {
    const month = MONTHS[dayMonthYear[2].toLowerCase()]
    if (month === undefined) return null
    return finishDate(Number(dayMonthYear[3]), month, Number(dayMonthYear[1]), parseTime(dayMonthYear[4]), label)
  }

  const monthDayYear = label.match(
    /^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{2,4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp]\.?[Mm]\.?)?))?$/,
  )
  if (monthDayYear) {
    const month = MONTHS[monthDayYear[1].toLowerCase()]
    if (month === undefined) return null
    return finishDate(Number(monthDayYear[3]), month, Number(monthDayYear[2]), parseTime(monthDayYear[4]), label)
  }

  const iso = label.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?)?/)
  if (iso) {
    return finishDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), parseTime(iso[4]), label)
  }

  const slash = label.match(
    /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp]\.?[Mm]\.?)?))?$/,
  )
  if (slash) {
    // PRESTO website exports use US M/D/YYYY.
    return finishDate(Number(slash[3]), Number(slash[1]) - 1, Number(slash[2]), parseTime(slash[4]), label)
  }

  return null
}

function isHeaderRow(cells: string[]): boolean {
  const headers = cells.map(normalizeHeader)
  const joined = headers.join(' ')
  const hasDate = headers.some((h) => DATE_HEADERS.includes(h) || h.includes('date'))
  const hasLocation = headers.some((h) => LOCATION_HEADERS.includes(h))
  const hasType = headers.some((h) => TYPE_HEADERS.includes(h) || h.includes('type') || h.includes('transaction'))
  const hasAgency = headers.some((h) => AGENCY_HEADERS.includes(h) || h.includes('agency'))
  return hasDate && (hasLocation || (hasType && hasAgency) || joined.includes('transaction'))
}

function looksLikeUsageReport(headers: string[]): boolean {
  const location = findColumn(headers, LOCATION_HEADERS)
  const type = findColumn(headers, TYPE_HEADERS)
  const agency = findColumn(headers, AGENCY_HEADERS)
  const date = findColumn(headers, DATE_HEADERS)
  return date >= 0 && agency >= 0 && type >= 0 && location < 0
}

function mapColumns(headers: string[]): ColumnMap | null {
  const date = findColumn(headers, DATE_HEADERS)
  const time = findColumn(headers, TIME_HEADERS)
  const agency = findColumn(headers, AGENCY_HEADERS)
  const location = findColumn(headers, LOCATION_HEADERS)
  const type = findColumn(headers, TYPE_HEADERS)
  const sequence = findColumn(headers, SEQUENCE_HEADERS)

  if (date < 0 || location < 0 || type < 0) return null

  return {
    date,
    time,
    agency: agency >= 0 ? agency : -1,
    location,
    type,
    sequence,
  }
}

function positionalMap(cells: string[]): ColumnMap {
  if (cells.length >= 6) {
    return { date: 0, time: -1, sequence: 2, agency: 3, location: 4, type: 5 }
  }
  return { date: 0, time: -1, sequence: 1, agency: 2, location: 3, type: 4 }
}

function cell(row: string[], index: number): string {
  if (index < 0) return ''
  return (row[index] ?? '').trim()
}

function rowToTransaction(row: string[], columns: ColumnMap, rowIndex: number): PrestoTransaction | null {
  let dateRaw = cell(row, columns.date)
  const timeRaw = cell(row, columns.time)
  if (timeRaw && !/\d{1,2}:\d{2}/.test(dateRaw)) {
    dateRaw = `${dateRaw} ${timeRaw}`
  }

  const parsedDate = parsePrestoDate(dateRaw)
  if (!parsedDate) return null

  const transactionType = cell(row, columns.type)
  if (!transactionType || SKIP_TYPES.test(transactionType)) return null
  if (!TRAVEL_TYPES.test(transactionType)) return null

  const location = cell(row, columns.location)
  if (!location) return null

  const sequenceRaw = columns.sequence >= 0 ? Number(cell(row, columns.sequence)) : NaN
  const sequence = Number.isFinite(sequenceRaw)
    ? sequenceRaw
    : parsedDate.timestamp ?? rowIndex

  return {
    id: `${parsedDate.iso}-${sequence}-${rowIndex}`,
    date: parsedDate.iso,
    dateLabel: parsedDate.label,
    sequence,
    agency: cell(row, columns.agency),
    location,
    transactionType,
    timestamp: parsedDate.timestamp,
  }
}

export function parsePrestoCsv(text: string): PrestoTransaction[] {
  const cleaned = stripBom(text).split('\0').join('')
  const result = Papa.parse<string[]>(cleaned, {
    skipEmptyLines: 'greedy',
    delimitersToGuess: [',', '\t', ';', '|'],
  })
  const rows = result.data.filter((row) => row.some((value) => value?.trim()))
  if (rows.length === 0) return []

  let headerIndex = -1
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    if (isHeaderRow(rows[i])) {
      headerIndex = i
      break
    }
  }

  let columns: ColumnMap
  let startIndex = 0

  if (headerIndex >= 0) {
    const headers = rows[headerIndex]
    if (looksLikeUsageReport(headers)) {
      throw new PrestoCsvError(
        'This looks like a Transit Usage Report (no stop locations). On prestocard.ca export Transaction History, not the tax usage report.',
      )
    }
    columns = mapColumns(headers) ?? positionalMap(headers)
    startIndex = headerIndex + 1
  } else {
    columns = positionalMap(rows[0])
  }

  const transactions: PrestoTransaction[] = []
  for (let i = startIndex; i < rows.length; i++) {
    const tx = rowToTransaction(rows[i], columns, i)
    if (tx) transactions.push(tx)
  }

  return transactions.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    if (a.timestamp != null && b.timestamp != null && a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp
    }
    return a.sequence - b.sequence
  })
}
