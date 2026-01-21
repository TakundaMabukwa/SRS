# Video Alert System - Verification & Flow

## ✅ VERIFICATION CHECKLIST

### API Integration
- ✅ **Proxy Route:** `/api/video-server/[...path]` forwards to backend
- ✅ **WebSocket Hook:** `useVideoWebSocket` connects to video server
- ✅ **Context Updated:** Real API calls replace mock data
- ✅ **Fallback:** Mock data used if backend unavailable

### Pages Created
- ✅ `/video-alerts` - Main alerts list (3 view modes)
- ✅ `/video-alerts/management` - Dedicated management screen
- ✅ `/video-alerts/screenshots` - Screenshot gallery
- ✅ `/video-alerts/[id]` - Alert detail page

### Components
- ✅ `AlertBellNotification` - Real-time bell with WebSocket
- ✅ `CloseAlertModal` - Required notes validation (10+ chars)

### Requirements
- ✅ Dedicated management screen with priority grouping
- ✅ Required notes before closing (enforced)
- ✅ Screenshots on single page
- ✅ Auto-refresh every 30 seconds
- ✅ Alerts grouped by priority
- ✅ Alert reminder notifications
- ✅ Complete alert history
- ✅ 30s before/after video (backend automatic)
- ✅ Bell notifications with sound
- ✅ Escalation process

---

## 🔄 HOW THE SYSTEM WORKS

### 1. INITIAL LOAD

**User opens application:**
```
1. App loads → VideoAlertsProvider initializes
2. Context fetches: GET /api/video-server/alerts/by-priority
3. WebSocket connects to video server
4. Bell notification shows unread count
5. Mock data loads as fallback
```

---

### 2. MAIN ALERTS PAGE (`/video-alerts`)

**Features:**
- **3 View Modes:** List, Grouped (by priority), Gallery
- **Tabs:** All, New, Acknowledged, Investigating, Escalated, Unattended
- **Search:** Filter by vehicle, driver, alert type
- **Auto-refresh:** Every 30 seconds
- **Statistics Cards:** Total, Critical, New, Escalated, Resolved, Avg Response

**User Actions:**
- Click alert → Navigate to detail page
- Click "Acknowledge" → POST /api/video-server/alerts/:id/acknowledge
- Switch view modes → Re-render with different layout
- Search/filter → Client-side filtering

**Real-time Updates:**
- WebSocket `new-alert` → Alert added to list
- WebSocket `alert-status-changed` → Alert card updates
- WebSocket `unattended-alerts-reminder` → Unattended tab badge updates

---

### 3. MANAGEMENT PAGE (`/video-alerts/management`)

**Purpose:** Dedicated screen for operators to monitor all alerts

**Features:**
- **Priority Cards:** Critical, High, Medium, Low counts
- **Priority Tabs:** Filter by priority level
- **Auto-refresh:** Every 30 seconds
- **Real-time:** WebSocket updates instantly

**Flow:**
```
1. Page loads → GET /api/video-server/alerts/by-priority
2. Display 4 stat cards with counts
3. Show alerts in tabs by priority
4. WebSocket listener updates on new alerts
5. Auto-refresh every 30s
6. Click alert → Navigate to detail page
```

---

### 4. SCREENSHOTS PAGE (`/video-alerts/screenshots`)

**Purpose:** View all recent screenshots in one place

**Features:**
- **Grid Layout:** 4 columns (responsive)
- **Auto-refresh:** Every 30 seconds
- **Download:** Click to download screenshot
- **Device Info:** Shows device ID, channel, timestamp

**Flow:**
```
1. Page loads → GET /api/video-server/screenshots/recent?minutes=30
2. Display screenshots in grid
3. setInterval(30000) → Auto-refresh
4. WebSocket 'screenshot-received' → Add new screenshot to top
5. Click download → Opens storage_url in new tab
```

---

### 5. ALERT DETAIL PAGE (`/video-alerts/[id]`)

**Purpose:** Full alert investigation and resolution

**Layout:**
- **Left Column (8/12):** Media viewer + Details tabs
- **Right Column (4/12):** Management actions + Notes

**Features:**

**Media Viewer:**
- Hero image/video player
- Thumbnail strip (screenshots + video clips)
- Click thumbnail → Switch active media
- Auto-refresh screenshots every 30s (for active alerts)

**Details Tabs:**
- **Incident Details:** Vehicle, Driver, Location, Speed
- **Audit Monitor:** Complete history timeline
- **Map Location:** GPS coordinates (placeholder)

**Management Panel:**
- **Status-based Actions:**
  - New → "Acknowledge Alert"
  - Acknowledged → "Start Investigation"
  - Investigating → "Mark as Resolved"
  - Resolved → "Close Case"
- **Secondary Actions:** False Alarm, Escalate

**Notes Section:**
- View all notes with timestamps
- Add new note (textarea + button)
- Scrollable history

**Flow:**
```
1. Page loads → GET /api/video-server/alerts/:id
2. Fetch history → GET /api/video-server/alerts/:id/history
3. Display media, details, notes
4. User clicks action button:
   - Acknowledge → POST /api/video-server/alerts/:id/acknowledge
   - Escalate → POST /api/video-server/alerts/:id/escalate
   - Close → Opens CloseAlertModal
5. Auto-refresh screenshots every 30s
6. WebSocket updates → Refresh alert data
```

---

### 6. CLOSE ALERT MODAL

**Purpose:** Enforce required notes before closing

**Validation:**
- Notes field required
- Minimum 10 characters
- Submit button disabled until valid

**Flow:**
```
1. User clicks "Close Case" → Modal opens
2. User types notes (validation on change)
3. Character count shows: "X characters"
4. Optional: Mark as false positive
5. Click "Close Alert":
   → Validates notes.length >= 10
   → POST /api/video-server/alerts/:id/resolve-with-notes
   → Body: { notes, resolvedBy, is_false_positive }
6. Success → Modal closes, alert status updates
7. Fail → Error message shown
```

---

### 7. BELL NOTIFICATION

**Purpose:** Real-time alert notifications in header

**Features:**
- **Badge:** Shows unread count (new alerts)
- **Pulse Animation:** When unread > 0
- **Sound Alert:** Plays for critical priority
- **Popover:** Recent alerts list (last 10)
- **Quick Actions:** Acknowledge, View

**WebSocket Integration:**
```javascript
useVideoWebSocket((data) => {
  if (data.type === 'new-alert') {
    onRealtimeAlert(data.alert)
    fetchUnreadCount()
    if (data.alert.priority === 'critical') {
      playSound() // Audio alert
    }
  }
  if (data.type === 'alert-status-changed') {
    onRealtimeAlertUpdate(data.alert)
  }
  if (data.type === 'unattended-alerts-reminder') {
    fetchAlerts() // Refresh list
  }
})
```

**Flow:**
```
1. Component mounts → Fetch unread count
2. WebSocket 'new-alert' → Badge count increases
3. Critical alert → Sound plays
4. User clicks bell → Popover opens
5. Shows recent alerts (new, acknowledged, escalated)
6. Click "Ack" → Acknowledge alert
7. Click "View" → Navigate to detail page
8. Auto-refresh count every 10s
```

---

## 🔄 REAL-TIME EVENT FLOW

### New Alert Created (Backend)
```
Backend detects event → Creates alert → Broadcasts WebSocket

Frontend receives:
{
  "type": "new-alert",
  "alert": { id, alert_type, priority, device_id, timestamp }
}

Actions:
1. Bell notification badge +1
2. Alert added to main list
3. Management page updates
4. Sound plays if critical
5. Toast notification shown
```

### Screenshot Captured (Backend)
```
Backend captures screenshot → Uploads to storage → Broadcasts

Frontend receives:
{
  "type": "screenshot-received",
  "image": { id, device_id, channel, storage_url, timestamp, alert_id }
}

Actions:
1. Screenshot gallery adds new image to top
2. Alert detail page refreshes thumbnails
3. No page reload needed
```

### Alert Status Changed (User Action)
```
User clicks "Acknowledge" → POST request → Backend updates → Broadcasts

Frontend receives:
{
  "type": "alert-status-changed",
  "alert": { id, status, acknowledged_at }
}

Actions:
1. Alert card updates status badge
2. Management page refreshes
3. Bell notification count decreases
4. History timeline adds entry
```

### Unattended Alerts Reminder (Backend Timer)
```
Backend checks every 5 minutes → Finds alerts > 30min old → Broadcasts

Frontend receives:
{
  "type": "unattended-alerts-reminder",
  "unattendedAlerts": [...],
  "count": 5
}

Actions:
1. Bell notification shows reminder
2. Unattended tab badge updates
3. Toast notification shown
4. Alerts highlighted in list
```

---

## 📊 DATA FLOW DIAGRAM

```
┌─────────────────┐
│  Video Backend  │ (Your video server)
│   Server        │
└────────┬────────┘
         │
         │ WebSocket + HTTP
         │
┌────────▼────────┐
│  API Proxy      │ /api/video-server/[...path]
│  Route          │
└────────┬────────┘
         │
         │
┌────────▼────────────────────────────────────┐
│  VideoAlertsContext                         │
│  - Manages state                            │
│  - Fetches data                             │
│  - Handles WebSocket events                 │
│  - Provides actions to components           │
└────────┬────────────────────────────────────┘
         │
         │ Provides data & actions
         │
    ┌────┴────┬────────┬────────┬────────┐
    │         │        │        │        │
┌───▼───┐ ┌──▼──┐ ┌───▼───┐ ┌──▼──┐ ┌──▼──┐
│ Main  │ │Mgmt │ │Screen │ │Bell │ │Detail│
│ Page  │ │Page │ │shots  │ │Notif│ │ Page │
└───────┘ └─────┘ └───────┘ └─────┘ └──────┘
```

---

## 🎯 USER WORKFLOWS

### Workflow 1: Operator Responds to New Alert
```
1. Critical alert triggers → Bell rings + sound plays
2. Operator clicks bell → Sees "Driver Fatigue - ABC-123"
3. Clicks "View" → Opens detail page
4. Reviews screenshots and video clips
5. Clicks "Acknowledge Alert" → Status changes
6. Adds note: "Driver appears tired, will monitor"
7. Clicks "Start Investigation" → Status changes
8. Reviews more evidence
9. Clicks "Mark as Resolved" → Status changes
10. Clicks "Close Case" → Modal opens
11. Enters notes: "Driver took mandatory break, issue resolved"
12. Clicks "Close Alert" → Alert closed
13. History shows complete audit trail
```

### Workflow 2: Management Reviews Alerts
```
1. Manager opens /video-alerts/management
2. Sees 3 critical, 5 high, 2 medium alerts
3. Clicks "Critical" tab → Views critical alerts
4. Clicks alert → Opens detail page
5. Reviews history → Sees no action taken in 45 minutes
6. Clicks "Escalate" → Alert escalated
7. WebSocket broadcasts to all operators
8. Manager adds note with instructions
9. Operator receives notification
10. Operator takes action
```

### Workflow 3: Screenshot Review
```
1. Operator opens /video-alerts/screenshots
2. Sees grid of recent screenshots (last 30 minutes)
3. Page auto-refreshes every 30 seconds
4. New screenshot appears at top (WebSocket)
5. Operator clicks screenshot → Opens full size
6. Clicks download → Saves to computer
7. Reviews device ID and timestamp
8. If issue found → Navigates to alerts page
```

---

## 🔧 ENVIRONMENT SETUP

Required in `.env.local`:
```env
NEXT_PUBLIC_VIDEO_BASE_URL=http://your-video-server:3000
```

This URL is used for:
- HTTP API calls via proxy
- WebSocket connection (http → ws)

---

## ✅ VERIFICATION COMPLETE

All requirements implemented and integrated with backend API. System ready for testing with live video server.
