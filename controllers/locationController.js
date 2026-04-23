const axios = require("axios");
const { Ride, Vehicle } = require("../models");
const { validationResult } = require("express-validator");
const {
  emitDriverLocationToUser,
  emitUserLocationToDriver,
  setDriverLocationForRide,
  getDriverLocationForRide,
} = require("../utils/socketService");
const { Op } = require("sequelize");

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

    const mapsApiKey =
      process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!mapsApiKey) {
      return res.status(500).json({
        success: false,
        message:
          "Google Maps API key missing. Set GOOGLE_MAPS_SERVER_API_KEY or GOOGLE_MAPS_API_KEY",
      });
    }

    const directionsUrl = "https://maps.googleapis.com/maps/api/directions/json";
    const response = await axios.get(directionsUrl, {
      params: {
        origin: `${originLatitude},${originLongitude}`,
        destination: `${destinationLatitude},${destinationLongitude}`,
        mode: "driving",
        key: mapsApiKey,
      },
      timeout: 8000,
    });

    const directions = response.data || {};
    const firstRoute = Array.isArray(directions.routes)
      ? directions.routes[0]
      : null;

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
        google_error_message: directions.error_message || null,
        route_found: !!firstRoute,
        overview_polyline: firstRoute?.overview_polyline?.points || null,
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

module.exports = {
  shareDriverLocation,
  shareUserLocation,
  getDriverLocation,
  getRideDirectionsDebug,
};
