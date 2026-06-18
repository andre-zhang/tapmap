import { useEffect, useMemo, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import type { LatLngExpression, LatLngTuple } from 'leaflet'
import type { Trip } from '../types'
import { buildMapLayers, shouldShowStop, stopMarkerRadius } from '../lib/mapLayers'
import 'leaflet/dist/leaflet.css'

const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function FitBounds({ points }: { points: LatLngTuple[] }) {
  const map = useMap()

  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 14)
      return
    }
    map.fitBounds(points, { padding: [48, 48], maxZoom: 15 })
  }, [map, points])

  return null
}

function MapZoomTracker({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMap()
  useEffect(() => onZoom(map.getZoom()), [map, onZoom])
  useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  })
  return null
}

type PrestoMapProps = {
  trips: Trip[]
}

export default function PrestoMap({ trips }: PrestoMapProps) {
  const defaultCenter: LatLngExpression = [43.6532, -79.3832]
  const [zoom, setZoom] = useState(12)

  const { lines, stops } = useMemo(() => buildMapLayers(trips), [trips])

  const boundsPoints = useMemo(() => {
    const pts: LatLngTuple[] = []
    for (const line of lines) {
      if (line.positions.length > 0) {
        pts.push(line.positions[0], line.positions[line.positions.length - 1])
      }
    }
    for (const stop of stops) pts.push([stop.lat, stop.lng])
    return pts
  }, [lines, stops])

  const visibleStops = useMemo(
    () => stops.filter((s) => shouldShowStop(s, zoom, stops.length)),
    [stops, zoom],
  )

  const lineOpacity = trips.length > 8 ? 0.32 : trips.length > 3 ? 0.45 : 0.6
  const lineWeight = trips.length > 8 ? 2 : trips.length > 3 ? 3 : 4

  return (
    <div className="map-shell">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        className="presto-map"
        scrollWheelZoom
        preferCanvas
      >
        <TileLayer url={OSM_TILES} attribution={ATTRIBUTION} />
        <MapZoomTracker onZoom={setZoom} />
        <FitBounds points={boundsPoints} />

        {lines.map((line) => (
          <Polyline
            key={line.id}
            positions={line.positions}
            pathOptions={{
              color: line.color,
              weight: line.dashed ? lineWeight - 1 : lineWeight,
              opacity: line.dashed ? lineOpacity * 0.7 : lineOpacity,
              dashArray: line.dashed ? '6 5' : undefined,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        ))}

        {visibleStops.map((cluster) => {
          const radius = stopMarkerRadius(cluster, zoom)
          const isHot = cluster.visits >= 3
          return (
            <CircleMarker
              key={cluster.key}
              center={[cluster.lat, cluster.lng]}
              radius={radius}
              pathOptions={{
                color: '#111',
                weight: isHot ? 2 : 1.5,
                fillColor: cluster.originCount > 0 ? cluster.color : '#fff200',
                fillOpacity: 0.92,
              }}
            >
              <Popup className="comic-popup">
                <div className="popup-burst">
                  <strong>{cluster.displayName}</strong>
                  {cluster.visits > 1 && (
                    <p className="popup-count">{cluster.visits} taps here</p>
                  )}
                  <ul className="popup-events">
                    {cluster.events.slice(0, 6).map((ev, i) => (
                      <li key={`${ev.tripId}-${i}`}>
                        {ev.dateLabel} · {ev.transactionType}
                        {ev.isOrigin ? ' · origin' : ''}
                      </li>
                    ))}
                    {cluster.events.length > 6 && (
                      <li className="popup-more">+{cluster.events.length - 6} more</li>
                    )}
                  </ul>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>

      {trips.length > 0 && (
        <div className="map-legend">
          {trips.length} trips · {stops.length} stops
          {zoom < 13 && stops.length > 40 && ' · zoom in for all stops'}
        </div>
      )}
    </div>
  )
}
