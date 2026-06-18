import Papa from 'papaparse'
import type { PrestoTransaction } from '../types'

const TRAVEL_TYPES = /fare\s*pay|free\s*trans|tap\s*on|tap\s*off/i
const SKIP_TYPES = /load\s*amou|auto\s*load|refund|adjustment/i

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

function parsePrestoDate(raw: string): { iso: string; label: string } | null {
  const label = raw.trim()
  if (!label) return null

  const match = label.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/)
  if (!match) return null

  const day = Number(match[1])
  const monthKey = match[2].toLowerCase()
  const month = MONTHS[monthKey]
  if (month === undefined) return null

  let year = Number(match[3])
  if (year < 100) year += 2000
  if (year < 1000) year += 2000

  const date = new Date(Date.UTC(year, month, day))
  if (Number.isNaN(date.getTime())) return null

  return { iso: date.toISOString().slice(0, 10), label }
}

function isHeaderRow(cells: string[]): boolean {
  const joined = cells.join(' ').toLowerCase()
  return joined.includes('date') && (joined.includes('location') || joined.includes('transaction'))
}

function rowToTransaction(cells: string[], rowIndex: number): PrestoTransaction | null {
  const nonEmpty = cells.map((c) => c.trim()).filter(Boolean)
  if (nonEmpty.length < 4) return null

  let dateRaw: string
  let sequence: number
  let agency: string
  let location: string
  let transactionType: string

  if (cells.length >= 6) {
    dateRaw = cells[0]?.trim() ?? ''
    sequence = Number(cells[2]?.trim() ?? cells[1]?.trim() ?? rowIndex)
    agency = cells[3]?.trim() ?? ''
    location = cells[4]?.trim() ?? ''
    transactionType = cells[5]?.trim() ?? ''
  } else {
    dateRaw = cells[0]?.trim() ?? ''
    sequence = Number(cells[1]?.trim() ?? rowIndex)
    agency = cells[2]?.trim() ?? ''
    location = cells[3]?.trim() ?? ''
    transactionType = cells[4]?.trim() ?? ''
  }

  const parsedDate = parsePrestoDate(dateRaw)
  if (!parsedDate) return null

  const type = transactionType.trim()
  if (!type || SKIP_TYPES.test(type)) return null
  if (!TRAVEL_TYPES.test(type)) return null
  if (!location.trim()) return null

  return {
    id: `${parsedDate.iso}-${sequence}-${rowIndex}`,
    date: parsedDate.iso,
    dateLabel: parsedDate.label,
    sequence: Number.isFinite(sequence) ? sequence : rowIndex,
    agency: agency.trim(),
    location: location.trim(),
    transactionType: type,
  }
}

export function parsePrestoCsv(text: string): PrestoTransaction[] {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true })
  const rows = result.data.filter((row) => row.some((cell) => cell?.trim()))
  if (rows.length === 0) return []

  const startIndex = isHeaderRow(rows[0]) ? 1 : 0
  const transactions: PrestoTransaction[] = []

  for (let i = startIndex; i < rows.length; i++) {
    const tx = rowToTransaction(rows[i], i)
    if (tx) transactions.push(tx)
  }

  return transactions.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.sequence - b.sequence
  })
}
