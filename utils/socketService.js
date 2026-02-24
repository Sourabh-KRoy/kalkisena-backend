let io = null;

/**
 * Initialize Socket.IO
 */
const initializeSocket = (server) => {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Store driver connections: { driverId: socketId }
  const driverConnections = new Map();

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Driver connects and provides their user ID
    socket.on('driver:connect', (data) => {
      if (data && data.driverId) {
        driverConnections.set(data.driverId, socket.id);
        socket.join(`driver:${data.driverId}`);
        console.log(`Driver ${data.driverId} connected with socket ${socket.id}`);
      }
    });

    // Driver updates location
    socket.on('driver:update-location', (data) => {
      if (data && data.driverId) {
        socket.join(`driver:${data.driverId}`);
      }
    });

    // User connects
    socket.on('user:connect', (data) => {
      if (data && data.userId) {
        socket.join(`user:${data.userId}`);
        console.log(`User ${data.userId} connected with socket ${socket.id}`);
      }
    });

    // Driver shares live location during active ride
    socket.on('ride:driver-location', async (data) => {
      if (data && data.ride_id && data.latitude && data.longitude) {
        try {
          // Get ride to find user_id
          const { Ride } = require('../models');
          const ride = await Ride.findByPk(data.ride_id);
          
          if (ride && ride.user_id) {
            // Emit to user
            io.to(`user:${ride.user_id}`).emit('ride:driver-location-update', {
              ride_id: data.ride_id,
              latitude: parseFloat(data.latitude),
              longitude: parseFloat(data.longitude),
              timestamp: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error('Error finding ride for driver location update:', err);
        }
      }
    });

    // User shares live location during active ride
    socket.on('ride:user-location', async (data) => {
      if (data && data.ride_id && data.latitude && data.longitude) {
        try {
          // Get ride to find driver_id
          const { Ride } = require('../models');
          const ride = await Ride.findByPk(data.ride_id);
          
          if (ride && ride.driver_id) {
            // Emit to driver
            io.to(`driver:${ride.driver_id}`).emit('ride:user-location-update', {
              ride_id: data.ride_id,
              latitude: parseFloat(data.latitude),
              longitude: parseFloat(data.longitude),
              timestamp: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error('Error finding ride for user location update:', err);
        }
      }
    });

    // Driver disconnects
    socket.on('disconnect', () => {
      // Remove driver from connections
      for (const [driverId, socketId] of driverConnections.entries()) {
        if (socketId === socket.id) {
          driverConnections.delete(driverId);
          console.log(`Driver ${driverId} disconnected`);
          break;
        }
      }
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};

/**
 * Emit ride request to specific driver
 */
const emitRideRequestToDriver = (driverId, rideData) => {
  if (io) {
    io.to(`driver:${driverId}`).emit('ride:new-request', rideData);
    console.log(`Ride request emitted to driver ${driverId}`);
  }
};

/**
 * Emit ride request to multiple drivers
 */
const emitRideRequestToDrivers = (driverIds, rideData) => {
  if (io && driverIds.length > 0) {
    driverIds.forEach(driverId => {
      io.to(`driver:${driverId}`).emit('ride:new-request', rideData);
    });
    console.log(`Ride request emitted to ${driverIds.length} drivers`);
  }
};

/**
 * Emit ride update to user
 */
const emitRideUpdateToUser = (userId, rideData) => {
  if (io) {
    io.to(`user:${userId}`).emit('ride:update', rideData);
  }
};

/**
 * Emit driver location to user during active ride
 */
const emitDriverLocationToUser = (userId, rideId, latitude, longitude) => {
  if (io) {
    io.to(`user:${userId}`).emit('ride:driver-location-update', {
      ride_id: rideId,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Emit user location to driver during active ride
 */
const emitUserLocationToDriver = (driverId, rideId, latitude, longitude) => {
  if (io) {
    io.to(`driver:${driverId}`).emit('ride:user-location-update', {
      ride_id: rideId,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get Socket.IO instance
 */
const getIO = () => {
  return io;
};

module.exports = {
  initializeSocket,
  emitRideRequestToDriver,
  emitRideRequestToDrivers,
  emitRideUpdateToUser,
  emitDriverLocationToUser,
  emitUserLocationToDriver,
  getIO
};
