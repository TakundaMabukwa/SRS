# 🏗️ Video Alert System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/Next.js)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Alert List   │  │ Alert Detail │  │ Video Feeds  │         │
│  │ Page         │  │ Page         │  │ Page         │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                  │                  │
│         └────────┬────────┴──────────────────┘                  │
│                  │                                               │
│         ┌────────▼────────┐                                     │
│         │ VideoAlerts     │                                     │
│         │ Context         │◄─────┐                              │
│         │ Provider        │      │                              │
│         └────────┬────────┘      │                              │
│                  │                │                              │
│         ┌────────▼────────┐      │                              │
│         │ Custom Hooks    │      │                              │
│         │ & Utilities     │      │                              │
│         └────────┬────────┘      │                              │
│                  │                │                              │
│         ┌────────▼────────┐      │                              │
│         │ API Layer       │      │                              │
│         └────────┬────────┘      │                              │
│                  │                │                              │
└──────────────────┼────────────────┼──────────────────────────────┘
                   │                │
                   │ HTTP/REST      │ WebSocket/SSE
                   │                │ (Real-time)
                   │                │
┌──────────────────▼────────────────▼──────────────────────────────┐
│                         BACKEND API                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ REST         │  │ WebSocket    │  │ File         │         │
│  │ Endpoints    │  │ Server       │  │ Storage      │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                  │                  │
│         └────────┬────────┴──────────────────┘                  │
│                  │                                               │
│         ┌────────▼────────┐                                     │
│         │ Business Logic  │                                     │
│         │ & Services      │                                     │
│         └────────┬────────┘                                     │
│                  │                                               │
│         ┌────────▼────────┐                                     │
│         │ Database        │                                     │
│         │ (PostgreSQL)    │                                     │
│         └─────────────────┘                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Alert Creation Flow
```
Camera/Sensor → AI Detection → Backend → Database
                                  ↓
                            WebSocket Broadcast
                                  ↓
                          Frontend Context
                                  ↓
                            UI Update + Bell Notification
```

### 2. Alert Management Flow
```
User Action (UI) → Context Method → API Call → Backend
                                                   ↓
                                              Database Update
                                                   ↓
                                              History Entry
                                                   ↓
                                          Response to Frontend
                                                   ↓
                                           Reducer Updates State
                                                   ↓
                                              UI Re-renders
```

### 3. Screenshot Auto-Refresh Flow
```
Timer (30s) → Hook Trigger → API Call → Backend
                                           ↓
                                   Get Latest Screenshots
                                           ↓
                                      Return URLs
                                           ↓
                                   Context Update
                                           ↓
                                     UI Refresh
```

## Component Hierarchy

```
App
└── VideoAlertsProvider
    ├── Layout
    │   ├── Header
    │   │   └── AlertBellNotification
    │   ├── Sidebar
    │   └── Main Content
    │       ├── /video-alerts (List Page)
    │       │   ├── Statistics Cards
    │       │   ├── Filters & Tabs
    │       │   └── Alerts Table
    │       │
    │       ├── /video-alerts/[id] (Detail Page)
    │       │   ├── Header with Actions
    │       │   ├── Tabs
    │       │   │   ├── Screenshots Tab
    │       │   │   ├── Videos Tab
    │       │   │   └── Timeline Tab
    │       │   └── Sidebar
    │       │       ├── Alert Details
    │       │       └── Notes Section
    │       │
    │       └── /video-feeds (Feeds Page)
    │           └── Video Grid (2x2)
    │
    └── Modals
        └── CloseAlertModal
```

## State Management

```
VideoAlertsContext State
├── alerts: VideoAlert[]
├── selectedAlert: VideoAlert | null
├── statistics: AlertStatistics | null
├── filters: AlertFilters
├── loading: boolean
├── error: string | null
├── unreadCount: number
└── realtimeEnabled: boolean

Actions
├── fetchAlerts()
├── fetchAlert(id)
├── acknowledgeAlert(id)
├── updateAlertStatus(id, status)
├── addNote(id, note)
├── escalateAlert(id, data)
├── closeAlert(id, data)
├── refreshScreenshots(id)
└── setFilters(filters)
```

## Database Schema

```sql
video_alerts
├── id (PK)
├── alert_type
├── severity
├── status
├── title
├── description
├── vehicle_id (FK)
├── driver_id (FK)
├── timestamp
├── location (JSONB)
├── escalated
├── requires_action
├── created_at
└── updated_at

alert_screenshots
├── id (PK)
├── alert_id (FK)
├── camera_id
├── camera_name
├── url
├── thumbnail_url
├── timestamp
├── capture_offset
└── created_at

alert_notes
├── id (PK)
├── alert_id (FK)
├── user_id (FK)
├── content
├── is_internal
├── created_at
└── updated_at

alert_history
├── id (PK)
├── alert_id (FK)
├── action
├── user_id (FK)
├── old_value
├── new_value
├── details
├── metadata (JSONB)
└── timestamp

alert_video_clips
├── id (PK)
├── alert_id (FK)
├── camera_id
├── url
├── duration
├── start_time
├── end_time
└── created_at
```

## API Endpoints Structure

```
/api/video-alerts
├── GET    /                          # List alerts
├── GET    /:id                       # Get single alert
├── POST   /:id/acknowledge           # Acknowledge alert
├── PATCH  /:id/status                # Update status
├── POST   /:id/notes                 # Add note
├── POST   /:id/escalate              # Escalate alert
├── POST   /:id/close                 # Close alert (requires notes)
├── GET    /:id/screenshots           # Get screenshots
├── POST   /:id/screenshots/refresh   # Refresh screenshots
├── GET    /:id/videos                # Get video clips
├── GET    /statistics                # Get statistics
├── GET    /unread-count              # Get unread count
└── POST   /bulk-acknowledge          # Bulk operations
```

## Real-time Communication

```
WebSocket Connection
├── Event: new_alert
│   └── Payload: VideoAlert
│       └── Action: Add to list + Increment unread count
│
├── Event: alert_updated
│   └── Payload: VideoAlert
│       └── Action: Update in list
│
├── Event: alert_escalated
│   └── Payload: { alertId, escalatedTo }
│       └── Action: Show escalation notification
│
└── Event: screenshot_updated
    └── Payload: { alertId, screenshots[] }
        └── Action: Refresh screenshots in detail view
```

## Security Layers

```
Request
   ↓
Authentication Middleware
   ↓
Authorization Check (Role-based)
   ↓
Input Validation
   ↓
Business Logic
   ↓
Database Query (Parameterized)
   ↓
Response Sanitization
   ↓
Client
```

## File Storage Architecture

```
Alert Triggered
   ↓
Video Recording Service
   ↓
Extract Frames (Screenshots)
   ↓
Upload to Storage (S3/R2/etc)
   ↓
Generate URLs
   ↓
Store URLs in Database
   ↓
Return to Frontend
   ↓
Display in UI
```

## Escalation System

```
Alert Created
   ↓
Check Escalation Rules
   ↓
Start Timer (based on severity)
   ↓
If not resolved within threshold
   ↓
Auto-escalate to management
   ↓
Send notifications (Email/SMS)
   ↓
Update alert status
   ↓
Add to history
```

## Performance Optimizations

1. **Frontend**
   - React context for global state
   - Memoization for expensive computations
   - Lazy loading for images
   - Virtual scrolling for long lists
   - Debounced search
   - Optimistic UI updates

2. **Backend**
   - Database indexing on frequently queried fields
   - Caching layer (Redis) for statistics
   - Pagination for large datasets
   - Background jobs for heavy operations
   - CDN for static assets (screenshots/videos)

3. **Real-time**
   - WebSocket connection pooling
   - Event batching for high-frequency updates
   - Selective subscription to relevant alerts

## Monitoring & Logging

```
Application Logs
├── User Actions (Audit Trail)
├── API Requests/Responses
├── Error Tracking
├── Performance Metrics
└── Alert Lifecycle Events

Alerts to Monitor
├── High number of critical alerts
├── Low acknowledgment rate
├── High average response time
├── System errors/failures
└── Escalation frequency
```

## Scalability Considerations

1. **Horizontal Scaling**
   - Load balancer for multiple backend instances
   - Database replication
   - Distributed file storage
   - Microservices for video processing

2. **Vertical Scaling**
   - Upgrade database resources
   - Increase server capacity
   - Optimize queries

3. **Caching Strategy**
   - Cache statistics (5-minute TTL)
   - Cache user permissions
   - CDN for screenshots
   - Browser caching for static assets

## Backup & Recovery

```
Continuous Backup Strategy
├── Database Snapshots (Hourly)
├── File Storage Replication
├── Transaction Logs
└── Disaster Recovery Plan
    ├── RTO: 15 minutes
    └── RPO: 1 hour
```

## Integration Points

```
External Systems
├── Vehicle Telemetry System
├── Camera/DVR Systems
├── AI Detection Services
├── Email/SMS Services
├── Fleet Management System
├── User Management (Auth)
└── Analytics Platform
```

## Testing Strategy

```
Testing Pyramid
├── Unit Tests
│   ├── Reducer functions
│   ├── API functions
│   ├── Custom hooks
│   └── Utility functions
│
├── Integration Tests
│   ├── API endpoints
│   ├── Database operations
│   └── Context providers
│
├── E2E Tests
│   ├── Complete alert workflow
│   ├── User interactions
│   └── Real-time updates
│
└── Performance Tests
    ├── Load testing
    ├── Stress testing
    └── Scalability testing
```

---

This architecture provides a robust, scalable, and maintainable system for managing video alerts in your fleet management platform.
