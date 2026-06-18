import type { PrestoTransaction, Trip, TripStop } from '../types'
import { classifyPlaceType } from './classifyPlace'

const TRIP_START = /fare\s*pay|tap\s*on/i

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
    if (TRIP_START.test(tx.transactionType)) {
      flush()
      current = [tx]
    } else if (current.length > 0) {
      current.push(tx)
    }
  }
  flush()

  return trips
}

export function uniqueDates(trips: Trip[]): string[] {
  return [...new Set(trips.map((t) => t.date))].sort()
}
