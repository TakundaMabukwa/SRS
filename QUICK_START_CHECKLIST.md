# ✅ Video Alert System - Quick Start Checklist

## 🚀 Get Started in 15 Minutes

### Step 1: Install Dependencies (2 min)
```bash
npm install date-fns
# or
yarn add date-fns
```

### Step 2: Add Provider to Layout (3 min)

Open `src/app/(protected)/layout.tsx` and add:

```tsx
import { VideoAlertsProvider } from "@/context/video-alerts-context";
import AlertBellNotification from "@/components/notifications/alert-bell-notification";

export default function ProtectedLayout({ children }) {
  return (
    <VideoAlertsProvider>
      {/* Your existing layout */}
      <div className="layout">
        <header>
          {/* Existing header content */}
          <AlertBellNotification /> {/* Add this */}
        </header>
        {children}
      </div>
    </VideoAlertsProvider>
  );
}
```

### Step 3: Add Navigation Links (2 min)

Add to your sidebar navigation:

```tsx
{
  label: "Video Alerts",
  href: "/video-alerts",
  icon: <AlertTriangle className="w-5 h-5" />,
},
{
  label: "Video Feeds",
  href: "/video-feeds",
  icon: <Video className="w-5 h-5" />,
}
```

### Step 4: Test with Mock Data (3 min)

Add this to `src/context/video-alerts-context/context.js` inside the `VideoAlertsProvider` component:

```javascript
// Add after const { toast } = useToast();

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
          url: "https://via.placeholder.com/640x360/FF5733/FFFFFF?text=Front+Camera",
          timestamp: new Date().toISOString(),
          capture_offset: -5,
          created_at: new Date().toISOString(),
        },
        {
          id: "ss-2",
          alert_id: "alert-1",
          camera_id: "cam2",
          camera_name: "Rear Camera",
          url: "https://via.placeholder.com/640x360/3498DB/FFFFFF?text=Rear+Camera",
          timestamp: new Date().toISOString(),
          capture_offset: 0,
          created_at: new Date().toISOString(),
        },
      ],
      notes: [
        {
          id: "note-1",
          alert_id: "alert-1",
          user_id: "user-1",
          user_name: "Admin User",
          content: "Reviewing footage for traffic conditions",
          is_internal: false,
          created_at: new Date().toISOString(),
        },
      ],
      history: [
        {
          id: "hist-1",
          alert_id: "alert-1",
          action: "created",
          user_id: "system",
          user_name: "System",
          details: "Alert automatically generated",
          timestamp: new Date().toISOString(),
        },
      ],
      escalated: false,
      requires_action: true,
      auto_resolved: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "alert-2",
      alert_type: "speeding",
      severity: "high",
      status: "acknowledged",
      title: "Speed Limit Exceeded",
      description: "Vehicle traveling at 85 mph in 65 mph zone",
      vehicle_id: "vehicle-2",
      vehicle_registration: "XYZ-789",
      driver_id: "driver-2",
      driver_name: "Jane Doe",
      timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      location: {
        latitude: 34.0522,
        longitude: -118.2437,
        address: "Los Angeles, CA",
      },
      camera_ids: ["cam1"],
      screenshots: [
        {
          id: "ss-3",
          alert_id: "alert-2",
          camera_id: "cam1",
          camera_name: "Dashboard Camera",
          url: "https://via.placeholder.com/640x360/E74C3C/FFFFFF?text=Speeding+Alert",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          capture_offset: 0,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
      notes: [],
      history: [
        {
          id: "hist-2",
          alert_id: "alert-2",
          action: "acknowledged",
          user_id: "user-1",
          user_name: "Admin User",
          details: "Alert acknowledged by operator",
          timestamp: new Date(Date.now() - 1800000).toISOString(),
        },
      ],
      escalated: false,
      requires_action: true,
      auto_resolved: false,
      acknowledged_at: new Date(Date.now() - 1800000).toISOString(),
      acknowledged_by: "user-1",
      acknowledged_by_name: "Admin User",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: "alert-3",
      alert_type: "driver_distraction",
      severity: "medium",
      status: "investigating",
      title: "Driver Distraction Detected",
      description: "Driver looking away from road for extended period",
      vehicle_id: "vehicle-3",
      vehicle_registration: "LMN-456",
      driver_id: "driver-3",
      driver_name: "Bob Wilson",
      timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      location: {
        latitude: 41.8781,
        longitude: -87.6298,
        address: "Chicago, IL",
      },
      camera_ids: ["cam4"],
      screenshots: [
        {
          id: "ss-4",
          alert_id: "alert-3",
          camera_id: "cam4",
          camera_name: "Interior Camera",
          url: "https://via.placeholder.com/640x360/F39C12/FFFFFF?text=Interior+View",
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          capture_offset: 0,
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
      ],
      notes: [
        {
          id: "note-2",
          alert_id: "alert-3",
          user_id: "user-1",
          user_name: "Admin User",
          content: "Driver was adjusting GPS. No safety concern.",
          is_internal: false,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
      history: [
        {
          id: "hist-3",
          alert_id: "alert-3",
          action: "status_changed",
          user_id: "user-1",
          user_name: "Admin User",
          old_value: "acknowledged",
          new_value: "investigating",
          details: "Started investigation",
          timestamp: new Date(Date.now() - 5400000).toISOString(),
        },
      ],
      escalated: false,
      requires_action: true,
      auto_resolved: false,
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 5400000).toISOString(),
    },
  ];

  const mockStatistics = {
    total_alerts: 45,
    new_alerts: 8,
    acknowledged_alerts: 12,
    investigating_alerts: 5,
    escalated_alerts: 2,
    resolved_today: 18,
    critical_alerts: 3,
    average_response_time_minutes: 12,
    alerts_by_type: {},
    alerts_by_severity: {},
    alerts_by_vehicle: [],
    alerts_by_driver: [],
  };

  dispatch(actions.fetchAlerts({ data: mockAlerts, statistics: mockStatistics }));
  dispatch(actions.setUnreadCount(mockAlerts.filter(a => a.status === 'new').length));
}, []);
```

### Step 5: Test the UI (5 min)

1. **Start your dev server**:
   ```bash
   npm run dev
   ```

2. **Navigate to these URLs**:
   - `http://localhost:3000/video-alerts` - See alert list with mock data
   - `http://localhost:3000/video-alerts/alert-1` - See alert detail page
   - `http://localhost:3000/video-feeds` - See video feeds page

3. **Test features**:
   - [ ] See 3 mock alerts in the list
   - [ ] Click bell icon to see notifications (should show "8 new")
   - [ ] Click "View" to open alert detail
   - [ ] Add a note to an alert
   - [ ] Try to close an alert (should require notes)
   - [ ] Check that screenshots are displayed
   - [ ] Verify timeline shows history

---

## 🎯 What You Should See

### Alert List Page
- 6 statistics cards at top
- Tabs: All (3), New (1), Acknowledged (1), Investigating (1)
- Table with 3 alerts
- Color-coded severity badges
- Status indicators

### Alert Detail Page
- Alert header with severity badge
- 3 tabs: Screenshots, Videos, Timeline
- Screenshots displayed in grid
- Notes section on sidebar
- Add note functionality working
- Action buttons visible

### Video Feeds Page
- 2x2 grid of video players
- Dark theme background
- Clean camera info at bottom
- No overlays on videos

### Bell Notification
- Shows "8" unread count
- Click opens dropdown
- Shows recent alerts
- Quick acknowledge buttons

---

## ✅ Success Criteria

- [ ] Dependencies installed
- [ ] Provider added to layout
- [ ] Bell notification visible in header
- [ ] Navigation links added
- [ ] Mock data added to context
- [ ] All 3 pages load without errors
- [ ] Mock data displays correctly
- [ ] Bell notification shows count
- [ ] Can navigate between pages
- [ ] Can add notes to alerts
- [ ] Close modal requires notes

---

## 🔧 Troubleshooting

### "useVideoAlerts must be used within VideoAlertsProvider"
**Fix**: Make sure `VideoAlertsProvider` wraps your component in layout.tsx

### "Cannot find module 'date-fns'"
**Fix**: Run `npm install date-fns`

### Bell notification not showing
**Fix**: Make sure you added `<AlertBellNotification />` to your header

### Mock data not appearing
**Fix**: Check browser console for errors, ensure useEffect is added correctly

### Pages showing errors
**Fix**: Ensure all imports are correct and components exist

---

## 🚀 Next Steps After Testing

Once everything works with mock data:

1. **Remove mock data** from context
2. **Implement backend API** endpoints
3. **Connect real data** sources
4. **Set up WebSocket** for real-time updates
5. **Configure file storage** for screenshots
6. **Add authentication** middleware
7. **Deploy to production**

---

## 📚 Reference Documents

- **Complete docs**: `VIDEO_ALERT_SYSTEM_README.md`
- **Integration guide**: `INTEGRATION_GUIDE.md`
- **Implementation details**: `IMPLEMENTATION_SUMMARY.md`
- **API examples**: `src/app/api/video-alerts/SAMPLE_API_IMPLEMENTATION.ts`

---

## 🎉 You're Done!

If all checkboxes above are checked, your video alert system is ready to use with mock data. You can now proceed with backend integration.

**Need help?** Check the comprehensive documentation files included in the project.

**Ready for production?** See `INTEGRATION_GUIDE.md` for backend setup.
