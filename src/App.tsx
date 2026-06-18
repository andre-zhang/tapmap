import { useCallback, useEffect, useMemo, useState } from 'react'
import CsvUploader from './components/CsvUploader'
import FilterPanel from './components/FilterPanel'
import PrestoMap from './components/PrestoMap'
import { buildTrips, uniqueDates } from './lib/buildTrips'
import { geocodeTrips, enrichTripsWithGtfs } from './lib/geocode'
import { loadGtfsIndex } from './lib/gtfs/loadGtfs'
import type { GtfsFeedIndex } from './lib/gtfs/types'
import { parsePrestoCsv } from './lib/parsePrestoCsv'
import type { GeocodeProgress, PlaceType, Trip } from './types'
import { PLACE_TYPE_LABELS } from './types'
import './App.css'

const ALL_PLACE_TYPES = Object.keys(PLACE_TYPE_LABELS) as PlaceType[]

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [gtfsIndex, setGtfsIndex] = useState<GtfsFeedIndex | null>(null)
  const [gtfsReady, setGtfsReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<GeocodeProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | 'all'>('all')
  const [selectedOriginTypes, setSelectedOriginTypes] = useState<Set<PlaceType>>(
    () => new Set(ALL_PLACE_TYPES),
  )

  useEffect(() => {
    loadGtfsIndex().then((index) => {
      setGtfsIndex(index)
      setGtfsReady(Boolean(index))
    })
  }, [])

  useEffect(() => {
    if (!gtfsIndex) return
    setTrips((current) => (current.length > 0 ? enrichTripsWithGtfs(current, gtfsIndex) : current))
  }, [gtfsIndex])

  const dates = useMemo(() => uniqueDates(trips), [trips])

  const originTypesInData = useMemo(() => {
    const set = new Set<PlaceType>()
    for (const trip of trips) set.add(trip.originPlaceType)
    return ALL_PLACE_TYPES.filter((t) => set.has(t))
  }, [trips])

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      if (selectedDate !== 'all' && trip.date !== selectedDate) return false
      if (!selectedOriginTypes.has(trip.originPlaceType)) return false
      return true
    })
  }, [trips, selectedDate, selectedOriginTypes])

  const stopCount = useMemo(
    () => filteredTrips.reduce((n, t) => n + t.stops.length, 0),
    [filteredTrips],
  )

  const handleFile = useCallback(
    async (text: string) => {
      setError(null)
      setLoading(true)
      setProgress(null)

      try {
        const transactions = parsePrestoCsv(text)
        if (transactions.length === 0) {
          throw new Error('No travel taps found in that CSV.')
        }

        const rawTrips = buildTrips(transactions)
        const geocoded = await geocodeTrips(rawTrips, setProgress, gtfsIndex)
        setTrips(geocoded)
        setSelectedDate('all')
        setSelectedOriginTypes(new Set(ALL_PLACE_TYPES))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to import CSV')
      } finally {
        setLoading(false)
        setProgress(null)
      }
    },
    [gtfsIndex],
  )

  const loadSample = useCallback(async () => {
    const res = await fetch('/sample-presto.csv')
    await handleFile(await res.text())
  }, [handleFile])

  const toggleOriginType = (type: PlaceType) => {
    setSelectedOriginTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const progressPct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  const busy = loading || !gtfsReady

  return (
    <div className="app">
      <header className="top-bar">
        <h1 className="brand">PRESTO TAP MAP</h1>
        <div className="top-actions">
          <CsvUploader onFile={handleFile} loading={busy} />
          <button type="button" className="comic-btn" onClick={loadSample} disabled={busy}>
            Sample
          </button>
        </div>
      </header>

      {loading && progress && (
        <div className="progress-bar" role="status">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {trips.length > 0 ? (
        <main className="workspace">
          <FilterPanel
            dates={dates}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            originTypes={originTypesInData}
            selectedOriginTypes={selectedOriginTypes}
            onToggleOriginType={toggleOriginType}
            tripCount={filteredTrips.length}
            stopCount={stopCount}
          />
          <PrestoMap trips={filteredTrips} />
        </main>
      ) : (
        !busy && (
          <section className="empty-state">
            <span className="empty-burst">IMPORT!</span>
          </section>
        )
      )}
    </div>
  )
}
