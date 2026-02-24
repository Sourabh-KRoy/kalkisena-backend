const { Ride, Vehicle } = require('../models');
const { validationResult } = require('express-validator');
const { emitDriverLocationToUser, emitUserLocationToDriver } = require('../utils/socketService');
const { Op } = require('sequelize');

/**
 * Share driver location during active ride
 */
const shareDriverLocation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const driverId = req.user.id;
    const { ride_id, latitude, longitude } = req.body;

    if (req.user.users_type !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Only drivers can share location'
      });
    }

    // Validate coordinates
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude'
      });
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid longitude'
      });
    }

    // Verify ride exists and belongs to driver
    const ride = await Ride.findByPk(ride_id);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    if (ride.driver_id !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to share location for this ride'
      });
    }

    if (!['accepted', 'in_progress'].includes(ride.status)) {
      return res.status(400).json({
        success: false,
        message: 'Can only share location for accepted or in-progress rides'
      });
    }

    // Update vehicle location
    if (ride.vehicle_id) {
      await Vehicle.update(
        {
          current_latitude: parseFloat(latitude),
          current_longitude: parseFloat(longitude)
        },
        {
          where: { id: ride.vehicle_id }
        }
      );
    }

    // Emit location to user via WebSocket
    emitDriverLocationToUser(ride.user_id, ride_id, latitude, longitude);

    res.json({
      success: true,
      message: 'Location shared successfully',
      data: {
        ride_id: ride_id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Share driver location error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sharing location',
      error: error.message
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
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { ride_id, latitude, longitude } = req.body;

    // Validate coordinates
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude'
      });
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid longitude'
      });
    }

    // Verify ride exists and belongs to user
    const ride = await Ride.findByPk(ride_id);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    if (ride.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to share location for this ride'
      });
    }

    if (!['accepted', 'in_progress'].includes(ride.status)) {
      return res.status(400).json({
        success: false,
        message: 'Can only share location for accepted or in-progress rides'
      });
    }

    // Emit location to driver via WebSocket
    if (ride.driver_id) {
      emitUserLocationToDriver(ride.driver_id, ride_id, latitude, longitude);
    }

    res.json({
      success: true,
      message: 'Location shared successfully',
      data: {
        ride_id: ride_id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Share user location error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sharing location',
      error: error.message
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
          as: 'vehicle',
          attributes: ['id', 'current_latitude', 'current_longitude']
        }
      ]
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    if (ride.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view location for this ride'
      });
    }

    if (!['accepted', 'in_progress'].includes(ride.status)) {
      return res.status(400).json({
        success: false,
        message: 'Driver location is only available for accepted or in-progress rides'
      });
    }

    if (!ride.vehicle || !ride.vehicle.current_latitude || !ride.vehicle.current_longitude) {
      return res.status(404).json({
        success: false,
        message: 'Driver location not available'
      });
    }

    res.json({
      success: true,
      data: {
        ride_id: ride_id,
        latitude: parseFloat(ride.vehicle.current_latitude),
        longitude: parseFloat(ride.vehicle.current_longitude),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get driver location error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching driver location',
      error: error.message
    });
  }
};

module.exports = {
  shareDriverLocation,
  shareUserLocation,
  getDriverLocation
};
