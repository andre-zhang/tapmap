import type { PrestoTransaction, Trip, TripStop } from '../types'
import { classifyPlaceType } from './classifyPlace'

const TRIP_START = /fare\s*pay|tap\s*on|default\s*fare/i
const TAP_ON = /tap\s*on/i
const TAP_OFF = /tap\s*off/i
const TRANSFER_WINDOW_MS = 2 * 60 * 60 * 1000

function startsNewTrip(tx: PrestoTransaction, previous: PrestoTransaction | null): boolean {
  if (!previous) return true

  if (tx.timestamp != null && previous.timestamp != null) {
    if (tx.timestamp - previous.timestamp > TRANSFER_WINDOW_MS) return true
    if (TAP_ON.test(tx.transactionType) && TAP_OFF.test(previous.transactionType)) return true
    // Official PRESTO often records every TTC boarding as "Fare Payment".
    // Keep taps in the same 2-hour window on one trip so map links draw.
    return false
  }

  return TRIP_START.test(tx.transactionType)
}

export function buildTrips(transactions: PrestoTransaction[]): Trip[] {
  const trips: Trip[] = []
  let current: PrestoTransaction[] = []

  const flush = () => {
    if (current.length === 0) return
    const originTx = current[0]
    const originPlaceType = classifyPlaceType(originTx.location, originTx.agency)
    const stops: TripStop[] = current.map((transaction) => ({
      transaction,
      geocoded: null,
    }))
    trips.push({
      id: `trip-${originTx.id}`,
      date: originTx.date,
      origin: stops[0],
      stops,
      originPlaceType,
    })
    current = []
  }

  for (const tx of transactions) {
    const previous = current[current.length - 1] ?? null
    if (startsNewTrip(tx, previous)) {
      flush()
      current = [tx]
    } else {
      current.push(tx)
    }
  }
  flush()

  return trips
}

export function uniqueDates(trips: Trip[]): string[] {
  return [...new Set(trips.map((t) => t.date))].sort()
}
