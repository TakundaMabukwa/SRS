# Frontend API Documentation - Alert Management System

**Base URL:** `http://localhost:3000`  
**WebSocket URL:** `ws://localhost:3000`

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Alert Management](#alert-management)
3. [Screenshot Management](#screenshot-management)
4. [Driver Rating System](#driver-rating-system)
5. [Executive Dashboard](#executive-dashboard)
6. [WebSocket Events](#websocket-events)
7. [Frontend Requirements Mapping](#frontend-requirements-mapping)

---

## 🔐 Authentication

Currently no authentication required. Add JWT tokens in future:
```javascript
headers: {
  'Authorization': 'Bearer <token>',
  'Content-Type': 'application/json'
}
```

---

## 🚨 Alert Management

### 1. Get All Alerts

**Endpoint:** `GET /api/alerts`

**Query Parameters:**
- `status` (optional): `new`, `acknowledged`, `escalated`, `resolved`
- `priority` (optional): `low`, `medium`, `high`, `critical`
- `limit` (optional): Number of results (default: 100)

**Response:**
```json
{
  "success": true,
  "alerts": [
    {
      "id": "ALT-1768814338167-12",
      "device_id": "221084138949",
      "channel": 3,
      "alert_type": "Driver Fatigue",
      "priority": "critical",
      "status": "new",
      "escalation_level": 0,
      "timestamp": "2026-01-19T11:19:03.000Z",
      "latitude": 26.177227,
      "longitude": 28.119656,
      "acknowledged_at": null,
      "resolved_at": null,
      "metadata": {
        "drivingBehavior": {
          "fatigue": true,
          "fatigueLevel": 85
        },
        "videoClips": {
          "pre": "/recordings/221084138949/alerts/ALT-xxx_ch3_pre_1737282338000.h264",
          "post": "/recordings/221084138949/alerts/ALT-xxx_ch3_post_1737282368000.h264",
          "preFrameCount": 450,
          "postFrameCount": 450,
          "preDuration": 30.2,
          "postDuration": 30.1
        }
      },
      "created_at": "2026-01-19T11:19:03.000Z"
    }
  ],
  "count": 1
}
```

**Frontend Usage:**
```javascript
// Get all new alerts
const response = await fetch('/api/alerts?status=new');
const data = await response.json();

// Get critical priority alerts
const critical = await fetch('/api/alerts?priority=critical');
```

---

### 2. Get Alerts by Priority (Grouped)

**Endpoint:** `GET /api/alerts/by-priority`

**Response:**
```json
{
  "success": true,
  "alertsByPriority": {
    "critical": [
      {
        "id": "ALT-123",
        "alert_type": "Driver Fatigue",
        "device_id": "221084138949",
        "timestamp": "2026-01-19T11:19:03.000Z"
      }
    ],
    "high": [
      {
        "id": "ALT-456",
        "alert_type": "Phone Call",
        "device_id": "221084138950",
        "timestamp": "2026-01-19T11:20:00.000Z"
      }
    ],
    "medium": [],
    "low": []
  },
  "counts": {
    "critical": 1,
    "high": 1,
    "medium": 0,
    "low": 0,
    "total": 2
  }
}
```

**Frontend Usage:**
```javascript
// Display alerts grouped by priority
const response = await fetch('/api/alerts/by-priority');
const { alertsByPriority, counts } = await response.json();

// Show badge counts
document.getElementById('critical-badge').textContent = counts.critical;
document.getElementById('high-badge').textContent = counts.high;
```

---

### 3. Get Unattended Alerts

**Endpoint:** `GET /api/alerts/unattended`

**Query Parameters:**
- `minutes` (optional): Threshold in minutes (default: 30)

**Response:**
```json
{
  "success": true,
  "unattendedAlerts": [
    {
      "id": "ALT-789",
      "alert_type": "Smoking",
      "priority": "high",
      "device_id": "221084138949",
      "timestamp": "2026-01-19T10:30:00.000Z",
      "minutes_unattended": 45,
      "status": "new"
    }
  ],
  "count": 1,
  "threshold_minutes": 30
}
```

**Frontend Usage:**
```javascript
// Check for alerts unattended > 30 minutes
const response = await fetch('/api/alerts/unattended?minutes=30');
const { unattendedAlerts, count } = await response.json();

if (count > 0) {
  showNotification(`${count} alerts need attention!`);
}
```

---

### 4. Acknowledge Alert

**Endpoint:** `POST /api/alerts/:id/acknowledge`

**Request Body:**
```json
{
  "acknowledgedBy": "operator_john"
}
```

**Response:**
```json
{
  "success": true,
  "alert": {
    "id": "ALT-123",
    "status": "acknowledged",
    "acknowledged_at": "2026-01-19T11:25:00.000Z"
  }
}
```

**Frontend Usage:**
```javascript
async function acknowledgeAlert(alertId, operatorName) {
  const response = await fetch(`/api/alerts/${alertId}/acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acknowledgedBy: operatorName })
  });
  return response.json();
}
```

---

### 5. Resolve Alert (with Required Notes)

**Endpoint:** `POST /api/alerts/:id/resolve-with-notes`

**Request Body:**
```json
{
  "notes": "Driver was confirmed fatigued. Instructed to take 15-minute break. Supervisor notified.",
  "resolvedBy": "operator_john"
}
```

**Validation:**
- `notes` must be at least 10 characters
- `resolvedBy` is required

**Response:**
```json
{
  "success": true,
  "alert": {
    "id": "ALT-123",
    "status": "resolved",
    "resolved_at": "2026-01-19T11:30:00.000Z"
  },
  "action": {
    "id": "uuid-here",
    "alert_id": "ALT-123",
    "action_type": "resolved",
    "notes": "Driver was confirmed fatigued...",
    "performed_by": "operator_john",
    "timestamp": "2026-01-19T11:30:00.000Z"
  }
}
```

**Frontend Usage:**
```javascript
async function resolveAlert(alertId, notes, operator) {
  if (notes.length < 10) {
    alert('Notes must be at least 10 characters');
    return;
  }
  
  const response = await fetch(`/api/alerts/${alertId}/resolve-with-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes, resolvedBy: operator })
  });
  return response.json();
}
```

---

### 6. Mark as False Alert

**Endpoint:** `POST /api/alerts/:id/mark-false`

**Request Body:**
```json
{
  "reason": "Camera glare caused false fatigue detection. Driver was alert and responsive.",
  "markedBy": "operator_sarah"
}
```

**Response:**
```json
{
  "success": true,
  "alert": {
    "id": "ALT-123",
    "status": "resolved",
    "metadata": {
      "falseAlert": true,
      "falseAlertReason": "Camera glare caused false fatigue detection..."
    }
  }
}
```

**Frontend Usage:**
```javascript
async function markFalseAlert(alertId, reason, operator) {
  const response = await fetch(`/api/alerts/${alertId}/mark-false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, markedBy: operator })
  });
  return response.json();
}
```

---

### 7. Escalate Alert

**Endpoint:** `POST /api/alerts/:id/escalate`

**Request Body:**
```json
{
  "reason": "Driver not responding to multiple warnings",
  "escalatedBy": "supervisor_mike"
}
```

**Response:**
```json
{
  "success": true,
  "alert": {
    "id": "ALT-123",
    "status": "escalated",
    "escalation_level": 1
  }
}
```

---

### 8. Get Alert History

**Endpoint:** `GET /api/alerts/:id/history`

**Response:**
```json
{
  "success": true,
  "alert": {
    "id": "ALT-123",
    "alert_type": "Driver Fatigue",
    "created_at": "2026-01-19T11:19:03.000Z"
  },
  "actions": [
    {
      "id": "uuid-1",
      "action_type": "acknowledged",
      "performed_by": "operator_john",
      "timestamp": "2026-01-19T11:20:00.000Z",
      "notes": null
    },
    {
      "id": "uuid-2",
      "action_type": "escalated",
      "performed_by": "supervisor_mike",
      "timestamp": "2026-01-19T11:25:00.000Z",
      "notes": "Driver not responding"
    },
    {
      "id": "uuid-3",
      "action_type": "resolved",
      "performed_by": "manager_lisa",
      "timestamp": "2026-01-19T11:35:00.000Z",
      "notes": "Driver pulled over and took mandatory rest"
    }
  ]
}
```

---

## 📸 Screenshot Management

### 9. Request Screenshot

**Endpoint:** `POST /api/vehicles/:id/screenshot`

**Request Body:**
```json
{
  "channel": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Screenshot requested from vehicle 221084138949 channel 1"
}
```

**Note:** Screenshot arrives asynchronously via WebSocket event `screenshot-received`

---

### 10. Get Recent Screenshots

**Endpoint:** `GET /api/screenshots/recent`

**Query Parameters:**
- `limit` (optional): Number of results (default: 50)
- `minutes` (optional): Last N minutes (default: 30)

**Response:**
```json
{
  "success": true,
  "screenshots": [
    {
      "id": "uuid-123",
      "device_id": "221084138949",
      "channel": 1,
      "file_path": "/recordings/221084138949/screenshots/screenshot_1737282400000.jpg",
      "storage_url": "https://supabase.co/storage/v1/object/public/screenshots/...",
      "file_size": 245678,
      "timestamp": "2026-01-19T11:20:00.000Z",
      "alert_id": "ALT-123",
      "created_at": "2026-01-19T11:20:05.000Z"
    }
  ],
  "count": 1
}
```

**Frontend Usage (Auto-refresh every 30s):**
```javascript
async function loadScreenshots() {
  const response = await fetch('/api/screenshots/recent?minutes=30');
  const { screenshots } = await response.json();
  
  // Display screenshots
  screenshots.forEach(img => {
    displayScreenshot(img.storage_url, img.timestamp, img.alert_id);
  });
}

// Auto-refresh every 30 seconds
setInterval(loadScreenshots, 30000);
loadScreenshots(); // Initial load
```

---

### 11. Get Screenshots for Alert

**Endpoint:** `GET /api/alerts/:id/screenshots`

**Response:**
```json
{
  "success": true,
  "alert_id": "ALT-123",
  "screenshots": [
    {
      "id": "uuid-456",
      "file_path": "/recordings/221084138949/screenshots/screenshot_1737282400000.jpg",
      "storage_url": "https://...",
      "timestamp": "2026-01-19T11:20:00.000Z"
    }
  ],
  "count": 1
}
```

---

## 🚗 Driver Rating System

### 12. Record Speeding Event

**Endpoint:** `POST /api/speeding/record`

**Request Body:**
```json
{
  "driverId": "DRV-12345",
  "deviceId": "221084138949",
  "speedLimit": 80,
  "actualSpeed": 125,
  "location": "N1 Highway, Johannesburg",
  "latitude": -26.2041,
  "longitude": 28.0473
}
```

**Response:**
```json
{
  "success": true,
  "event": {
    "id": "uuid-789",
    "driver_id": "DRV-12345",
    "severity": "severe",
    "demerits_applied": -10,
    "speed_over_limit": 45,
    "timestamp": "2026-01-19T11:30:00.000Z"
  },
  "driver": {
    "id": "DRV-12345",
    "name": "John Doe",
    "current_rating": 90,
    "total_demerits": -10
  },
  "reportGenerated": false
}
```

**Severity Calculation:**
- **Severe** (>40 km/h over): -10 demerits
- **Moderate** (20-40 km/h over): -5 demerits
- **Minor** (<20 km/h over): -2 demerits

---

### 13. Get Driver Rating

**Endpoint:** `GET /api/drivers/:id/rating`

**Response:**
```json
{
  "success": true,
  "driver": {
    "id": "DRV-12345",
    "name": "John Doe",
    "license_number": "ABC123456",
    "current_rating": 85,
    "total_demerits": -15,
    "created_at": "2026-01-01T00:00:00.000Z"
  },
  "recentEvents": [
    {
      "id": "uuid-1",
      "severity": "severe",
      "speed_limit": 80,
      "actual_speed": 125,
      "demerits_applied": -10,
      "timestamp": "2026-01-19T11:30:00.000Z"
    },
    {
      "id": "uuid-2",
      "severity": "minor",
      "speed_limit": 60,
      "actual_speed": 75,
      "demerits_applied": -5,
      "timestamp": "2026-01-18T09:15:00.000Z"
    }
  ],
  "eventCount": 2
}
```

---

### 14. Get Driver Speeding Events

**Endpoint:** `GET /api/drivers/:id/speeding-events`

**Query Parameters:**
- `days` (optional): Last N days (default: 30)

**Response:**
```json
{
  "success": true,
  "driver_id": "DRV-12345",
  "events": [
    {
      "id": "uuid-1",
      "severity": "severe",
      "speed_limit": 80,
      "actual_speed": 125,
      "speed_over_limit": 45,
      "location": "N1 Highway",
      "latitude": -26.2041,
      "longitude": 28.0473,
      "demerits_applied": -10,
      "timestamp": "2026-01-19T11:30:00.000Z"
    }
  ],
  "count": 1,
  "period_days": 30
}
```

---

## 📊 Executive Dashboard

### 15. Get Executive Dashboard Data

**Endpoint:** `GET /api/dashboard/executive`

**Query Parameters:**
- `days` (optional): Time period (default: 30)

**Response:**
```json
{
  "success": true,
  "period": {
    "days": 30,
    "start": "2025-12-20T00:00:00.000Z",
    "end": "2026-01-19T23:59:59.999Z"
  },
  "summary": {
    "totalAlerts": 156,
    "resolvedAlerts": 142,
    "unresolvedAlerts": 14,
    "falseAlerts": 8,
    "averageResolutionTimeMinutes": 12.5,
    "escalatedAlerts": 5
  },
  "byPriority": {
    "critical": 12,
    "high": 45,
    "medium": 67,
    "low": 32
  },
  "byType": {
    "Driver Fatigue": 45,
    "Phone Call": 32,
    "Smoking": 28,
    "Distraction": 23,
    "Storage Failure": 15,
    "Signal Loss": 13
  },
  "byStatus": {
    "new": 8,
    "acknowledged": 6,
    "escalated": 5,
    "resolved": 137
  },
  "timeline": [
    {
      "date": "2026-01-19",
      "total": 12,
      "critical": 2,
      "high": 5,
      "medium": 3,
      "low": 2
    },
    {
      "date": "2026-01-18",
      "total": 15,
      "critical": 3,
      "high": 6,
      "medium": 4,
      "low": 2
    }
  ],
  "topVehicles": [
    {
      "device_id": "221084138949",
      "alert_count": 23,
      "critical_count": 5
    },
    {
      "device_id": "221084138950",
      "alert_count": 18,
      "critical_count": 3
    }
  ],
  "performance": {
    "averageAcknowledgmentTimeMinutes": 3.2,
    "averageResolutionTimeMinutes": 12.5,
    "falseAlertRate": 5.1,
    "escalationRate": 3.2
  }
}
```

**Frontend Usage:**
```javascript
async function loadDashboard(days = 30) {
  const response = await fetch(`/api/dashboard/executive?days=${days}`);
  const data = await response.json();
  
  // Display KPIs
  document.getElementById('total-alerts').textContent = data.summary.totalAlerts;
  document.getElementById('avg-resolution').textContent = 
    `${data.summary.averageResolutionTimeMinutes.toFixed(1)} min`;
  
  // Render charts
  renderPriorityChart(data.byPriority);
  renderTimelineChart(data.timeline);
  renderTypeDistribution(data.byType);
}
```

---

## 🔔 WebSocket Events

**Connect to WebSocket:**
```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  console.log('Connected to alert system');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleWebSocketEvent(data);
};
```

### Event Types:

#### 1. New Alert
```json
{
  "type": "new-alert",
  "alert": {
    "id": "ALT-123",
    "alert_type": "Driver Fatigue",
    "priority": "critical",
    "device_id": "221084138949",
    "timestamp": "2026-01-19T11:19:03.000Z"
  }
}
```

**Frontend Action:** Show bell notification, play sound, add to alert list

---

#### 2. Alert Status Changed
```json
{
  "type": "alert-status-changed",
  "alert": {
    "id": "ALT-123",
    "status": "acknowledged",
    "acknowledged_at": "2026-01-19T11:20:00.000Z"
  }
}
```

**Frontend Action:** Update alert card status

---

#### 3. Alert Escalated
```json
{
  "type": "alert-escalated",
  "alert": {
    "id": "ALT-123",
    "escalation_level": 1,
    "priority": "critical"
  }
}
```

**Frontend Action:** Show escalation notification to management

---

#### 4. Screenshot Received
```json
{
  "type": "screenshot-received",
  "image": {
    "id": "uuid-456",
    "device_id": "221084138949",
    "channel": 1,
    "storage_url": "https://...",
    "timestamp": "2026-01-19T11:20:00.000Z",
    "alert_id": "ALT-123"
  }
}
```

**Frontend Action:** Add screenshot to gallery, refresh screenshot page

---

#### 5. Unattended Alerts Reminder
```json
{
  "type": "unattended-alerts-reminder",
  "unattendedAlerts": [
    {
      "id": "ALT-789",
      "alert_type": "Smoking",
      "priority": "high",
      "minutes_unattended": 45
    }
  ],
  "count": 1,
  "threshold_minutes": 30
}
```

**Frontend Action:** Show reminder notification, highlight unattended alerts

---

#### 6. Video Clip Ready
```json
{
  "type": "video-clip-ready",
  "alert_id": "ALT-123",
  "clip_type": "post",
  "file_path": "/recordings/221084138949/alerts/ALT-123_ch3_post_1737282368000.h264",
  "duration": 30.1,
  "frame_count": 450
}
```

**Frontend Action:** Enable video playback button

---

## 🎯 Frontend Requirements Mapping

### Requirement 1: Dedicated Alert Management Screen
**Endpoints:**
- `GET /api/alerts` - Load all alerts
- `GET /api/alerts/by-priority` - Group by priority
- `POST /api/alerts/:id/acknowledge` - Acknowledge
- `POST /api/alerts/:id/resolve-with-notes` - Resolve
- `POST /api/alerts/:id/escalate` - Escalate

**WebSocket:** `new-alert`, `alert-status-changed`

---

### Requirement 2: Required Notes Before Closing
**Endpoint:** `POST /api/alerts/:id/resolve-with-notes`
- Validates notes minimum 10 characters
- Returns error if validation fails

---

### Requirement 3: Screenshots on Single Page
**Endpoint:** `GET /api/screenshots/recent?minutes=30`
- Returns all recent screenshots
- Includes storage URLs for display

---

### Requirement 4: Auto-refresh Screenshots Every 30s
**Implementation:**
```javascript
setInterval(() => {
  fetch('/api/screenshots/recent?minutes=30')
    .then(res => res.json())
    .then(data => updateScreenshotGallery(data.screenshots));
}, 30000);
```

---

### Requirement 5: Group Alerts by Priority
**Endpoint:** `GET /api/alerts/by-priority`
- Returns alerts grouped: critical, high, medium, low
- Includes counts per priority

---

### Requirement 6: Alert Reminder Notifications
**WebSocket Event:** `unattended-alerts-reminder`
- Broadcasts every 5 minutes
- Lists alerts unattended > 30 minutes

---

### Requirement 7: Complete Alert History
**Endpoint:** `GET /api/alerts/:id/history`
- Returns all actions taken on alert
- Includes timestamps, operators, notes

---

### Requirement 8: 30s Before/After Video Recording
**Automatic:** Server captures automatically
- Pre-event: Saved immediately from circular buffer
- Post-event: Recorded for 30s after alert
- Paths stored in `metadata.videoClips`

---

### Requirement 9: Alert Bell Notifications
**WebSocket Events:**
- `new-alert` - New alert created
- `alert-escalated` - Alert escalated
- `unattended-alerts-reminder` - Unattended alerts

**Frontend Implementation:**
```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'new-alert' || data.type === 'alert-escalated') {
    showBellNotification(data.alert);
    playAlertSound();
    updateAlertBadge();
  }
};
```

---

### Requirement 10: Management Escalation Process
**Endpoint:** `POST /api/alerts/:id/escalate`
- Increments escalation_level
- Changes status to 'escalated'
- Broadcasts via WebSocket to management

---

### Requirement 11: Alert Flooding & Time-delay Escalation
**Endpoints:**
- `GET /api/alerts/unattended?minutes=30` - Time-delayed alerts
- `GET /api/dashboard/executive` - Shows alert flooding metrics

**Logic:** Frontend checks if alert count > threshold in time period

---

### Requirement 12: Driver Speeding Rating System
**Endpoints:**
- `POST /api/speeding/record` - Record speeding event
- `GET /api/drivers/:id/rating` - Get driver rating
- `GET /api/drivers/:id/speeding-events` - Get speeding history

---

### Requirement 13: Auto-report for 3+ Speeding Events
**Automatic:** Server generates report when driver has 3+ events in 7 days
- Check `reportGenerated` field in response
- Report stored in database

---

### Requirement 14: NCR Auto-generation
**Status:** Pending template from SRS team
**Future Endpoint:** `POST /api/ncr/generate`

---

### Requirement 15: Unattended Alerts Screen
**Endpoint:** `GET /api/alerts/unattended?minutes=30`
- Returns alerts not actioned within threshold
- Shows minutes_unattended for each

---

### Requirement 16: Document False Alerts
**Endpoint:** `POST /api/alerts/:id/mark-false`
- Requires reason (notes)
- Marks alert as false in metadata
- Links to screenshot evidence via alert_id

---

### Requirement 17: Executive Dashboard
**Endpoint:** `GET /api/dashboard/executive?days=30`
- Averages, time-scale analytics
- System-wide performance statistics
- Based on SRS Excel sheet requirements

---

## 🚀 Quick Start Example

```javascript
// Initialize WebSocket connection
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'new-alert':
      showNotification(`New ${data.alert.priority} alert: ${data.alert.alert_type}`);
      loadAlerts(); // Refresh alert list
      break;
      
    case 'screenshot-received':
      addScreenshotToGallery(data.image);
      break;
      
    case 'unattended-alerts-reminder':
      showReminderBadge(data.count);
      break;
  }
};

// Load initial data
async function initializeDashboard() {
  // Load alerts grouped by priority
  const alerts = await fetch('/api/alerts/by-priority').then(r => r.json());
  renderAlertGroups(alerts.alertsByPriority);
  
  // Load recent screenshots
  const screenshots = await fetch('/api/screenshots/recent?minutes=30').then(r => r.json());
  renderScreenshots(screenshots.screenshots);
  
  // Load executive dashboard
  const dashboard = await fetch('/api/dashboard/executive?days=30').then(r => r.json());
  renderDashboard(dashboard);
  
  // Auto-refresh screenshots every 30s
  setInterval(async () => {
    const updated = await fetch('/api/screenshots/recent?minutes=30').then(r => r.json());
    renderScreenshots(updated.screenshots);
  }, 30000);
}

// Resolve alert with notes
async function resolveAlert(alertId) {
  const notes = document.getElementById('resolution-notes').value;
  
  if (notes.length < 10) {
    alert('Please enter at least 10 characters in notes');
    return;
  }
  
  const response = await fetch(`/api/alerts/${alertId}/resolve-with-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notes: notes,
      resolvedBy: currentUser.name
    })
  });
  
  if (response.ok) {
    showSuccess('Alert resolved successfully');
    loadAlerts(); // Refresh
  }
}
```

---

## 📝 Notes

1. **Video Playback:** H.264 files require conversion to HLS for browser playback. Use `/api/vehicles/:id/start-live` to start HLS stream.

2. **Storage URLs:** Screenshots have `storage_url` field for Supabase public URLs. Use these for displaying images.

3. **Real-time Updates:** Always listen to WebSocket events to keep UI synchronized with server state.

4. **Error Handling:** All endpoints return `{ success: false, error: "message" }` on failure.

5. **Pagination:** Add `limit` and `offset` query parameters for large datasets.

6. **Time Zones:** All timestamps are in UTC (ISO 8601 format). Convert to local time in frontend.

---

## 🔗 Additional Resources

- **Database Schema:** See `schema.sql`
- **Alert Storage Guide:** See `ALERT_VIDEO_STORAGE_GUIDE.md`
- **Requirements Verification:** See `REQUIREMENTS_VERIFICATION.md`
- **Test Script:** Run `bash test-requirements.sh` to test all endpoints