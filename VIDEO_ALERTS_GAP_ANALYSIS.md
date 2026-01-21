# Video Alert System - Gap Analysis & Implementation Plan

## Executive Summary
This document analyzes the current video alert system against new requirements and provides a detailed implementation plan to bridge the gaps.

---

## Current System Overview

### ✅ What We Have (Implemented)

1. **Type System & Data Models** ✅
   - Comprehensive TypeScript types for alerts, screenshots, videos, notes, history
   - Alert statuses: new, acknowledged, investigating, escalated, resolved, closed
   - Alert severities: critical, high, medium, low, info
   - Complete audit trail structure

2. **Basic Alert Management** ✅
   - Alert list page with filtering and search
   - Alert detail page with full information
   - Status badges and severity indicators
   - Vehicle and driver information display

3. **Screenshot Display** ✅
   - Screenshots displayed in grid layout
   - Camera name and timestamp labels
   - Basic screenshot viewing

4. **Notes System** ✅
   - Add notes to alerts
   - View notes history
   - User attribution for notes

5. **Alert History/Timeline** ✅
   - Complete audit trail
   - Timeline view with all actions
   - User tracking for all actions

6. **Status Management** ✅
   - Status workflow (new → acknowledged → investigating → resolved → closed)
   - Status change tracking

7. **Escalation** ✅
   - Basic escalation functionality
   - Escalation tracking in alert data

8. **Auto-refresh** ✅
   - Screenshots refresh every 30 seconds (implemented in detail page)
   - Alert list auto-refresh every 30 seconds

9. **Close Alert Modal** ✅
   - Modal requires notes before closing
   - Minimum 10 character validation
   - False positive marking option

---

## ❌ Gaps - What We Need to Implement

### 1. **Dedicated Full-Screen Alert Management Screen** ❌
**Current State:** Alert management split between list page and detail page
**Required:** Single comprehensive screen for complete alert workflow

**Implementation Needed:**
- Create new `/video-alerts/management` route
- Full-screen layout with:
  - Alert queue (left sidebar)
  - Main content area (center)
  - Action panel (right sidebar)
- Real-time alert updates
- Quick navigation between alerts

---

### 2. **Screenshot Auto-Refresh on List Page** ❌
**Current State:** Auto-refresh only on detail page
**Required:** Screenshots refresh automatically on all pages

**Implementation Needed:**
- Add auto-refresh to alert list page
- Thumbnail previews with live updates
- Visual indicator when screenshots are refreshing

---

### 3. **Priority-Based Alert Grouping** ❌
**Current State:** Alerts filtered by status only
**Required:** Group and sort alerts by priority/severity

**Implementation Needed:**
- Priority grouping in alert list
- Visual separation between priority levels
- Collapsible priority sections
- Priority-based sorting algorithm

---

### 4. **Alert Reminder Notifications** ❌
**Current State:** No reminder system
**Required:** Automatic reminders for unresolved alerts

**Implementation Needed:**
- Background job to check alert age
- Notification system for overdue alerts
- Configurable reminder intervals based on severity
- Visual indicators for overdue alerts
- Sound/desktop notifications

---

### 5. **30-Second Video Recording for Priority Alerts** ❌
**Current State:** Video clips structure exists but not implemented
**Required:** Automatic 30s before/after recording for critical/high alerts

**Implementation Needed:**
- Backend integration with camera system
- Automatic video capture trigger
- Video storage and retrieval
- Video player component
- Download functionality

---

### 6. **Bell Notification System** ❌
**Current State:** Unread count tracked but no bell UI
**Required:** Bell icon with notifications for new/escalated alerts

**Implementation Needed:**
- Bell icon in navigation header
- Notification badge with count
- Dropdown notification panel
- Real-time notification updates
- Sound alerts for critical notifications
- Mark as read functionality

---

### 7. **Management Escalation Process** ❌
**Current State:** Basic escalation exists but no defined workflow
**Required:** Structured escalation with management notification

**Implementation Needed:**
- Escalation rules engine
- Time-based auto-escalation
- Management user roles
- Email/SMS notifications to management
- Escalation dashboard for managers
- Escalation history tracking

---

### 8. **Real-Time Updates** ⚠️ Partial
**Current State:** Polling-based refresh (30s intervals)
**Required:** True real-time updates via WebSocket/SSE

**Implementation Needed:**
- WebSocket connection setup
- Real-time alert creation events
- Real-time status change events
- Real-time screenshot updates
- Connection status indicator

---

### 9. **Single-Page Screenshot Review** ⚠️ Partial
**Current State:** Screenshots in tabs, requires scrolling
**Required:** All screenshots on single page/tab for easy review

**Implementation Needed:**
- Redesign screenshot layout
- Grid view with all cameras visible
- Lightbox/modal for full-screen viewing
- Comparison view (side-by-side)
- Timeline scrubber for video clips

---

## Implementation Priority Matrix

### Phase 1: Critical (Week 1-2)
1. **Dedicated Management Screen** - Core requirement
2. **Bell Notification System** - User experience critical
3. **Required Notes for Closing** - Already implemented ✅
4. **Priority-Based Grouping** - Workflow efficiency

### Phase 2: High Priority (Week 3-4)
5. **Alert Reminder System** - Prevents missed alerts
6. **Management Escalation Process** - Compliance requirement
7. **Single-Page Screenshot Review** - Operator efficiency
8. **Real-Time WebSocket Updates** - System responsiveness

### Phase 3: Medium Priority (Week 5-6)
9. **30-Second Video Recording** - Evidence collection
10. **Enhanced Video Player** - Review capabilities
11. **Advanced Filtering** - Operational efficiency

---

## Detailed Implementation Plan

### 1. Dedicated Management Screen

**Files to Create:**
```
src/app/(protected)/video-alerts/management/page.tsx
src/components/video-alerts/alert-queue.tsx
src/components/video-alerts/alert-viewer.tsx
src/components/video-alerts/action-panel.tsx
```

**Features:**
- Split-screen layout (queue | viewer | actions)
- Keyboard shortcuts for navigation
- Quick status changes
- Inline note adding
- Screenshot carousel
- Video playback

---

### 2. Bell Notification System

**Files to Create/Modify:**
```
src/components/layout/notification-bell.tsx
src/components/notifications/notification-dropdown.tsx
src/hooks/use-notifications.ts
src/lib/notifications/notification-service.ts
```

**Features:**
- Bell icon with badge count
- Dropdown with recent alerts
- Sound notifications (configurable)
- Desktop notifications (browser API)
- Mark as read/unread
- Filter by severity
- Direct link to alert details

---

### 3. Priority-Based Grouping

**Files to Modify:**
```
src/app/(protected)/video-alerts/page.tsx
src/components/video-alerts/priority-group.tsx
```

**Features:**
- Collapsible sections per priority
- Count badges per priority
- Color-coded headers
- Auto-expand critical/high
- Drag-and-drop reordering (optional)

---

### 4. Alert Reminder System

**Files to Create:**
```
src/lib/alerts/reminder-service.ts
src/hooks/use-alert-reminders.ts
src/components/alerts/reminder-indicator.tsx
```

**Features:**
- Background timer checking alert age
- Configurable thresholds per severity:
  - Critical: 5 minutes
  - High: 15 minutes
  - Medium: 30 minutes
  - Low: 60 minutes
- Visual indicators (pulsing, color change)
- Sound alerts
- Toast notifications
- Reminder history

---

### 5. 30-Second Video Recording

**Files to Create:**
```
src/lib/video/video-capture-service.ts
src/components/video-alerts/video-player.tsx
src/hooks/use-video-playback.ts
```

**Backend Requirements:**
- Camera API integration
- Video storage (S3/Azure Blob)
- Video processing pipeline
- Thumbnail generation

**Features:**
- Automatic capture trigger
- 30s before event (buffer)
- 30s after event
- Multiple camera angles
- Video player with controls
- Download functionality
- Frame-by-frame navigation

---

### 6. Management Escalation Process

**Files to Create:**
```
src/lib/escalation/escalation-engine.ts
src/lib/escalation/escalation-rules.ts
src/components/escalation/escalation-modal.tsx
src/app/(protected)/video-alerts/escalations/page.tsx
```

**Features:**
- Escalation rules configuration
- Auto-escalation based on time
- Manual escalation with reason
- Management notification (email/SMS)
- Escalation dashboard
- Escalation analytics
- SLA tracking

---

### 7. Real-Time Updates (WebSocket)

**Files to Create:**
```
src/lib/websocket/alert-websocket.ts
src/hooks/use-realtime-alerts.ts
src/context/websocket-context.tsx
```

**Backend Requirements:**
- WebSocket server setup
- Event broadcasting
- Connection management
- Reconnection logic

**Features:**
- Real-time alert creation
- Real-time status updates
- Real-time screenshot updates
- Connection status indicator
- Automatic reconnection
- Offline queue

---

### 8. Single-Page Screenshot Review

**Files to Modify:**
```
src/app/(protected)/video-alerts/[id]/page.tsx
src/components/video-alerts/screenshot-gallery.tsx
src/components/video-alerts/screenshot-lightbox.tsx
```

**Features:**
- Grid layout (2x2, 3x3, 4x4)
- All cameras visible simultaneously
- Synchronized timestamps
- Lightbox for full-screen
- Zoom and pan
- Side-by-side comparison
- Export all screenshots

---

## Database Schema Changes

### New Tables Needed:

```sql
-- Alert Reminders
CREATE TABLE alert_reminders (
  id UUID PRIMARY KEY,
  alert_id UUID REFERENCES video_alerts(id),
  reminder_time TIMESTAMP,
  reminded_at TIMESTAMP,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Escalation Rules
CREATE TABLE escalation_rules (
  id UUID PRIMARY KEY,
  alert_type VARCHAR(50),
  severity VARCHAR(20),
  time_threshold_minutes INTEGER,
  escalate_to_role VARCHAR(50),
  notification_channels TEXT[],
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Escalation History
CREATE TABLE escalation_history (
  id UUID PRIMARY KEY,
  alert_id UUID REFERENCES video_alerts(id),
  escalated_from UUID REFERENCES users(id),
  escalated_to UUID REFERENCES users(id),
  reason TEXT,
  escalated_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Notifications
CREATE TABLE alert_notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  alert_id UUID REFERENCES video_alerts(id),
  notification_type VARCHAR(50),
  title TEXT,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints Needed

### New Endpoints:
```
POST   /api/video-alerts/reminders          - Create reminder
GET    /api/video-alerts/reminders/:userId  - Get user reminders
PUT    /api/video-alerts/reminders/:id      - Acknowledge reminder

POST   /api/video-alerts/escalate           - Escalate alert
GET    /api/video-alerts/escalations        - Get escalations
PUT    /api/video-alerts/escalations/:id    - Update escalation

GET    /api/notifications/:userId           - Get user notifications
PUT    /api/notifications/:id/read          - Mark as read
DELETE /api/notifications/:id               - Delete notification

GET    /api/video-alerts/:id/videos         - Get video clips
POST   /api/video-alerts/:id/videos/capture - Trigger video capture
GET    /api/video-alerts/:id/videos/:videoId/download - Download video

WS     /api/video-alerts/stream             - WebSocket connection
```

---

## Configuration Changes

### Environment Variables:
```env
# Video Recording
VIDEO_STORAGE_BUCKET=alerts-videos
VIDEO_RETENTION_DAYS=90
VIDEO_CAPTURE_ENABLED=true

# Notifications
NOTIFICATION_SOUND_ENABLED=true
DESKTOP_NOTIFICATIONS_ENABLED=true
EMAIL_NOTIFICATIONS_ENABLED=true
SMS_NOTIFICATIONS_ENABLED=true

# Escalation
AUTO_ESCALATION_ENABLED=true
ESCALATION_EMAIL_TEMPLATE=escalation-alert
MANAGEMENT_EMAIL_LIST=manager1@company.com,manager2@company.com

# WebSocket
WEBSOCKET_URL=wss://your-backend.com/alerts
WEBSOCKET_RECONNECT_INTERVAL=5000
```

---

## Testing Requirements

### Unit Tests:
- Reminder service logic
- Escalation rules engine
- Notification service
- Video capture triggers

### Integration Tests:
- WebSocket connection
- Video recording pipeline
- Email/SMS notifications
- Database operations

### E2E Tests:
- Complete alert workflow
- Escalation process
- Screenshot refresh
- Video playback

---

## Performance Considerations

1. **Screenshot Loading**
   - Lazy loading for thumbnails
   - Progressive image loading
   - CDN for image delivery

2. **Video Streaming**
   - Adaptive bitrate streaming
   - Video compression
   - Thumbnail generation

3. **Real-Time Updates**
   - WebSocket connection pooling
   - Event debouncing
   - Efficient state updates

4. **Database Queries**
   - Indexed queries for alerts
   - Pagination for large datasets
   - Caching for statistics

---

## Security Considerations

1. **Video Access Control**
   - Role-based video access
   - Signed URLs for video downloads
   - Audit trail for video access

2. **Notification Security**
   - Encrypted notification content
   - Secure WebSocket connection (WSS)
   - Rate limiting for notifications

3. **Escalation Security**
   - Verify escalation permissions
   - Audit escalation actions
   - Secure email/SMS delivery

---

## Estimated Timeline

### Phase 1 (2 weeks):
- Dedicated management screen
- Bell notification system
- Priority-based grouping
- Alert reminders

### Phase 2 (2 weeks):
- Management escalation process
- Single-page screenshot review
- Real-time WebSocket updates

### Phase 3 (2 weeks):
- 30-second video recording
- Video player enhancements
- Advanced filtering
- Performance optimization

**Total: 6 weeks**

---

## Success Metrics

1. **Response Time**
   - Average time to acknowledge: < 2 minutes
   - Average time to resolve: < 15 minutes

2. **Alert Coverage**
   - 100% of critical alerts acknowledged within 5 minutes
   - 0 missed critical alerts

3. **User Satisfaction**
   - Operator feedback score: > 4.5/5
   - Management visibility score: > 4.5/5

4. **System Performance**
   - Screenshot refresh latency: < 2 seconds
   - WebSocket uptime: > 99.9%
   - Video playback start time: < 3 seconds

---

## Next Steps

1. **Review and Approve** this gap analysis
2. **Prioritize** features based on business needs
3. **Assign Resources** (developers, designers, QA)
4. **Set Up Infrastructure** (WebSocket server, video storage)
5. **Begin Phase 1 Development**
6. **Establish Testing Environment**
7. **Create User Documentation**
8. **Plan Training Sessions**

---

## Conclusion

The current system has a solid foundation with comprehensive type definitions, basic alert management, and essential features like notes and history tracking. The main gaps are:

1. **Operational Efficiency** - Need dedicated management screen and better grouping
2. **Proactive Monitoring** - Need reminders and bell notifications
3. **Evidence Collection** - Need video recording for priority alerts
4. **Management Visibility** - Need escalation process and notifications
5. **Real-Time Responsiveness** - Need WebSocket for instant updates

By implementing these features in the proposed 3-phase approach, the system will meet all requirements and provide a comprehensive, efficient alert management solution.
