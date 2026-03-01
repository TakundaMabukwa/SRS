# Trip Routing Alert Media: Backend Requirements

## Current readiness

The frontend can already pull:

- `GET /api/alerts/active`
- `GET /api/alerts/:id`
- `GET /api/alerts/:id/videos`
- `GET /api/alerts/:id/screenshots`
- WebSocket events on `/ws/alerts`

This is enough for basic operation, but not enough for low-latency control room workflows.

## Required backend adjustments

### 1. Add a single "media bundle" endpoint

Add:

- `GET /api/alerts/:id/media-bundle`

Response must include:

- alert core fields
- normalized screenshots array
- normalized videos array
- latest video request state
- optional recent history entries

Suggested payload:

```json
{
  "success": true,
  "alert": {
    "id": "ALT-123",
    "device_id": "221083631472",
    "channel": 1,
    "alert_type": "ADAS: Pedestrian collision alarm",
    "priority": "critical",
    "status": "new",
    "timestamp": "2026-02-28T12:00:00.000Z"
  },
  "screenshots": [
    {
      "id": "uuid-1",
      "channel": 1,
      "timestamp": "2026-02-28T12:00:01.000Z",
      "storage_url": "https://..."
    }
  ],
  "videos": {
    "pre_event": { "path": "/...", "duration": 29.8, "ready": true },
    "post_event": { "path": "/...", "duration": 30.0, "ready": true },
    "camera_sd": { "path": "/...", "ready": true }
  },
  "request_state": {
    "query_sent": true,
    "request_sent": true,
    "download_sent": false,
    "job_id": "job-123",
    "job_status": "processing"
  },
  "history": []
}
```

### 2. Emit deterministic websocket event names

For every media lifecycle action emit one of:

- `alert-created`
- `alert-updated`
- `screenshot-received`
- `screenshot-linked`
- `video-clip-ready`
- `alert-media-updated`

Each event should include at least:

- `alert.id`
- `device_id`
- `channel`
- `timestamp`

### 3. Guarantee screenshot linkage by alert ID

When screenshot is uploaded, backend should:

1. persist screenshot record,
2. link `alert_id`,
3. then emit websocket event.

This order prevents frontend showing "alert with no screenshots" when image exists but relation is delayed.

### 4. Normalize data shape across endpoints

Keep fields identical between:

- `/alerts/:id`
- `/alerts/:id/screenshots`
- `/alerts/:id/videos`
- `/alerts/:id/media-bundle`

Use one canonical schema:

- `id`, `device_id`, `channel`, `alert_type`, `priority`, `status`, `timestamp`
- screenshot fields: `id`, `alert_id`, `channel`, `timestamp`, `storage_url`
- video fields: `pre_event`, `post_event`, `camera_sd` with `{ path, duration, ready }`

### 5. Add server-side dedupe guard

To avoid repeated duplicates in control room:

- dedupe key: `(device_id, channel, alarm_code, time_bucket)`
- default `time_bucket = 300s` for non-critical
- bypass dedupe for `critical`

### 6. Support immediate "fetch-on-click" with no stale cache

For all alert/media endpoints, return:

- `Cache-Control: no-store`

and ensure DB reads are latest state.

## Optional but recommended

- `POST /api/alerts/:id/request-all-media`:
  - request screenshot(s) and video in one call
  - return request tracking metadata
- include `media_counts` directly on `/alerts/active` rows for fast list rendering.

