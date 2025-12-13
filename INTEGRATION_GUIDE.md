# Integration Guide - Video Alert System

## Quick Start Integration

### Step 1: Add VideoAlertsProvider to Layout

Update your protected layout file to wrap the app with the VideoAlertsProvider:

```tsx
// src/app/(protected)/layout.tsx

import { VideoAlertsProvider } from "@/context/video-alerts-context";
import AlertBellNotification from "@/components/notifications/alert-bell-notification";

export default function ProtectedLayout({ children }) {
  return (
    <VideoAlertsProvider>
      {/* Your existing layout code */}
      
      {/* Add AlertBellNotification to your header/navbar */}
      <header>
        {/* Other header items */}
        <AlertBellNotification />
      </header>
      
      {children}
    </VideoAlertsProvider>
  );
}
```

### Step 2: Add Navigation Links

Add video alert navigation to your sidebar:

```tsx
import { Video, AlertTriangle } from "lucide-react";

const navigationItems = [
  // ... your existing items
  {
    label: "Video Feeds",
    href: "/video-feeds",
    icon: <Video className="w-5 h-5" />,
    permission: Permission.ALERTS_VIEW,
  },
  {
    label: "Video Alerts",
    href: "/video-alerts",
    icon: <AlertTriangle className="w-5 h-5" />,
    permission: Permission.ALERTS_MANAGE,
  },
];
```

### Step 3: Install Required Dependencies

Make sure you have these packages installed:

```bash
npm install date-fns
# or
yarn add date-fns
```

### Step 4: Add Permission Constants (Optional)

If you're using the permissions system, add these to your permissions file:

```typescript
// src/lib/permissions/permissions.ts

export enum Permission {
  // ... existing permissions
  ALERTS_VIEW = "alerts:view",
  ALERTS_MANAGE = "alerts:manage",
  ALERTS_ESCALATE = "alerts:escalate",
  ALERTS_CLOSE = "alerts:close",
}

export const PAGES = {
  // ... existing pages
  VIDEO_ALERTS: {
    path: "/video-alerts",
    permissions: [Permission.ALERTS_VIEW],
  },
  VIDEO_FEEDS: {
    path: "/video-feeds",
    permissions: [Permission.ALERTS_VIEW],
  },
};
```

### Step 5: Backend Setup

Create the API routes in your backend:

```typescript
// Example: src/app/api/video-alerts/route.ts

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Get query parameters
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.getAll("status");
  const severity = searchParams.getAll("severity");
  
  // Fetch alerts from your database
  const alerts = await fetchAlertsFromDB({
    status,
    severity,
    // ... other filters
  });
  
  return NextResponse.json({
    success: true,
    data: alerts,
    total: alerts.length,
  });
}
```

## Testing the Integration

### 1. Test Alert List Page
Navigate to: `http://localhost:3000/video-alerts`

You should see:
- Statistics cards at the top
- Filter tabs
- Alert table with sample data (once backend is connected)

### 2. Test Video Feeds Page
Navigate to: `http://localhost:3000/video-feeds`

You should see:
- 2x2 grid of video feeds
- Dark theme layout
- Camera information overlays

### 3. Test Bell Notification
Click the bell icon in the header:
- Should show recent alerts
- Should display unread count
- Should allow quick actions

## Mock Data for Testing

Until your backend is ready, you can add mock data:

```typescript
// src/context/video-alerts-context/context.js

// Add this inside VideoAlertsProvider for testing
useEffect(() => {
  // Mock data for testing
  const mockAlerts = [
    {
      id: "alert-1",
      alert_type: "harsh_braking",
      severity: "critical",
      status: "new",
      title: "Harsh Braking Detected",
      description: "Vehicle braked suddenly at high speed",
      vehicle_id: "vehicle-1",
      vehicle_registration: "ABC-123",
      driver_id: "driver-1",
      driver_name: "John Smith",
      timestamp: new Date().toISOString(),
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        address: "New York, NY",
      },
      camera_ids: ["cam1", "cam2"],
      screenshots: [
        {
          id: "ss-1",
          alert_id: "alert-1",
          camera_id: "cam1",
          camera_name: "Front Camera",
          url: "https://via.placeholder.com/640x360",
          timestamp: new Date().toISOString(),
          capture_offset: -5,
        },
      ],
      notes: [],
      history: [],
      escalated: false,
      requires_action: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    // Add more mock alerts as needed
  ];

  dispatch(actions.fetchAlerts({ data: mockAlerts }));
  dispatch(actions.setUnreadCount(mockAlerts.filter(a => a.status === 'new').length));
}, []);
```

## Common Issues & Solutions

### Issue: "useVideoAlerts must be used within VideoAlertsProvider"
**Solution**: Make sure VideoAlertsProvider wraps your component tree in the layout.

### Issue: Screenshots not auto-refreshing
**Solution**: Check that the `useAutoRefreshScreenshots` hook is called in the alert detail page.

### Issue: Bell notification not showing count
**Solution**: Ensure `fetchUnreadCount` is being called when the component mounts.

### Issue: Date formatting errors
**Solution**: Make sure `date-fns` is installed: `npm install date-fns`

### Issue: Toast notifications not working
**Solution**: Ensure your app has the Toaster component from shadcn/ui installed.

## Next Steps

1. ✅ UI is complete and ready
2. 🔨 Connect to backend API
3. 🔌 Implement WebSocket for real-time updates
4. 📸 Set up screenshot storage (S3, CloudFlare R2, etc.)
5. 🎥 Implement video recording service
6. 📧 Add email/SMS notifications
7. 🔐 Add proper authentication
8. 📊 Connect to real vehicle/driver data

## Production Checklist

Before deploying to production:

- [ ] Backend API endpoints implemented
- [ ] Database tables created
- [ ] File storage configured for screenshots/videos
- [ ] Real-time connection (WebSocket/SSE) set up
- [ ] Authentication and authorization implemented
- [ ] Escalation rules configured
- [ ] Email/SMS notifications configured
- [ ] Performance testing completed
- [ ] Security audit performed
- [ ] User permissions configured
- [ ] Backup and recovery plan in place

## Support

If you need help with integration:
1. Check the VIDEO_ALERT_SYSTEM_README.md
2. Review the type definitions in src/types/video-alerts.ts
3. Look at the example implementations in the page files
4. Test with mock data first before connecting to backend

Good luck with your integration! 🚀
