# Next.js Frontend Integration (Alerts + Screenshots)

This is the complete contract for implementing your Next.js frontend against this video server.

## Goal
- Show all active alerts.
- Show the vehicle each alert belongs to.
- Show screenshots linked to each alert.
- Capture screenshots for all live vehicles/channels every 30s.
- Avoid duplicate alert spam (handled server-side with 60-minute dedupe window).

## Base URL
- `VIDEO_API_BASE=http://<video-server>:3000`
- All endpoints below are relative to this base.

## Realtime Channel
- WebSocket: `ws://<video-server>:3000/ws/alerts`
- Events used by frontend:
  - `new_alert`
  - `screenshot-received`
  - `alert-reminder` (optional)

## Core Endpoints

## 1) Connected Vehicles (for all-vehicle screenshot fanout)
- `GET /api/vehicles/connected`

Response shape:
```json
[
  {
    "id": "221087866173",
    "phone": "221087866173",
    "channels": [
      { "logicalChannel": 1, "type": "video", "hasGimbal": false }
    ],
    "activeStreams": [1]
  }
]
```

Use:
- Build list of capture targets.
- For each vehicle use channels where `type` is `video` or `audio_video`.
- If no channel list, fallback to channel `1`.

## 2) Request Screenshot for One Vehicle/Channel
- `POST /api/vehicles/:id/screenshot`

Body:
```json
{
  "channel": 1,
  "fallback": true,
  "fallbackDelayMs": 600
}
```

Notes:
- Keep `fallback: true` so you still get image via HLS if device `0x0801` image is delayed/missing.

Response:
```json
{
  "success": true,
  "message": "Screenshot requested for vehicle 221087866173, channel 1",
  "fallback": { "ok": true, "imageId": "..." }
}
```

## 3) Recent Screenshots
- `GET /api/screenshots/recent?limit=200&minutes=30`

Response:
```json
{
  "success": true,
  "screenshots": [
    {
      "id": "uuid",
      "device_id": "221087866173",
      "channel": 1,
      "storage_url": "https://...",
      "file_size": 245678,
      "timestamp": "2026-02-15T23:09:08.000Z",
      "alert_id": "ALT-..."
    }
  ],
  "total": 1,
  "count": 1,
  "lastUpdate": "2026-02-15T23:09:09.000Z"
}
```

## 4) Active Alerts
- `GET /api/alerts/active`

Response:
```json
{
  "success": true,
  "alerts": [
    {
      "id": "ALT-...",
      "vehicleId": "221087866173",
      "channel": 1,
      "type": "Driver Fatigue",
      "priority": "high",
      "status": "new",
      "timestamp": "2026-02-15T23:08:00.000Z"
    }
  ],
  "count": 1
}
```

## 5) Alert Detail (includes linked screenshots)
- `GET /api/alerts/:id`

Response:
```json
{
  "success": true,
  "alert": {
    "id": "ALT-...",
    "vehicleId": "221087866173",
    "channel": 1,
    "type": "Driver Fatigue",
    "priority": "high",
    "status": "new",
    "timestamp": "2026-02-15T23:08:00.000Z",
    "screenshots": [
      {
        "id": "img-...",
        "storage_url": "https://...",
        "timestamp": "2026-02-15T23:08:01.000Z"
      }
    ]
  }
}
```

## Optional (recommended)
- `GET /api/alerts/history?device_id=<id>&days=7`
- `GET /api/alerts/stats`
- `GET /api/alerts/:id/signals` (full normalized signal details for precise alert type explanation)
- `GET /health`

## Frontend Flow (exact)

## A) Screenshot cycle (all vehicles/channels every 30s)
1. Call `GET /api/vehicles/connected`.
2. Build unique `(vehicleId, channel)` targets.
3. Parallel call `POST /api/vehicles/:id/screenshot` for each target.
4. After ~1-2s, refresh gallery with `GET /api/screenshots/recent`.

## B) Alerts page data load
1. Call `GET /api/alerts/active`.
2. For each alert, call `GET /api/alerts/:id`.
3. Render:
   - alert type, priority, status, timestamp
   - vehicle id and channel
   - linked screenshots from `alert.screenshots`
4. If `alert.screenshots` is empty, optionally fallback to `recent screenshots` where `alert_id == alert.id`.

## C) Realtime + polling
- Open websocket `/ws/alerts`.
- On `new_alert`: refetch active alerts.
- On `screenshot-received`: refetch affected alert details or current alert list.
- Add fallback polling:
  - alerts check every 30s (`/api/alerts/active`)
  - screenshots refresh every 5-10s (`/api/screenshots/recent`)

## D) Duplicate behavior
- Server suppresses duplicate alerts by signature:
  - `vehicleId + channel + primary alert type`
- Window: **60 minutes**
- Meaning: if same alert comes again within 60 minutes, frontend will not receive a new persisted alert event.

## Data Mapping for Next.js
- Alert vehicle id can appear as `vehicleId` (active alert manager object) or `device_id` (DB rows).
- Use:
  - `const vehicle = alert.vehicleId ?? alert.device_id`
  - `const type = alert.type ?? alert.alert_type`

## Error Handling Rules
- If screenshot request succeeds but no image appears:
  - check `fallback.ok`
  - check `/api/screenshots/recent` rows
  - ignore rows with `storage_url` = `upload-failed` or `local-only`
- If websocket disconnects:
  - keep polling active
  - auto reconnect websocket every 2-3 seconds

## Server Prerequisites (must be true)
- CORS includes your Next.js origin (`src/index.ts`).
- Database connected and writable.
- Storage configured (Supabase env vars if used).
- `ffmpeg` installed (for fallback capture from HLS).
- Vehicles are connected and streaming.

## Minimum Endpoints Frontend Must Use
1. `GET /api/vehicles/connected`
2. `POST /api/vehicles/:id/screenshot`
3. `GET /api/screenshots/recent`
4. `GET /api/alerts/active`
5. `GET /api/alerts/:id`
6. `ws://<host>/ws/alerts`

## Reference in this repo
- `public/screenshot-tester.html` is the working reference implementation for:
  - all-vehicle screenshot requests
  - alert tab rendering
  - websocket + polling refresh behavior