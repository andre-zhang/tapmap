import { describe, expect, it } from 'vitest'
import { buildTrips } from './buildTrips'
import type { PrestoTransaction } from '../types'

function tx(partial: Partial<PrestoTransaction> & Pick<PrestoTransaction, 'id' | 'location' | 'transactionType'>): PrestoTransaction {
  return {
    date: '2024-06-17',
    dateLabel: '17 June 2024',
    sequence: 0,
    agency: 'Toronto Transit Commission',
    timestamp: null,
    ...partial,
  }
}

describe('buildTrips', () => {
  it('starts a new trip on Fare Payment when timestamps are missing', () => {
    const trips = buildTrips([
      tx({ id: '1', location: 'Union Station', transactionType: 'Fare Payment', sequence: 0 }),
      tx({ id: '2', location: 'DUFFERIN', transactionType: 'Free Transfer', sequence: 1 }),
      tx({ id: '3', location: 'Spadina', transactionType: 'Fare Payment', sequence: 2 }),
    ])
    expect(trips).toHaveLength(2)
    expect(trips[0].stops).toHaveLength(2)
    expect(trips[1].stops).toHaveLength(1)
  })

  it('groups official Fare Payment taps in a 2-hour window into one trip', () => {
    const start = Date.parse('2018-11-02T11:31:00')
    const trips = buildTrips([
      tx({
        id: 'a',
        location: 'Exhibition GO Station Rail',
        transactionType: 'Fare Payment',
        agency: 'Go Transit',
        timestamp: start,
      }),
      tx({
        id: 'b',
        location: 'Union Station Rail',
        transactionType: 'Fare Payment',
        agency: 'Go Transit',
        timestamp: start + 13 * 60 * 1000,
      }),
      tx({
        id: 'c',
        location: 'UNION STATION',
        transactionType: 'Fare Payment',
        timestamp: start + 17 * 60 * 1000,
      }),
    ])
    expect(trips).toHaveLength(1)
    expect(trips[0].stops).toHaveLength(3)
  })

  it('starts a new trip after the transfer window', () => {
    const start = Date.parse('2018-11-02T08:00:00')
    const trips = buildTrips([
      tx({ id: 'a', location: 'Union Station', transactionType: 'Fare Payment', timestamp: start }),
      tx({
        id: 'b',
        location: 'Spadina',
        transactionType: 'Fare Payment',
        timestamp: start + 3 * 60 * 60 * 1000,
      }),
    ])
    expect(trips).toHaveLength(2)
  })
})
