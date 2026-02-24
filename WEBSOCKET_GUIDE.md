# WebSocket Real-Time Ride Notifications Guide

This guide explains how to use the WebSocket functionality for real-time ride notifications.

## Overview

When a user books a ride, all nearby drivers (within 2km radius) instantly receive a notification via WebSocket with:
- Ride details (pickup and destination)
- Price information
- Distance from driver to user pickup location
- User information

## Server Setup

The WebSocket server is automatically initialized when the Express server starts. It runs on the same port as your HTTP server.

## Driver App Integration

### 1. Connect to WebSocket Server

```javascript
import io from 'socket.io-client';

const socket = io('http://your-server-url:3000', {
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected to WebSocket server');
  
  // Send driver ID after connection
  socket.emit('driver:connect', {
    driverId: YOUR_DRIVER_USER_ID
  });
});
```

### 2. Listen for New Ride Requests

```javascript
socket.on('ride:new-request', (rideData) => {
  console.log('New ride request received:', rideData);
  
  // rideData contains:
  // {
  //   ride_id: 123,
  //   user: { id, name, phone },
  //   from: { latitude, longitude, address },
  //   to: { latitude, longitude, address },
  //   vehicle_type: 'car',
  //   car_variety: 'car_plus',
  //   price: {
  //     base_fare: 50,
  //     distance_fare: 100,
  //     time_fare: 30,
  //     surge_multiplier: 1.2,
  //     total_fare: 180
  //   },
  //   distance: 5.2, // Distance from pickup to destination
  //   estimated_duration: 15, // in minutes
  //   driver_distance: 1.5, // Distance from driver to user (in km)
  //   created_at: '2024-01-15T10:30:00Z'
  // }
  
  // Display ride request to driver
  showRideRequest(rideData);
});
```

### 3. Update Driver Location

Drivers should update their location regularly so they can receive nearby ride requests.

**Via REST API:**
```javascript
// Update location for all vehicles
POST /api/rides/driver/update-location
Headers: Authorization: Bearer <driver_token>
Body: {
  "latitude": 27.7172,
  "longitude": 85.3240
}

// Update location for specific vehicle
POST /api/rides/driver/update-location
Headers: Authorization: Bearer <driver_token>
Body: {
  "latitude": 27.7172,
  "longitude": 85.3240,
  "vehicle_id": 1
}
```

**Via WebSocket (optional):**
```javascript
socket.emit('driver:update-location', {
  driverId: YOUR_DRIVER_USER_ID,
  latitude: 27.7172,
  longitude: 85.3240
});
```

### 4. Handle Disconnection

```javascript
socket.on('disconnect', () => {
  console.log('Disconnected from WebSocket server');
  // Attempt to reconnect
  socket.connect();
});
```

## User App Integration

Users don't need to connect to WebSocket for booking rides. They simply use the REST API:

```javascript
POST /api/rides/book
Headers: Authorization: Bearer <user_token>
Body: {
  "from_latitude": 27.7172,
  "from_longitude": 85.3240,
  "from_address": "Pickup address",
  "to_latitude": 27.7288,
  "to_longitude": 85.3314,
  "to_address": "Destination address",
  "vehicle_type": "car",
  "car_variety": "car_plus"
}
```

The system automatically:
1. Creates the ride
2. Finds nearby drivers (within 2km)
3. Emits ride requests to those drivers via WebSocket

## Distance Calculation

The system uses the Haversine formula to calculate distances between coordinates. Drivers are filtered based on:
- Vehicle type match
- Car variety match (if applicable)
- Distance from user pickup location (≤ 2km)
- Vehicle availability
- Driver account status (active)

## Example Flow

1. **User books a ride** → `POST /api/rides/book`
2. **System finds nearby drivers** → Filters drivers within 2km radius
3. **System emits to drivers** → `socket.emit('ride:new-request', rideData)` to each nearby driver
4. **Driver receives notification** → Driver app shows ride request
5. **Driver accepts ride** → `POST /api/rides/accept` with `ride_id`

## Live Location Sharing During Rides

### For Drivers

**Share location via REST API:**
```javascript
POST /api/rides/driver/share-location
Headers: Authorization: Bearer <driver_token>
Body: {
  "ride_id": 123,
  "latitude": 27.7172,
  "longitude": 85.3240
}
```

**Share location via WebSocket:**
```javascript
socket.emit('ride:driver-location', {
  ride_id: 123,
  latitude: 27.7172,
  longitude: 85.3240
});
```

### For Users

**Share location via REST API:**
```javascript
POST /api/rides/user/share-location
Headers: Authorization: Bearer <user_token>
Body: {
  "ride_id": 123,
  "latitude": 27.7172,
  "longitude": 85.3240
}
```

**Share location via WebSocket:**
```javascript
socket.emit('ride:user-location', {
  ride_id: 123,
  latitude: 27.7172,
  longitude: 85.3240
});
```

### Listen for Location Updates

**User listens for driver location:**
```javascript
socket.on('ride:driver-location-update', (data) => {
  // data: { ride_id, latitude, longitude, timestamp }
  updateDriverMarkerOnMap(data.latitude, data.longitude);
});
```

**Driver listens for user location:**
```javascript
socket.on('ride:user-location-update', (data) => {
  // data: { ride_id, latitude, longitude, timestamp }
  updateUserMarkerOnMap(data.latitude, data.longitude);
});
```

### Get Driver Location (REST API)

**User can fetch driver's current location:**
```javascript
GET /api/rides/:ride_id/driver-location
Headers: Authorization: Bearer <user_token>
```

## Important Notes

- Drivers must have their location updated in the database (`vehicles.current_latitude` and `vehicles.current_longitude`)
- Only active and available vehicles are considered
- Only drivers with `users_type = 'driver'` receive notifications
- The 2km radius is configurable in `controllers/rideController.js` (line 125)
- Live location sharing works only for rides with status `accepted` or `in_progress`

## Troubleshooting

1. **Not receiving ride requests?**
   - Ensure driver location is updated
   - Check if vehicle is active and available
   - Verify driver is within 2km of pickup location
   - Check WebSocket connection status

2. **Connection issues?**
   - Verify server URL and port
   - Check CORS settings in `utils/socketService.js`
   - Ensure driver ID is sent after connection

3. **Location not updating?**
   - Verify coordinates are valid (latitude: -90 to 90, longitude: -180 to 180)
   - Check authentication token
   - Ensure vehicle belongs to the driver
