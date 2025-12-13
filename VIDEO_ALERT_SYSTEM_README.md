# Video Alert Management System

## Overview

A comprehensive video alert management system for monitoring and managing real-time video alerts from fleet vehicles. This system provides a complete workflow for alert detection, acknowledgment, investigation, escalation, and resolution.

## Features

### ✅ Core Requirements Implemented

1. **Real-time Alerts and Notifications**
   - Live alert feed with auto-refresh
   - Bell notification system with unread count
   - Real-time screenshot updates every 30 seconds

2. **Dedicated Alert Management Screen**
   - Complete alert listing with filters and search
   - Detailed alert view with full history
   - Statistics dashboard with key metrics

3. **Required Notes Before Closing**
   - Modal enforces minimum 10 characters
   - Optional action taken field
   - False positive marking

4. **Screenshot Management**
   - Auto-refresh every 30 seconds
   - Display multiple camera views
   - Timestamped captures with offset indicators

5. **Complete Alert History**
   - Full audit trail of all actions
   - Timestamp tracking for all events
   - User attribution for every action

6. **Video Clip Recording**
   - 30 seconds before/after event capture
   - Download functionality
   - Multiple camera support

7. **Bell Notifications**
   - Unread count badge
   - Quick actions from dropdown
   - Recent alerts preview

8. **Escalation Process**
   - Manual escalation to management
   - Automatic escalation rules (time-based)
   - Escalation reason tracking

## Architecture

### File Structure

```
src/
├── types/
│   └── video-alerts.ts          # TypeScript interfaces and types
├── context/
│   └── video-alerts-context/
│       ├── actions.js           # Action creators
│       ├── reducer.js           # State reducer
│       ├── context.js           # Context provider
│       └── api.js              # API integration
├── hooks/
│   └── use-video-alerts.ts     # Custom hooks
├── app/(protected)/
│   ├── video-alerts/
│   │   ├── page.tsx            # Alert list page
│   │   └── [id]/
│   │       └── page.tsx        # Alert detail page
│   └── video-feeds/
│       └── page.tsx            # Live video feeds
└── components/
    ├── modals/
    │   └── close-alert-modal.tsx
    └── notifications/
        └── alert-bell-notification.tsx
```

### Data Flow

```
User Action → Context Method → API Call → Backend → Response → Reducer → UI Update
```

## Alert Workflow

### 1. Alert Creation
```
New Alert Triggered → Status: "new" → Bell Notification → Appears in List
```

### 2. Acknowledgment
```
User Acknowledges → Status: "acknowledged" → Unread Count Decreases
```

### 3. Investigation
```
User Starts Investigation → Status: "investigating" → Can Add Notes
```

### 4. Escalation (Optional)
```
User/Auto Escalates → Status: "escalated" → Management Notified
```

### 5. Resolution
```
Issue Resolved → Status: "resolved" → Can Close with Notes
```

### 6. Closure
```
User Closes (Notes Required) → Status: "closed" → Added to History
```

## Alert Types

- **harsh_braking** - Sudden braking detected
- **speeding** - Speed limit exceeded
- **collision_detected** - Potential collision
- **lane_departure** - Vehicle left lane
- **driver_distraction** - Driver not focused
- **drowsiness** - Driver showing signs of fatigue
- **unauthorized_stop** - Unscheduled stop
- **geofence_violation** - Outside permitted area
- **vehicle_tamper** - Camera/system tampering
- **camera_offline** - Camera connection lost
- **system_error** - Technical issue
- **custom** - Custom alert type

## Alert Severity Levels

| Severity | Color | Response Time | Auto-Escalate After |
|----------|-------|---------------|---------------------|
| Critical | Red | Immediate | 5 minutes |
| High | Orange | < 5 min | 15 minutes |
| Medium | Yellow | < 15 min | 30 minutes |
| Low | Blue | < 30 min | 60 minutes |
| Info | Gray | When available | 120 minutes |

## Alert Statuses

1. **new** - Just triggered, awaiting acknowledgment
2. **acknowledged** - Operator has seen it
3. **investigating** - Under active review
4. **escalated** - Sent to management
5. **resolved** - Issue addressed
6. **closed** - Officially closed with notes

## API Endpoints

### Alerts
- `GET /api/video-alerts` - List alerts with filters
- `GET /api/video-alerts/:id` - Get single alert
- `POST /api/video-alerts/:id/acknowledge` - Acknowledge alert
- `PATCH /api/video-alerts/:id/status` - Update status
- `POST /api/video-alerts/:id/close` - Close alert (requires notes)

### Notes
- `POST /api/video-alerts/:id/notes` - Add note
- `GET /api/video-alerts/:id/notes` - List notes

### Escalation
- `POST /api/video-alerts/:id/escalate` - Escalate alert
- `GET /api/video-alerts/escalation-rules` - Get rules

### Screenshots & Videos
- `GET /api/video-alerts/:id/screenshots` - Get screenshots
- `POST /api/video-alerts/:id/screenshots/refresh` - Refresh screenshots
- `GET /api/video-alerts/:id/videos` - Get video clips
- `GET /api/video-alerts/clips/:id/download` - Download clip

### Statistics
- `GET /api/video-alerts/statistics` - Get stats
- `GET /api/video-alerts/unread-count` - Get unread count

## Usage Examples

### 1. Using the Context

```tsx
import { useVideoAlerts } from "@/context/video-alerts-context/context";

function MyComponent() {
  const { 
    alerts, 
    fetchAlerts, 
    acknowledgeAlert 
  } = useVideoAlerts();

  useEffect(() => {
    fetchAlerts();
  }, []);

  return (
    // Your component
  );
}
```

### 2. Using Custom Hooks

```tsx
import { useAlertActions, useAutoRefreshScreenshots } from "@/hooks/use-video-alerts";

function AlertDetail({ alertId }) {
  const { handleAcknowledge, actionLoading } = useAlertActions(alertId);
  const { lastRefresh } = useAutoRefreshScreenshots(alertId, true);

  return (
    // Your component
  );
}
```

### 3. Adding the Bell Notification

```tsx
import AlertBellNotification from "@/components/notifications/alert-bell-notification";

function Header() {
  return (
    <header>
      {/* Other header items */}
      <AlertBellNotification />
    </header>
  );
}
```

## Backend Integration Guide

### Database Schema (Example)

```sql
-- Video Alerts Table
CREATE TABLE video_alerts (
  id UUID PRIMARY KEY,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  vehicle_id UUID REFERENCES vehicles(id),
  driver_id UUID REFERENCES drivers(id),
  timestamp TIMESTAMP NOT NULL,
  location JSONB,
  escalated BOOLEAN DEFAULT false,
  requires_action BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Screenshots Table
CREATE TABLE alert_screenshots (
  id UUID PRIMARY KEY,
  alert_id UUID REFERENCES video_alerts(id),
  camera_id VARCHAR(50) NOT NULL,
  camera_name VARCHAR(100),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  timestamp TIMESTAMP NOT NULL,
  capture_offset INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notes Table
CREATE TABLE alert_notes (
  id UUID PRIMARY KEY,
  alert_id UUID REFERENCES video_alerts(id),
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- History Table
CREATE TABLE alert_history (
  id UUID PRIMARY KEY,
  alert_id UUID REFERENCES video_alerts(id),
  action VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id),
  old_value TEXT,
  new_value TEXT,
  details TEXT,
  metadata JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Escalation Rules Table
CREATE TABLE alert_escalation_rules (
  id UUID PRIMARY KEY,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  time_threshold_minutes INTEGER NOT NULL,
  escalate_to_role VARCHAR(50),
  notification_channels JSONB,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Backend Implementation Checklist

- [ ] Create API endpoints listed above
- [ ] Implement screenshot auto-capture on alert trigger
- [ ] Set up video clip recording (30s before/after)
- [ ] Implement WebSocket/SSE for real-time updates
- [ ] Create escalation job/cron for auto-escalation
- [ ] Add email/SMS notification service
- [ ] Implement storage for screenshots and videos
- [ ] Add authentication and authorization
- [ ] Set up audit logging for all actions
- [ ] Create dashboard statistics aggregation

## Customization

### Adding New Alert Types

1. Update `AlertType` in `src/types/video-alerts.ts`
2. Add display configuration in alert list/detail pages
3. Update backend validation

### Modifying Escalation Rules

Edit the `useAlertEscalation` hook in `src/hooks/use-video-alerts.ts`:

```typescript
const escalationThresholds = {
  critical: 5,   // Your custom threshold
  high: 15,
  // ...
};
```

### Customizing Screenshot Refresh Interval

Edit the interval in `useAutoRefreshScreenshots` hook:

```typescript
const interval = setInterval(() => {
  refreshScreenshots(alertId);
}, 30000); // Change this value (in milliseconds)
```

## Testing Checklist

- [ ] Alert list loads and displays correctly
- [ ] Filters work as expected
- [ ] Search functionality works
- [ ] Bell notification shows correct count
- [ ] Acknowledging alerts updates UI
- [ ] Alert detail page loads all data
- [ ] Screenshots auto-refresh every 30 seconds
- [ ] Notes can be added successfully
- [ ] Close modal enforces required notes
- [ ] Escalation creates proper history entry
- [ ] Status changes are tracked
- [ ] Timeline shows complete history

## Performance Considerations

1. **Auto-refresh intervals** - Adjust based on server load
2. **Screenshot storage** - Implement CDN for better performance
3. **List pagination** - Add for large datasets
4. **Real-time updates** - Use WebSocket instead of polling
5. **Image optimization** - Compress screenshots before storage

## Security Considerations

1. **Authentication** - Ensure all endpoints require authentication
2. **Authorization** - Implement role-based access control
3. **Data validation** - Validate all inputs on backend
4. **Rate limiting** - Prevent abuse of API endpoints
5. **Audit logging** - Log all sensitive actions

## Future Enhancements

- [ ] Mobile app integration
- [ ] Advanced analytics dashboard
- [ ] AI-powered alert classification
- [ ] Automated response workflows
- [ ] Integration with third-party systems
- [ ] Custom alert rules engine
- [ ] Multi-language support
- [ ] Dark mode support
- [ ] Export reports (PDF/Excel)
- [ ] Alert templates

## Support

For questions or issues with the video alert system, contact the development team or refer to the main project documentation.
