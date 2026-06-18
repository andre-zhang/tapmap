# Local GTFS source files

Place the official TTC GTFS zip here, or let the build script download it:

```bash
npm run gtfs:build
```

This downloads `TTC Routes and Schedules Data.zip` from Toronto Open Data, extracts it under `gtfs-data/ttc/`, and writes a compact route index to `public/gtfs/ttc-index.json`.

To use your own copy instead of downloading:

1. Save the zip as `gtfs-data/ttc.zip`, or
2. Extract the GTFS files into `gtfs-data/ttc/` and run `npm run gtfs:build -- --skip-download`

Source: [TTC Routes and Schedules](https://open.toronto.ca/dataset/ttc-routes-and-schedules/) (Open Government Licence – Toronto)
