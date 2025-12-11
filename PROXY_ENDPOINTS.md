# API Proxy Endpoints

All external API calls are now proxied through local API routes for better security and control.

## Available Proxy Routes

### 1. EPS Vehicles (Driver Matching)
- **Local**: `GET /api/eps-vehicles`
- **External**: `http://64.227.138.235:3000/api/eps-vehicles`
- **Usage**: Driver location tracking and matching on load plan
- **Returns**: Vehicle data with driver names, GPS coordinates, speed, etc.

### 2. CTrack Vehicle Data
- **Local**: `GET /api/ctrack-data`
- **External**: `http://64.227.126.176:3001/api/ctrack/data`
- **Usage**: Alternative vehicle tracking data
- **Returns**: CTrack vehicle tracking information

### 3. EPS Rewards
- **Local**: `GET /api/eps-rewards?path={endpoint}`
- **External**: `http://64.227.138.235:3000/api/eps-rewards/*`
- **Usage**: Driver risk assessment and rewards system
- **Example**: `/api/eps-rewards?path=driver-risk-assessment`

## WebSocket Connections (Not Proxied)

### CAN Bus WebSocket
- **Endpoint**: `ws://64.227.126.176:3002`
- **Usage**: Real-time fuel data on `/fuel` page
- **Note**: WebSocket connections cannot be proxied through API routes

## Migration Guide

Replace direct external API calls with proxy routes:

### Before:
```javascript
fetch('http://64.227.138.235:3000/api/eps-vehicles')
```

### After:
```javascript
fetch('/api/eps-vehicles')
```

### Before:
```javascript
fetch('http://64.227.138.235:3000/api/eps-rewards/driver-risk-assessment')
```

### After:
```javascript
fetch('/api/eps-rewards?path=driver-risk-assessment')
```

## Benefits

1. **Security**: External API URLs not exposed to client
2. **Flexibility**: Easy to switch backends without changing frontend code
3. **Caching**: Can add caching layer at proxy level
4. **Error Handling**: Centralized error handling
5. **Timeout Control**: Consistent timeout handling (15 seconds)
