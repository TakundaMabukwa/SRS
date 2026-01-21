# Complete API Endpoint Reference

**Base URL:** `http://102.130.118.66:3000`  
**WebSocket:** `ws://102.130.118.66:3000`

---

## 📋 Table of Contents

1. [Vehicles & Streaming](#vehicles--streaming)
2. [Alert Management](#alert-management)
3. [Screenshots & Images](#screenshots--images)
4. [Videos](#videos)
5. [Driver Management](#driver-management)
6. [Dashboard & Analytics](#dashboard--analytics)
7. [System & Health](#system--health)

---

## 🚗 Vehicles & Streaming

### 1. Get All Vehicles
```
GET /api/vehicles
```
**Returns:** List of connected vehicles with channels and active streams
```json
{
  "success": true,
  "data": [
    {
      "id": "221083639541",
      "phone": "221083639541",
      "connected": true,
      "lastHeartbeat": "2026-01-20T18:09:19.000Z",
      "activeStreams": [1, 2],
      "channels": [
        {"logicalChannel": 1, "type": "video", "hasGimbal": false},
        {"logicalChannel": 2, "type": "video", "hasGimbal": false}
      ]
    }
  ]
}
```

### 2. Start Live Video Stream
```
POST /api/vehicles/:id/start-live
Body: { "channel": 1 }
```
**Returns:** Confirmation that video stream started
```json
{
  "success": true,
  "message": "Video stream started for vehicle 221083639541, channel 1"
}
```

### 3. Stop Live Video Stream
```
POST /api/vehicles/:id/stop-live
Body: { "channel": 1 }
```
**Returns:** Confirmation that video stream stopped

### 4. Get Stream Info
```
GET /api/vehicles/:id/stream-info?channel=1
```
**Returns:** Stream metadata (frame count, last frame time, active status)

### 5. Get All Active Streams
```
GET /api/vehicles/:id/streams
```
**Returns:** All active streams for a vehicle with HLS playlist URLs

### 6. Request Screenshot
```
POST /api/vehicles/:id/screenshot
Body: { "channel": 1 }
```
**Returns:** Confirmation that screenshot was requested (arrives via WebSocket)

---

## 🚨 Alert Management

### 7. Get All Alerts
```
GET /api/alerts?status=new&priority=high&limit=100
```
**Query Params:**
- `status`: new, acknowledged, escalated, resolved
- `priority`: low, medium, high, critical
- `limit`: Number of results (default: 100)

**Returns:** List of alerts with full metadata
```json
{
  "success": true,
  "alerts": [
    {
      "id": "ALT-1768925360649-81",
      "device_id": "221083639541",
      "channel": 1,
      "alert_type": "Video Signal Loss",
      "priority": "medium",
      "status": "new",
      "escalation_level": 0,
      "timestamp": "2026-01-20T18:09:19.000Z",
      "latitude": 26.812017,
      "longitude": 26.060046,
      "metadata": {
        "videoAlarms": {"videoSignalLoss": true},
        "signalLossChannels": [1, 2],
        "videoClips": {
          "pre": "/recordings/.../pre.h264",
          "post": "/recordings/.../post.h264"
        }
      }
    }
  ],
  "count": 1
}
```

### 8. Get Alerts by Priority (Grouped)
```
GET /api/alerts/by-priority
```
**Returns:** Alerts grouped by priority level
```json
{
  "success": true,
  "alertsByPriority": {
    "critical": [...],
    "high": [...],
    "medium": [...],
    "low": [...]
  },
  "counts": {
    "critical": 2,
    "high": 5,
    "medium": 3,
    "low": 1,
    "total": 11
  }
}
```

### 9. Get Unattended Alerts
```
GET /api/alerts/unattended?minutes=30
```
**Returns:** Alerts not actioned within threshold
```json
{
  "success": true,
  "unattendedAlerts": [
    {
      "id": "ALT-789",
      "alert_type": "Smoking",
      "priority": "high",
      "minutes_unattended": 45,
      "status": "new"
    }
  ],
  "count": 1,
  "threshold_minutes": 30
}
```

### 10. Get Active Alerts
```
GET /api/alerts/active
```
**Returns:** All non-resolved alerts

### 11. Get Alert by ID
```
GET /api/alerts/:id
```
**Returns:** Single alert with associated screenshots

### 12. Acknowledge Alert
```
POST /api/alerts/:id/acknowledge
Body: { "acknowledgedBy": "operator_john" }
```
**Returns:** Updated alert with acknowledged_at timestamp

### 13. Resolve Alert (with Notes)
```
POST /api/alerts/:id/resolve-with-notes
Body: {
  "notes": "Driver confirmed fatigued. Took 15min break.",
  "resolvedBy": "operator_john"
}
```
**Validation:** Notes must be ≥10 characters  
**Returns:** Updated alert + action record

### 14. Mark as False Alert
```
POST /api/alerts/:id/mark-false
Body: {
  "reason": "Camera glare caused false detection",
  "markedBy": "operator_sarah"
}
```
**Returns:** Alert marked as false in metadata

### 15. Escalate Alert
```
POST /api/alerts/:id/escalate
Body: {
  "reason": "Driver not responding",
  "escalatedBy": "supervisor_mike"
}
```
**Returns:** Alert with incremented escalation_level

### 16. Get Alert History
```
GET /api/alerts/:id/history
```
**Returns:** All actions taken on alert (acknowledged, escalated, resolved)

### 17. Get Alert Statistics
```
GET /api/alerts/stats
```
**Returns:** Alert counts by status, priority, type

---

## 📸 Screenshots & Images

### 18. Get Recent Screenshots
```
GET /api/screenshots/recent?limit=50&minutes=30
```
**Returns:** Recent screenshots with storage URLs
```json
{
  "success": true,
  "screenshots": [
    {
      "id": "uuid-123",
      "device_id": "221083639541",
      "channel": 1,
      "storage_url": "https://supabase.co/storage/...",
      "file_size": 245678,
      "timestamp": "2026-01-20T18:09:19.000Z",
      "alert_id": "ALT-123"
    }
  ],
  "count": 1,
  "lastUpdate": "2026-01-20T18:10:00.000Z"
}
```

### 19. Get All Images
```
GET /api/images?limit=100
```
**Returns:** All images from all vehicles

### 20. Get Vehicle Images
```
GET /api/vehicles/:id/images?limit=50
```
**Returns:** Images for specific vehicle

---

## 🎥 Videos

### 21. Get Alert Videos
```
GET /api/alerts/:id/videos
```
**Returns:** Pre-event, post-event, and camera SD videos for alert
```json
{
  "success": true,
  "alert_id": "ALT-1768925360649-81",
  "videos": {
    "pre_event": {
      "path": "/recordings/.../pre.h264",
      "frames": 450,
      "duration": 30.2,
      "description": "30 seconds before alert"
    },
    "post_event": {
      "path": "/recordings/.../post.h264",
      "frames": 450,
      "duration": 30.1,
      "description": "30 seconds after alert"
    },
    "camera_sd": {
      "path": "/recordings/.../camera.h264",
      "description": "From camera SD card"
    },
    "database_records": [...]
  },
  "total_videos": 2,
  "has_pre_event": true,
  "has_post_event": true,
  "has_camera_video": false
}
```

### 22. Get Alert Video File
```
GET /api/alerts/:id/video
```
**Returns:** Video file (H.264) for download

### 23. Get HLS Playlist
```
GET /api/stream/:vehicleId/:channel/playlist.m3u8
```
**Returns:** HLS playlist for live streaming

### 24. Get HLS Segment
```
GET /api/stream/:vehicleId/:channel/:segment.ts
```
**Returns:** HLS video segment

---

## 👤 Driver Management

### 25. Record Speeding Event
```
POST /api/speeding/record
Body: {
  "vehicleId": "221083639541",
  "driverId": "DRV-12345",
  "speed": 125,
  "speedLimit": 80,
  "latitude": -26.2041,
  "longitude": 28.0473
}
```
**Returns:** Speeding event with severity and demerits applied
```json
{
  "success": true,
  "eventId": "uuid-789",
  "severity": "severe",
  "demerits_applied": -10,
  "speed_over_limit": 45
}
```

### 26. Get Driver Rating
```
GET /api/drivers/:driverId/rating
```
**Returns:** Driver rating, demerits, recent events

### 27. Get Driver Speeding Events
```
GET /api/drivers/:driverId/speeding-events?days=7
```
**Returns:** Speeding events for driver in time period

---

## 📊 Dashboard & Analytics

### 28. Executive Dashboard
```
GET /api/dashboard/executive?days=30
```
**Returns:** Complete analytics for management
```json
{
  "success": true,
  "period": "Last 30 days",
  "data": {
    "alertsByPriority": [
      {"priority": "critical", "count": 12},
      {"priority": "high", "count": 45}
    ],
    "alertsByType": [
      {"alert_type": "Driver Fatigue", "count": 45},
      {"alert_type": "Phone Call", "count": 32}
    ],
    "avgResponseTimeSeconds": "187.50",
    "escalationRate": "3.20%",
    "resolutionRate": "94.50%"
  }
}
```

### 29. Get Server Statistics
```
GET /api/stats
```
**Returns:** Connected vehicles, active streams, frame counts

### 30. Get All Devices
```
GET /api/devices
```
**Returns:** All devices that have connected (from database)

---

## 🔧 System & Health

### 31. Health Check
```
GET /health
```
**Returns:** Server health status

### 32. Get Buffer Status
```
GET /api/buffers/status
```
**Returns:** Circular buffer status for all streams
```json
{
  "success": true,
  "totalBuffers": 5,
  "data": [
    {
      "stream": "221083639541_1",
      "frames": 450,
      "duration": "30.0s",
      "isRecordingPostEvent": false
    }
  ]
}
```

### 33. Get Buffer Statistics
```
GET /api/alerts/buffers/stats
```
**Returns:** Detailed buffer statistics for alert system

---

## 🧪 Testing Endpoints

### 34. Simulate Alert
```
POST /test/simulate-alert
Body: {
  "vehicleId": "221083639541",
  "channel": 1,
  "alertType": "fatigue",
  "fatigueLevel": 85
}
```
**Returns:** Simulated alert for testing video capture

### 35. Test Query Resources
```
POST /api/vehicles/:id/test-query-resources
Body: {
  "channel": 1,
  "minutesBack": 5
}
```
**Returns:** Queries camera for available video files

### 36. Test Playback Request
```
POST /api/vehicles/:id/test-playback
Body: {
  "channel": 1,
  "minutesBack": 1
}
```
**Returns:** Requests video playback from camera

---

## 🔔 WebSocket Events

Connect to: `ws://102.130.118.66:3000`

### Events Received:

1. **new-alert** - New alert created
```json
{
  "type": "new-alert",
  "alert": {
    "id": "ALT-123",
    "alert_type": "Driver Fatigue",
    "priority": "critical",
    "device_id": "221083639541"
  }
}
```

2. **alert-status-changed** - Alert status updated
3. **alert-escalated** - Alert escalated to management
4. **screenshot-received** - Screenshot uploaded
5. **unattended-alerts-reminder** - Reminder for unattended alerts (every 5 min)
6. **video-clip-ready** - Pre/post event video saved

### 37. Start All Streams
```
POST /api/vehicles/:id/start-all-streams
```
**Returns:** Starts all video channels for vehicle

### 38. Stop All Streams
```
POST /api/vehicles/:id/stop-all-streams
```
**Returns:** Stops all active streams for vehicle

### 39. Query Capabilities
```
POST /api/vehicles/:id/query-capabilities
```
**Returns:** Queries camera capabilities (channels, encoding)

### 40. Serve Media Files
```
GET /api/media/:vehicleId/:filename?download=true
```
**Returns:** Media file (image/video) for download or display

---

## 📝 Quick Reference

| Category | Endpoint Count |
|----------|----------------|
| Vehicles & Streaming | 10 |
| Alert Management | 15 |
| Screenshots | 3 |
| Videos | 4 |
| Driver Management | 3 |
| Dashboard | 3 |
| System & Health | 3 |
| Testing | 3 |
| **Total** | **40 endpoints** |

---

## 🔑 Common Query Parameters

- `limit` - Number of results (default varies by endpoint)
- `status` - Filter by status (new, acknowledged, escalated, resolved)
- `priority` - Filter by priority (low, medium, high, critical)
- `days` - Time period in days
- `minutes` - Time period in minutes
- `channel` - Camera channel number (1-32)

---

## ⚠️ Important Notes

1. **No Authentication** - Currently no auth required (add JWT in production)
2. **CORS** - Enabled for all origins
3. **File Size Limits** - Supabase uploads limited to 50MB
4. **WebSocket** - Real-time updates for alerts and screenshots
5. **Video Format** - H.264 raw format, convert to HLS for browser playback
6. **Timestamps** - All in UTC (ISO 8601 format)
7. **Cleanup** - Automatic cleanup runs hourly (deletes files >1 hour old)
