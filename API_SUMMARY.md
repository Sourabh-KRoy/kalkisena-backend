# Ride Booking & Location Tracking API Summary

## Overview

This document summarizes the two main APIs for ride booking and location tracking.

## 1. User App - Book Ride API

### Endpoint
```
POST /api/rides/book
```

### Authentication
- Requires: User authentication token
- Header: `Authorization: Bearer <user_token>`

### Request Body
```json
{
  "from_latitude": 27.7172,
  "from_longitude": 85.3240,
  "from_address": "Pickup address",
  "to_latitude": 27.7288,
  "to_longitude": 85.3314,
  "to_address": "Destination address",
  "vehicle_type": "car",
  "car_variety": "car_plus",
  "surge_multiplier": 1.2
}
```

### Response
```json
{
  "success": true,
  "message": "Ride booked successfully",
  "data": {
    "ride": {
      "id": 123,
      "user_id": 1,
      "vehicle_type": "car",
      "from_address": "Pickup address",
      "to_address": "Destination address",
      "total_fare": 180.00,
      "status": "pending"
    }
  }
}
```

### What Happens
1. Ride is created in database
2. System finds nearby drivers (within 2km)
3. Ride requests are sent to drivers via WebSocket
4. Drivers receive instant notification with ride details

---

## 2. Driver App - Fetch Available Rides API

### Endpoint
```
GET /api/rides/available
```

### Authentication
- Requires: Driver authentication token
- Header: `Authorization: Bearer <driver_token>`

### Query Parameters
- `vehicle_type` (optional): Filter by vehicle type (`scooty`, `bike`, `car`)
- `car_variety` (optional): Filter by car variety (`car_plus`, `car_lite`, `taxi`)
- `latitude` (optional): Driver's current latitude (uses vehicle location if not provided)
- `longitude` (optional): Driver's current longitude (uses vehicle location if not provided)
- `radius` (optional): Search radius in km (default: 2km)

### Example Request
```
GET /api/rides/available?vehicle_type=car&car_variety=car_plus&radius=2
```

### Response
```json
{
  "success": true,
  "data": {
    "rides": [
      {
        "id": 123,
        "user": {
          "id": 1,
          "name": "John Doe",
          "phone": "+1234567890"
        },
        "from": {
          "latitude": 27.7172,
          "longitude": 85.3240,
          "address": "Pickup address"
        },
        "to": {
          "latitude": 27.7288,
          "longitude": 85.3314,
          "address": "Destination address"
        },
        "vehicle_type": "car",
        "car_variety": "car_plus",
        "base_fare": 50.00,
        "distance_fare": 100.00,
        "time_fare": 30.00,
        "total_fare": 180.00,
        "distance": 5.2,
        "estimated_duration": 15,
        "driver_distance": 1.5,
        "status": "pending",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "driver_vehicle": {
      "id": 1,
      "vehicle_type": "car",
      "car_variety": "car_plus",
      "vehicle_number": "ABC-1234",
      "current_location": {
        "latitude": 27.7150,
        "longitude": 85.3200
      }
    },
    "total_rides": 1,
    "radius_km": 2
  }
}
```

### Features
- Shows distance from driver to pickup location
- Filters by vehicle type and car variety
- Sorted by distance (nearest first)
- Only shows rides within specified radius

---

## 3. Driver Location Tracking API

### Endpoint
```
POST /api/rides/driver/update-location
```

### Authentication
- Requires: Driver authentication token
- Header: `Authorization: Bearer <driver_token>`

### Request Body
```json
{
  "latitude": 27.7172,
  "longitude": 85.3240,
  "vehicle_id": 1  // Optional: Update specific vehicle
}
```

### Response
```json
{
  "success": true,
  "message": "Driver location updated successfully",
  "data": {
    "vehicle_id": 1,
    "latitude": 27.7172,
    "longitude": 85.3240
  }
}
```

### Notes
- If `vehicle_id` is not provided, updates all vehicles for the driver
- Location is used to find nearby ride requests
- Should be updated regularly (every 5-10 seconds when driver is active)

---

## 4. Live Location Sharing During Rides

### Driver Shares Location

**REST API:**
```
POST /api/rides/driver/share-location
Body: {
  "ride_id": 123,
  "latitude": 27.7172,
  "longitude": 85.3240
}
```

**WebSocket:**
```javascript
socket.emit('ride:driver-location', {
  ride_id: 123,
  latitude: 27.7172,
  longitude: 85.3240
});
```

### User Shares Location

**REST API:**
```
POST /api/rides/user/share-location
Body: {
  "ride_id": 123,
  "latitude": 27.7172,
  "longitude": 85.3240
}
```

**WebSocket:**
```javascript
socket.emit('ride:user-location', {
  ride_id: 123,
  latitude: 27.7172,
  longitude: 85.3240
});
```

### Listen for Location Updates

**User receives driver location:**
```javascript
socket.on('ride:driver-location-update', (data) => {
  // Update map with driver's location
  // data: { ride_id, latitude, longitude, timestamp }
});
```

**Driver receives user location:**
```javascript
socket.on('ride:user-location-update', (data) => {
  // Update map with user's location
  // data: { ride_id, latitude, longitude, timestamp }
});
```

### Get Driver Location (REST API)

**User can fetch driver's current location:**
```
GET /api/rides/:ride_id/driver-location
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ride_id": 123,
    "latitude": 27.7172,
    "longitude": 85.3240,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

---

## Complete Flow

### User Books Ride
1. User calls `POST /api/rides/book`
2. System creates ride and finds nearby drivers
3. Drivers receive WebSocket notification
4. Drivers can fetch available rides via `GET /api/rides/available`

### Driver Accepts Ride
1. Driver calls `POST /api/rides/accept` with `ride_id`
2. Ride status changes to `accepted`
3. User receives notification

### During Active Ride
1. Driver shares location via `POST /api/rides/driver/share-location` or WebSocket
2. User receives driver location in real-time
3. User shares location via `POST /api/rides/user/share-location` or WebSocket
4. Driver receives user location in real-time
5. Both can see each other's live location on map

---

## Important Notes

- **Location Updates**: Drivers should update location every 5-10 seconds when active
- **Live Location**: Only works for rides with status `accepted` or `in_progress`
- **Radius**: Default search radius is 2km (configurable)
- **WebSocket**: Real-time updates require WebSocket connection
- **REST API**: Can be used as fallback or for polling
