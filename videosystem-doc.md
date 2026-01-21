# JT/T 1078 Video Ingestion System - Complete Documentation

## System Overview

A Node.js TypeScript server for receiving and processing JT/T 1078 video streams from AI telematics cameras with real-time alert detection and management.

**Server:** http://baseUrl:3000  
**Ports:** TCP 7611 (JT/T 808), UDP 6611 (JT/T 1078)

---

## Database Schema

### PostgreSQL Tables

#### 1. devices
```sql
CREATE TABLE devices (
  device_id TEXT PRIMARY KEY,           -- Phone number
  ip_address TEXT,
  last_seen TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. alerts
```sql
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,                  -- Format: ALT-timestamp-counter
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  channel INTEGER NOT NULL,
  alert_type TEXT NOT NULL,             -- 'Driver Fatigue', 'Phone Call While Driving', etc.
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'escalated', 'resolved')),
  escalation_level INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  metadata JSONB,                       -- Full alert details
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. videos
```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  channel INTEGER NOT NULL,
  file_path TEXT NOT NULL,              -- Local disk path
  storage_url TEXT,                     -- Supabase public URL
  file_size BIGINT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  video_type TEXT NOT NULL CHECK (video_type IN ('live', 'alert_pre', 'alert_post')),
  alert_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. images
```sql
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  channel INTEGER NOT NULL,
  file_path TEXT NOT NULL,              -- Supabase path
  storage_url TEXT,                     -- Supabase public URL
  file_size BIGINT,
  timestamp TIMESTAMPTZ NOT NULL,
  alert_id TEXT REFERENCES alerts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Relationships
```
devices (1) ──→ (N) alerts
devices (1) ──→ (N) videos
devices (1) ──→ (N) images
alerts (1) ──→ (N) videos (via alert_id)
alerts (1) ──→ (N) images (via alert_id)
```

---

## Alert Types

### Driver Behavior Alerts
1. **Driver Fatigue** - CRITICAL (level > 80) or HIGH
2. **Phone Call While Driving** - HIGH
3. **Smoking While Driving** - HIGH

### Video System Alerts
4. **Video Signal Loss** - MEDIUM
5. **Video Signal Blocked** - MEDIUM
6. **Storage Failure** - HIGH
7. **Bus Overcrowding** - MEDIUM

### Alert Detection
- Source: 0x0200 location report additional info fields
- Field 0x14: Video alarms
- Field 0x15: Signal loss channels
- Field 0x16: Signal blocking channels
- Field 0x18: Abnormal driving behavior

### Alert Status Flow
```
new → acknowledged → resolved
  ↓
escalated (5min) → escalated (10min → management)
```

---

## API Endpoints

### Base URL
```
Production: http://baseUrl:3000
Local: http://localhost:3000
```

### Alerts

#### GET /api/alerts
Get all alerts with filtering
```bash
curl "http://baseUrl:3000/api/alerts?priority=critical&status=new&limit=50"
```
**Query params:** priority, status, device_id, limit (default 100)

#### GET /api/alerts/by-priority
Get alerts grouped by priority (unresolved only)
```bash
curl "http://baseUrl:3000/api/alerts/by-priority"
```

#### GET /api/alerts/by-device
Get alerts grouped by device with statistics
```bash
curl "http://baseUrl:3000/api/alerts/by-device"
```

#### GET /api/alerts/history
Get complete alert history
```bash
curl "http://baseUrl:3000/api/alerts/history?device_id=221084138949&days=7"
```

#### GET /api/alerts/unresolved
Get unresolved alerts with time open
```bash
curl "http://baseUrl:3000/api/alerts/unresolved"
```

#### GET /api/alerts/driver-behavior
Get driver behavior alerts only
```bash
curl "http://baseUrl:3000/api/alerts/driver-behavior"
```

#### GET /api/alerts/:id
Get single alert details
```bash
curl "http://baseUrl:3000/api/alerts/ALT-123456"
```

#### GET /api/alerts/:id/media
Get alert with screenshots and videos
```bash
curl "http://baseUrl:3000/api/alerts/ALT-123456/media"
```

#### POST /api/alerts/:id/acknowledge
Acknowledge alert
```bash
curl -X POST "http://baseUrl:3000/api/alerts/ALT-123456/acknowledge"
```

#### POST /api/alerts/:id/resolve
Resolve alert
```bash
curl -X POST "http://baseUrl:3000/api/alerts/ALT-123456/resolve"
```

### Screenshots

#### GET /api/alerts/screenshots/all
Get all screenshots (auto-refresh support)
```bash
curl "http://baseUrl:3000/api/alerts/screenshots/all?limit=50&alert_only=true"
```

### Vehicles

#### GET /api/vehicles
Get all connected vehicles
```bash
curl "http://baseUrl:3000/api/vehicles"
```

#### GET /api/devices
Get all devices from database
```bash
curl "http://baseUrl:3000/api/devices"
```

#### GET /api/vehicles/:id/images
Get images for specific vehicle
```bash
curl "http://baseUrl:3000/api/vehicles/221084138949/images?limit=50"
```

#### POST /api/vehicles/:id/screenshot
Request screenshot from vehicle
```bash
curl -X POST "http://baseUrl:3000/api/vehicles/221084138949/screenshot" \
  -H "Content-Type: application/json" \
  -d '{"channel": 1}'
```

### Images

#### GET /api/images
Get all images from all vehicles
```bash
curl "http://baseUrl:3000/api/images?limit=100"
```

---

## Data Schemas

### Alert Object
```json
{
  "id": "ALT-1736412600000-1",
  "device_id": "221084138949",
  "channel": 1,
  "alert_type": "Driver Fatigue",
  "priority": "critical",
  "status": "new",
  "escalation_level": 0,
  "timestamp": "2024-01-15T10:30:00Z",
  "latitude": 28.138160,
  "longitude": 27.120556,
  "acknowledged_at": null,
  "resolved_at": null,
  "metadata": {
    "vehicleId": "221084138949",
    "drivingBehavior": {
      "fatigue": true,
      "fatigueLevel": 85,
      "phoneCall": false,
      "smoking": false
    },
    "videoAlarms": {
      "videoSignalLoss": false,
      "storageFailure": false
    }
  },
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Device Object
```json
{
  "device_id": "221084138949",
  "ip_address": "41.13.208.136",
  "last_seen": "2024-01-15T10:30:00Z"
}
```

### Image Object
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "device_id": "221084138949",
  "channel": 1,
  "file_path": "221084138949/ch1/2024-01-15T10-30-00.jpg",
  "storage_url": "https://kxtykpuxlsvrwcaumuqm.supabase.co/storage/v1/object/public/jtt1078-media/221084138949/ch1/2024-01-15T10-30-00.jpg",
  "file_size": 45678,
  "timestamp": "2024-01-15T10:30:00Z",
  "alert_id": "ALT-1736412600000-1",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Video Object
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "device_id": "221084138949",
  "channel": 1,
  "file_path": "recordings/221084138949/channel_1_20240115103000.h264",
  "storage_url": "https://kxtykpuxlsvrwcaumuqm.supabase.co/storage/v1/object/public/jtt1078-media/221084138949/ch1/2024-01-15T10-30-00.h264",
  "file_size": 1234567,
  "start_time": "2024-01-15T10:29:30Z",
  "end_time": "2024-01-15T10:30:30Z",
  "duration_seconds": 60,
  "video_type": "alert_pre",
  "alert_id": "ALT-1736412600000-1",
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## WebSocket Real-Time Notifications

### Connection
```javascript
const ws = new WebSocket('ws://baseUrl:3000/ws/alerts');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log(message.type, message.data);
};
```

### Events

#### alert
```json
{
  "type": "alert",
  "data": { ...Alert }
}
```

#### alert-acknowledged
```json
{
  "type": "alert-acknowledged",
  "data": { ...Alert }
}
```

#### alert-escalated
```json
{
  "type": "alert-escalated",
  "data": { ...Alert }
}
```

#### alert-resolved
```json
{
  "type": "alert-resolved",
  "data": { ...Alert }
}
```

#### notification
```json
{
  "type": "notification",
  "data": {
    "title": "🚨 CRITICAL Alert",
    "message": "Driver Fatigue detected",
    "priority": "critical"
  }
}
```

---

## Storage Architecture

### Supabase Storage
- **Bucket:** jtt1078-media (auto-created if not exists)
- **Images:** `<deviceId>/ch<channel>/<timestamp>.jpg`
- **Videos:** `<deviceId>/ch<channel>/<timestamp>.h264`
- **Access:** Public URLs via CDN

### Local Disk (Temporary)
- **Videos:** `recordings/<vehicleId>/channel_<N>_<timestamp>.h264`
- **Purpose:** Initial write, then uploaded to Supabase

### Data Flow

#### Alert Detection
1. 0x0200 location report received
2. Parse alert fields (0x14-0x18)
3. Create alert in database
4. Request screenshot (0x9201)
5. Request 30s pre/post video (0x9201)
6. Save media with alert_id

#### Image Upload
1. 0x0801 multimedia message received
2. Parse JPEG data (handle fragments)
3. Upload to Supabase Storage
4. Save metadata to database

#### Video Recording
1. Video stream starts
2. Write to local disk
3. Upload to Supabase
4. Update database with storage_url

---

## Protocol Support

### JT/T 808 (TCP:7611)
- 0x0100: Terminal registration
- 0x0102: Terminal authentication
- 0x0002: Heartbeat
- 0x0200: Location report (with alert data)
- 0x0800: Multimedia event
- 0x0801: Multimedia data

### JT/T 1078 (UDP:6611)
- RTP video stream reception
- Frame reassembly
- H.264 video extraction

### Commands Sent
- 0x9101: Start live video (not supported by cameras)
- 0x9201: Screenshot/playback request
- 0x9205: Query resource list (SD card videos)

---

## Features Implemented

✅ Real-time alert detection from location reports  
✅ 7 alert types with priority levels  
✅ Automatic screenshot capture on alert  
✅ 30s before + 30s after video recording  
✅ Alert escalation (5min → 10min)  
✅ Bell notifications via WebSocket  
✅ Screenshots auto-refresh (30s polling)  
✅ Alerts grouped by priority/device  
✅ Complete alert history  
✅ PostgreSQL database storage  
✅ Supabase Storage for media  
✅ REST API for all operations  

---

## Quick Start

### Installation
```bash
npm install
npm run build
```

### Environment Variables
```env
# Supabase
SUPABASE_URL=https://kxtykpuxlsvrwcaumuqm.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key

# PostgreSQL
DB_HOST=baseUrl
DB_PORT=5432
DB_NAME=video_data
DB_USER=vik
DB_PASSWORD="your_password"

# Server
TCP_PORT=7611
UDP_PORT=6611
API_PORT=3000
```

### Run
```bash
npm start
# or with PM2
pm2 start dist/index.js --name video-server -i max
```

### Database Setup
```bash
psql -h baseUrl -U vik -d video_data -f schema.sql
```

---

## Testing

### Check Server Health
```bash
curl http://baseUrl:3000/health
```

### Get Connected Vehicles
```bash
curl http://baseUrl:3000/api/vehicles
```

### Get Active Alerts
```bash
curl http://baseUrl:3000/api/alerts/unresolved
```

### Request Screenshot
```bash
curl -X POST http://baseUrl:3000/api/vehicles/221084138949/screenshot \
  -H "Content-Type: application/json" \
  -d '{"channel": 1}'
```

---

## Error Responses

All endpoints return errors in this format:
```json
{
  "success": false,
  "message": "Error description"
}
```

**HTTP Status Codes:**
- 200: Success
- 404: Resource not found
- 500: Server error

---

## Support

For issues or questions, check the logs:
```bash
pm2 logs video-server
```

Monitor database:
```bash
psql -h baseUrl -U vik -d video_data
```


[
  {
    "page": "dashboard",
    "actions": [
      "view",
      "create",
      "edit",
      "delete"
    ]
  },
  {
    "page": "fleetJobs",
    "actions": [
      "view",
      "create",
      "edit",
      "delete"
    ]
  },
  {
    "page": "drivers",
    "actions": [
      "view",
      "create",
      "edit",
      "delete"
    ]
  },
  {
    "page": "vehicles",
    "actions": [
      "view",
      "create",
      "edit",
      "delete"
    ]
  },
  {
    "page": "financials",
    "actions": [
      "view",
      "create",
      "edit",
      "delete"
    ]
  },
  {
    "page": "inspections",
    "actions": [
      "view",
      "create",
      "edit",
      "delete"
    ]
  },
  {
    "page": "userManagement",
    "actions": [
      "view",
      "create",
      "edit",
      "delete"
    ]
  },
  {
    "page": "systemSettings",
    "actions": [
      "view",
      "create",
      "edit",
      "delete"
    ]
  }
]