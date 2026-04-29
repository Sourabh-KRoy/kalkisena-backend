const { Ride, Vehicle } = require("../models");
const { validationResult } = require("express-validator");
const {
  getDirections,
  geocodeAddress,
  reverseGeocode,
} = require("../services/googleMapsService");
const {
  emitDriverLocationToUser,
  emitUserLocationToDriver,
  setDriverLocationForRide,
  getDriverLocationForRide,
} = require("../utils/socketService");

/**
 * Share driver location during active ride
 */
const shareDriverLocation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const driverId = req.user.id;
    const { ride_id, latitude, longitude } = req.body;

    if (req.user.users_type !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Only drivers can share location",
      });
    }

    // Validate coordinates
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude",
      });
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: "Invalid longitude",
      });
    }

    // Verify ride exists and belongs to driver
    const ride = await Ride.findByPk(ride_id);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    if (ride.driver_id !== driverId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to share location for this ride",
      });
    }

    if (ride.status !== "in_progress" || !ride.otp_verified_at) {
      return res.status(400).json({
        success: false,
        message:
          "Driver location can be shared only after OTP verification and ride start",
      });
    }

    // Update vehicle location
    if (ride.vehicle_id) {
      await Vehicle.update(
        {
          current_latitude: parseFloat(latitude),
          current_longitude: parseFloat(longitude),
        },
        {
          where: { id: ride.vehicle_id },
        },
      );
    }

    // Emit location to user via WebSocket
    const cachedLocation = setDriverLocationForRide(
      ride_id,
      latitude,
      longitude,
      driverId,
    );
    emitDriverLocationToUser(ride.user_id, ride_id, latitude, longitude);

    res.json({
      success: true,
      message: "Location shared successfully",
      data: {
        ride_id: ride_id,
        latitude: cachedLocation.latitude,
        longitude: cachedLocation.longitude,
        timestamp: cachedLocation.timestamp,
      },
    });
  } catch (error) {
    console.error("Share driver location error:", error);
    res.status(500).json({
      success: false,
      message: "Error sharing location",
      error: error.message,
    });
  }
};

/**
 * Share user location during active ride
 */
const shareUserLocation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const userId = req.user.id;
    const { ride_id, latitude, longitude } = req.body;

    // Validate coordinates
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude",
      });
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: "Invalid longitude",
      });
    }

    // Verify ride exists and belongs to user
    const ride = await Ride.findByPk(ride_id);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    if (ride.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to share location for this ride",
      });
    }

    if (ride.status !== "in_progress" || !ride.otp_verified_at) {
      return res.status(400).json({
        success: false,
        message:
          "Rider location can be shared only after OTP verification and ride start",
      });
    }

    // Emit location to driver via WebSocket
    if (ride.driver_id) {
      emitUserLocationToDriver(ride.driver_id, ride_id, latitude, longitude);
    }

    res.json({
      success: true,
      message: "Location shared successfully",
      data: {
        ride_id: ride_id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Share user location error:", error);
    res.status(500).json({
      success: false,
      message: "Error sharing location",
      error: error.message,
    });
  }
};

/**
 * Get current location of driver for active ride
 */
const getDriverLocation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { ride_id } = req.params;

    const ride = await Ride.findByPk(ride_id, {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          attributes: ["id", "current_latitude", "current_longitude"],
        },
      ],
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    if (ride.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view location for this ride",
      });
    }

    if (ride.status !== "in_progress" || !ride.otp_verified_at) {
      return res.status(400).json({
        success: false,
        message:
          "Driver location is available only after OTP verification and ride start",
      });
    }

    const cachedLocation = getDriverLocationForRide(ride_id);
    if (cachedLocation) {
      return res.json({
        success: true,
        data: cachedLocation,
      });
    }

    if (
      !ride.vehicle ||
      !ride.vehicle.current_latitude ||
      !ride.vehicle.current_longitude
    ) {
      return res.status(404).json({
        success: false,
        message: "Driver location not available",
      });
    }

    res.json({
      success: true,
      data: {
        ride_id: ride_id,
        latitude: parseFloat(ride.vehicle.current_latitude),
        longitude: parseFloat(ride.vehicle.current_longitude),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Get driver location error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching driver location",
      error: error.message,
    });
  }
};

/**
 * Debug/diagnostic endpoint to fetch route polyline from Google Directions API.
 * Helps identify straight-line issues caused by key restrictions or bad coordinates.
 */
const getRideDirectionsDebug = async (req, res) => {
  try {
    const userId = req.user.id;
    const { ride_id } = req.params;

    const ride = await Ride.findByPk(ride_id, {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          attributes: ["id", "current_latitude", "current_longitude"],
        },
      ],
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    const isRideUser = ride.user_id === userId;
    const isRideDriver = ride.driver_id === userId;
    if (!isRideUser && !isRideDriver) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view route for this ride",
      });
    }

    if (!ride.to_latitude || !ride.to_longitude) {
      return res.status(400).json({
        success: false,
        message: "Destination coordinates are not available for this ride",
      });
    }

    const cachedDriverLocation = getDriverLocationForRide(ride.id);
    const originLatitude =
      cachedDriverLocation?.latitude ??
      (ride.vehicle?.current_latitude != null
        ? parseFloat(ride.vehicle.current_latitude)
        : parseFloat(ride.from_latitude));
    const originLongitude =
      cachedDriverLocation?.longitude ??
      (ride.vehicle?.current_longitude != null
        ? parseFloat(ride.vehicle.current_longitude)
        : parseFloat(ride.from_longitude));

    if (
      originLatitude == null ||
      originLongitude == null ||
      Number.isNaN(originLatitude) ||
      Number.isNaN(originLongitude)
    ) {
      return res.status(400).json({
        success: false,
        message: "Origin coordinates are not available for this ride",
      });
    }

    const destinationLatitude = parseFloat(ride.to_latitude);
    const destinationLongitude = parseFloat(ride.to_longitude);

    const directions = await getDirections({
      originLatitude,
      originLongitude,
      destinationLatitude,
      destinationLongitude,
      mode: "driving",
    });
    const firstRoute = directions.route || null;

    return res.json({
      success: true,
      data: {
        ride_id: ride.id,
        origin: {
          latitude: originLatitude,
          longitude: originLongitude,
          source: cachedDriverLocation
            ? "socket_cache"
            : ride.vehicle?.current_latitude != null &&
                ride.vehicle?.current_longitude != null
              ? "vehicle_current_location"
              : "ride_pickup_location",
        },
        destination: {
          latitude: destinationLatitude,
          longitude: destinationLongitude,
        },
        google_directions_status: directions.status || "UNKNOWN",
        google_error_message: directions.errorMessage || null,
        route_found: !!firstRoute,
        overview_polyline: directions.polyline || null,
        legs_count: Array.isArray(firstRoute?.legs) ? firstRoute.legs.length : 0,
      },
    });
  } catch (error) {
    console.error("Get ride directions debug error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching route directions",
      error: error.message,
    });
  }
};

/**
 * Public route preview between two coordinates.
 */
const getRoutePreview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const {
      origin_latitude,
      origin_longitude,
      destination_latitude,
      destination_longitude,
    } = req.query;

    if (
      origin_latitude == null ||
      origin_longitude == null ||
      destination_latitude == null ||
      destination_longitude == null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "origin_latitude, origin_longitude, destination_latitude and destination_longitude are required",
      });
    }

    const directions = await getDirections({
      originLatitude: parseFloat(origin_latitude),
      originLongitude: parseFloat(origin_longitude),
      destinationLatitude: parseFloat(destination_latitude),
      destinationLongitude: parseFloat(destination_longitude),
      mode: "driving",
    });

    if (directions.status !== "OK" || !directions.leg) {
      return res.status(400).json({
        success: false,
        message: "Unable to fetch route preview",
        data: {
          google_directions_status: directions.status,
          google_error_message: directions.errorMessage,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        route_found: true,
        distance_meters: directions.distanceMeters,
        duration_seconds: directions.durationSeconds,
        distance_text: directions.distanceText,
        duration_text: directions.durationText,
        overview_polyline: directions.polyline,
      },
    });
  } catch (error) {
    console.error("Get route preview error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: "Error fetching route preview",
      error: error.message,
    });
  }
};

const getLiveTrackingSnapshot = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const userId = req.user.id;
    const { ride_id } = req.params;
    const { current_latitude, current_longitude } = req.query;

    const ride = await Ride.findByPk(ride_id, {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
          attributes: ["id", "current_latitude", "current_longitude"],
        },
      ],
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    if (ride.user_id !== userId && ride.driver_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this ride tracking data",
      });
    }

    if (!["pending", "accepted", "in_progress"].includes(ride.status)) {
      return res.status(400).json({
        success: false,
        message:
          "Tracking is available only for pending/accepted/in-progress rides",
      });
    }
    if (ride.status === "pending") {
      const hasRequestedCurrentLocation =
        current_latitude != null && current_longitude != null;
      const requestedCurrentLatitude = hasRequestedCurrentLocation
        ? parseFloat(current_latitude)
        : null;
      const requestedCurrentLongitude = hasRequestedCurrentLocation
        ? parseFloat(current_longitude)
        : null;

      if (
        hasRequestedCurrentLocation &&
        (Number.isNaN(requestedCurrentLatitude) ||
          Number.isNaN(requestedCurrentLongitude))
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid current location coordinates",
        });
      }

      const originLatitude =
        requestedCurrentLatitude != null
          ? requestedCurrentLatitude
          : parseFloat(ride.from_latitude);
      const originLongitude =
        requestedCurrentLongitude != null
          ? requestedCurrentLongitude
          : parseFloat(ride.from_longitude);
      const destinationLatitude = parseFloat(ride.to_latitude);
      const destinationLongitude = parseFloat(ride.to_longitude);

      const directions = await getDirections({
        originLatitude,
        originLongitude,
        destinationLatitude,
        destinationLongitude,
        mode: "driving",
      });

      return res.json({
        success: true,
        data: {
          ride_id: ride.id,
          ride_status: ride.status,
          tracking_mode: "user_route_preview",
          origin: {
            latitude: originLatitude,
            longitude: originLongitude,
            source: hasRequestedCurrentLocation
              ? "request_current_location"
              : "ride_pickup_location",
          },
          destination: {
            latitude: destinationLatitude,
            longitude: destinationLongitude,
            phase: "drop",
          },
          route: {
            google_directions_status: directions.status,
            google_error_message: directions.errorMessage,
            distance_meters: directions.distanceMeters,
            duration_seconds: directions.durationSeconds,
            distance_text: directions.distanceText,
            duration_text: directions.durationText,
            overview_polyline: directions.polyline,
          },
        },
      });
    }

    const cachedDriverLocation = getDriverLocationForRide(ride.id);
    const originLatitude =
      cachedDriverLocation?.latitude ??
      (ride.vehicle?.current_latitude != null
        ? parseFloat(ride.vehicle.current_latitude)
        : null);
    const originLongitude =
      cachedDriverLocation?.longitude ??
      (ride.vehicle?.current_longitude != null
        ? parseFloat(ride.vehicle.current_longitude)
        : null);

    if (originLatitude == null || originLongitude == null) {
      return res.status(404).json({
        success: false,
        message: "Driver location not available yet",
      });
    }

    const destinationLatitude =
      ride.status === "accepted"
        ? parseFloat(ride.from_latitude)
        : parseFloat(ride.to_latitude);
    const destinationLongitude =
      ride.status === "accepted"
        ? parseFloat(ride.from_longitude)
        : parseFloat(ride.to_longitude);

    const directions = await getDirections({
      originLatitude,
      originLongitude,
      destinationLatitude,
      destinationLongitude,
      mode: "driving",
    });

    return res.json({
      success: true,
      data: {
        ride_id: ride.id,
        ride_status: ride.status,
        tracking_mode: "driver_live_tracking",
        driver_location: {
          latitude: originLatitude,
          longitude: originLongitude,
          source: cachedDriverLocation ? "socket_cache" : "vehicle_last_location",
          timestamp:
            cachedDriverLocation?.timestamp ||
            (ride.updated_at ? new Date(ride.updated_at).toISOString() : null),
        },
        destination: {
          latitude: destinationLatitude,
          longitude: destinationLongitude,
          phase: ride.status === "accepted" ? "pickup" : "drop",
        },
        route: {
          google_directions_status: directions.status,
          google_error_message: directions.errorMessage,
          distance_meters: directions.distanceMeters,
          duration_seconds: directions.durationSeconds,
          distance_text: directions.distanceText,
          duration_text: directions.durationText,
          overview_polyline: directions.polyline,
        },
      },
    });
  } catch (error) {
    console.error("Get live tracking snapshot error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: "Error fetching live tracking snapshot",
      error: error.message,
    });
  }
};

const getAddressFromCoordinates = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { latitude, longitude } = req.query;
    if (latitude == null || longitude == null) {
      return res.status(400).json({
        success: false,
        message: "latitude and longitude are required",
      });
    }

    const geocode = await reverseGeocode(
      parseFloat(latitude),
      parseFloat(longitude),
    );

    if (!geocode.result) {
      return res.status(404).json({
        success: false,
        message: "No address found for these coordinates",
        data: {
          geocode_status: geocode.status,
          geocode_error_message: geocode.errorMessage,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        formatted_address: geocode.result.formatted_address,
        place_id: geocode.result.place_id || null,
        geocode_status: geocode.status,
      },
    });
  } catch (error) {
    console.error("Reverse geocode error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: "Error reverse geocoding coordinates",
      error: error.message,
    });
  }
};

const getCoordinatesFromAddress = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { address } = req.query;
    if (!address || !String(address).trim()) {
      return res.status(400).json({
        success: false,
        message: "address is required",
      });
    }

    const geocode = await geocodeAddress(String(address).trim());

    if (!geocode.result || !geocode.result.geometry?.location) {
      return res.status(404).json({
        success: false,
        message: "No coordinates found for this address",
        data: {
          geocode_status: geocode.status,
          geocode_error_message: geocode.errorMessage,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        formatted_address: geocode.result.formatted_address,
        latitude: geocode.result.geometry.location.lat,
        longitude: geocode.result.geometry.location.lng,
        place_id: geocode.result.place_id || null,
        geocode_status: geocode.status,
      },
    });
  } catch (error) {
    console.error("Forward geocode error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: "Error geocoding address",
      error: error.message,
    });
  }
};

module.exports = {
  shareDriverLocation,
  shareUserLocation,
  getDriverLocation,
  getRideDirectionsDebug,
  getRoutePreview,
  getLiveTrackingSnapshot,
  getAddressFromCoordinates,
  getCoordinatesFromAddress,
};
