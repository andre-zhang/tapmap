# PRESTO Tap Map

Map your PRESTO card tap history onto **OpenStreetMap**. Import a transaction CSV, filter by day and trip origin type, and see where you've been.

## Run locally

```bash
npm install
npm run gtfs:build   # download TTC GTFS + build route-shape index (one-time, ~1 min)
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Click **Try sample data** to load the included demo CSV, or upload your own PRESTO export.

### GTFS route shapes

Trips are drawn along **actual TTC route geometry** when a local GTFS index is present:

1. `npm run gtfs:build` downloads [TTC Routes and Schedules](https://open.toronto.ca/dataset/ttc-routes-and-schedules/) into `gtfs-data/` and writes `public/gtfs/ttc-index.json`.
2. PRESTO tap locations are matched to GTFS stops (by stop code or name).
3. Consecutive taps are connected using precomputed shape segments from `shapes.txt` + `stop_times.txt`.
4. Unmatched legs (e.g. UP Express) fall back to dashed straight lines.

To use your own GTFS zip instead of downloading, see `gtfs-data/README.md`.

## CSV format

The parser accepts PRESTO **Transaction History** exports from [prestocard.ca](https://www.prestocard.ca) and the bundled sample format. Typical columns:

| Date | Transit Agency | Location | Type |
|------|----------------|----------|------|

Dates may include a time (`11/2/2018 11:31:00 AM`) or a day-month-year label (`17 June 2024`). Travel rows (`Fare Payment`, `Free Transfer`, `Tap On`, `Tap Off`, etc.) are mapped. Balance loads and other non-travel rows are skipped.

A **Transit Usage Report** (tax report) has no stop locations and cannot be mapped — export Transaction History instead.

## How trips work

- A new trip starts on **Fare Payment** or **Tap On**.
- **Free Transfer** and **Tap Off** taps continue the same trip.
- Trip **origin type** is inferred from the first tap (subway, train/UPX, bus, streetcar, intersection, other).
- Stops are geocoded from TTC GTFS when available, then a built-in GTA station lookup, then OpenStreetMap Nominatim (cached in your browser).

## Stack

- React 18 + TypeScript + Vite
- Leaflet + react-leaflet (OSM tiles)
- Papa Parse for CSV

## Privacy

CSV files are parsed in your browser only. Geocode results are cached in `localStorage`. No data is sent to a backend.
