import type { CSSProperties } from 'react'
import type { PlaceType } from '../types'
import { PLACE_TYPE_COLORS, PLACE_TYPE_LABELS } from '../types'

type FilterPanelProps = {
  dates: string[]
  selectedDate: string | 'all'
  onDateChange: (date: string | 'all') => void
  originTypes: PlaceType[]
  selectedOriginTypes: Set<PlaceType>
  onToggleOriginType: (type: PlaceType) => void
  tripCount: number
  stopCount: number
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function FilterPanel({
  dates,
  selectedDate,
  onDateChange,
  originTypes,
  selectedOriginTypes,
  onToggleOriginType,
  tripCount,
  stopCount,
}: FilterPanelProps) {
  return (
    <aside className="filter-panel">
      <p className="filter-summary">
        {tripCount} trips · {stopCount} taps
      </p>

      <section className="filter-block">
        <select
          className="comic-select"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value as string | 'all')}
          aria-label="Day"
        >
          <option value="all">All days ({dates.length})</option>
          {dates.map((date) => (
            <option key={date} value={date}>
              {formatDate(date)}
            </option>
          ))}
        </select>
      </section>

      <section className="filter-block">
        <div className="chip-grid">
          {originTypes.map((type) => {
            const active = selectedOriginTypes.has(type)
            return (
              <button
                key={type}
                type="button"
                className={`type-chip ${active ? 'is-active' : ''}`}
                style={{ '--chip-color': PLACE_TYPE_COLORS[type] } as CSSProperties}
                onClick={() => onToggleOriginType(type)}
              >
                <span className="chip-dot" />
                {PLACE_TYPE_LABELS[type]}
              </button>
            )
          })}
        </div>
      </section>
    </aside>
  )
}
