# API Endpoints Created in This Session

This document lists all the API endpoints that were created during this chat session.

---

## 1. Driver Registration API

### Base URL
```
/api/driver-registration
```

### Endpoints

#### Register Driver
- **Method:** `POST`
- **Endpoint:** `/api/driver-registration`
- **Authentication:** Not required
- **Description:** Register a new driver with vehicle and document uploads
- **Request Body:**
  ```json
  {
    "user_id": 1,
    "full_name": "John Doe",
    "date_of_birth": "1990-01-01",
    "gender": "Male",
    "phone_number": "+1234567890",
    "email": "driver@example.com",
    "vehicle_type": "car",
    "make": "Toyota",
    "model": "Camry",
    "year_of_manufacture": 2020,
    "driving_license_front": "file",
    "driving_license_back": "file",
    "vehicle_registration_front": "file",
    "insurance_certificate": "file",
    "citizenship_front": "file",
    "citizenship_back": "file",
    "number_plate_front": "file",
    "number_plate_back": "file"
  }
  ```
- **Response:** Returns driver registration data with uploaded file URLs

---

## 2. Form APIs

### Base URL
```
/api/form
```

### Endpoints

#### Join Kalki Sena Clinic
- **Method:** `POST`
- **Endpoint:** `/api/form/join-kalki-sena`
- **Authentication:** Not required
- **Description:** Register to join Kalki Sena Clinic
- **Request Body:**
  ```json
  {
    "user_id": 1,
    "full_name": "John Doe",
    "mobile_number": "+1234567890",
    "family_members": 4,
    "email": "user@example.com"
  }
  ```

#### Register for Free Coaching
- **Method:** `POST`
- **Endpoint:** `/api/form/register-coaching`
- **Authentication:** Not required
- **Description:** Register for free coaching
- **Request Body:**
  ```json
  {
    "user_id": 1,
    "entrance_preparation": "Engineering",
    "coaching_subject": "Mathematics"
  }
  ```

#### Register for Hostel
- **Method:** `POST`
- **Endpoint:** `/api/form/register-hostel`
- **Authentication:** Not required
- **Description:** Register for hostel accommodation
- **Request Body:**
  ```json
  {
    "user_id": 1,
    "full_name": "John Doe",
    "mobile_number": "+1234567890",
    "email": "user@example.com",
    "hostel_location": "Kathmandu"
  }
  ```

---

## 3. Nepal Payment Gateway API

### Base URL
```
/api/payment
```

### Endpoints

#### Get Payment Instruments
- **Method:** `GET`
- **Endpoint:** `/api/payment/instruments`
- **Authentication:** Not required
- **Description:** Get available payment instruments from Nepal Payment gateway
- **Response:** Returns list of payment instruments

#### Get Service Charge
- **Method:** `POST`
- **Endpoint:** `/api/payment/service-charge`
- **Authentication:** Not required
- **Description:** Calculate service charge for payment
- **Request Body:**
  ```json
  {
    "amount": 1000,
    "instrument_code": "ESEWA"
  }
  ```

#### Create Payment
- **Method:** `POST`
- **Endpoint:** `/api/payment/create`
- **Authentication:** Not required
- **Description:** Create a new payment and get ProcessId
- **Request Body:**
  ```json
  {
    "amount": 1000,
    "order_id": "NP-20250115-0001-A3B9"
  }
  ```
- **Response:** Returns payment URL and form data

#### Payment Webhook
- **Method:** `POST`
- **Endpoint:** `/api/payment/webhook`
- **Authentication:** Not required
- **Description:** Webhook endpoint for payment notifications
- **Request Body:**
  ```json
  {
    "MerchantTxnId": "NP-20250115-0001-A3B9"
  }
  ```

#### Check Transaction Status
- **Method:** `POST`
- **Endpoint:** `/api/payment/check-status`
- **Authentication:** Not required
- **Description:** Check the status of a payment transaction
- **Request Body:**
  ```json
  {
    "order_id": "NP-20250115-0001-A3B9"
  }
  ```

---

## 4. Driver Authentication API

### Base URL
```
/api/driver-auth
```

### Endpoints

#### Driver Login
- **Method:** `POST`
- **Endpoint:** `/api/driver-auth/login`
- **Authentication:** Not required
- **Description:** Login for drivers (only users with `users_type = 'driver'`)
- **Request Body:**
  ```json
  {
    "email": "driver@example.com",
    "password": "password123"
  }
  ```
- **Response:** Returns user data and JWT token

#### Get Driver Profile
- **Method:** `GET`
- **Endpoint:** `/api/driver-auth/profile`
- **Authentication:** Required (Bearer token)
- **Description:** Get authenticated driver's profile
- **Response:** Returns driver profile data

---

## 5. Ride & Location APIs

### Base URL
```
/api/rides
```

### Endpoints

#### Update Driver Location
- **Method:** `POST`
- **Endpoint:** `/api/rides/driver/update-location`
- **Authentication:** Required (Driver token)
- **Description:** Update driver's current location for ride matching
- **Request Body:**
  ```json
  {
    "latitude": 27.7172,
    "longitude": 85.3240,
    "vehicle_id": 1
  }
  ```

#### Share Driver Location (During Active Ride)
- **Method:** `POST`
- **Endpoint:** `/api/rides/driver/share-location`
- **Authentication:** Required (Driver token)
- **Description:** Share driver's live location during active ride
- **Request Body:**
  ```json
  {
    "ride_id": 123,
    "latitude": 27.7172,
    "longitude": 85.3240
  }
  ```
- **Note:** Works only for rides with status `accepted` or `in_progress`

#### Share User Location (During Active Ride)
- **Method:** `POST`
- **Endpoint:** `/api/rides/user/share-location`
- **Authentication:** Required (User token)
- **Description:** Share user's live location during active ride
- **Request Body:**
  ```json
  {
    "ride_id": 123,
    "latitude": 27.7172,
    "longitude": 85.3240
  }
  ```
- **Note:** Works only for rides with status `accepted` or `in_progress`

#### Get Driver Location
- **Method:** `GET`
- **Endpoint:** `/api/rides/:ride_id/driver-location`
- **Authentication:** Required (User token)
- **Description:** Get driver's current location for an active ride
- **Response:**
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

## WebSocket Events

### Driver Events

#### Connect as Driver
- **Event:** `driver:connect`
- **Data:**
  ```json
  {
    "driverId": 1
  }
  ```

#### Receive New Ride Request
- **Event:** `ride:new-request`
- **Description:** Receive real-time ride request notifications
- **Data:**
  ```json
  {
    "ride_id": 123,
    "user": { "id": 1, "name": "John", "phone": "+1234567890" },
    "from": { "latitude": 27.7172, "longitude": 85.3240, "address": "Pickup" },
    "to": { "latitude": 27.7288, "longitude": 85.3314, "address": "Destination" },
    "vehicle_type": "car",
    "car_variety": "car_plus",
    "price": { "base_fare": 50, "distance_fare": 100, "total_fare": 180 },
    "distance": 5.2,
    "estimated_duration": 15,
    "driver_distance": 1.5
  }
  ```

#### Share Driver Location (WebSocket)
- **Event:** `ride:driver-location`
- **Data:**
  ```json
  {
    "ride_id": 123,
    "latitude": 27.7172,
    "longitude": 85.3240
  }
  ```

#### Receive User Location Update
- **Event:** `ride:user-location-update`
- **Description:** Receive user's live location during active ride
- **Data:**
  ```json
  {
    "ride_id": 123,
    "latitude": 27.7172,
    "longitude": 85.3240,
    "timestamp": "2024-01-15T10:30:00Z"
  }
  ```

### User Events

#### Connect as User
- **Event:** `user:connect`
- **Data:**
  ```json
  {
    "userId": 1
  }
  ```

#### Share User Location (WebSocket)
- **Event:** `ride:user-location`
- **Data:**
  ```json
  {
    "ride_id": 123,
    "latitude": 27.7172,
    "longitude": 85.3240
  }
  ```

#### Receive Driver Location Update
- **Event:** `ride:driver-location-update`
- **Description:** Receive driver's live location during active ride
- **Data:**
  ```json
  {
    "ride_id": 123,
    "latitude": 27.7172,
    "longitude": 85.3240,
    "timestamp": "2024-01-15T10:30:00Z"
  }
  ```

---

## Summary

### Total Endpoints Created: 17

1. **Driver Registration:** 1 endpoint
2. **Form APIs:** 3 endpoints
3. **Payment Gateway:** 5 endpoints
4. **Driver Authentication:** 2 endpoints
5. **Ride & Location:** 4 endpoints
6. **WebSocket Events:** 6 events

### Authentication Requirements

- **No Authentication Required:**
  - Driver Registration
  - Form APIs (Join Kalki Sena, Free Coaching, Hostel)
  - Payment Gateway APIs (except webhook may need verification)
  - Driver Login

- **Authentication Required:**
  - Driver Profile
  - All Ride & Location APIs
  - Driver Location Updates

### File Uploads

- **Driver Registration** supports multiple image uploads:
  - Driving license (front & back)
  - Vehicle registration (front)
  - Insurance certificate
  - Citizenship (front & back)
  - Number plate (front & back)

---

## Notes

- All endpoints use JSON format for request/response
- File uploads use `multipart/form-data` (Driver Registration)
- WebSocket server runs on the same port as HTTP server
- Live location sharing works only for rides with status `accepted` or `in_progress`
- Driver location updates should be sent every 5-10 seconds when driver is active
