let io = null;
/** @type {Map<string, Set<string>>} driverId -> set of socket ids (multiple tabs / devices per driver) */
const driverConnections = new Map();
const rideDriverLocations = new Map();

const removeDriverSocket = (driverId, socketId) => {
  if (!driverId || !socketId) return;
  const set = driverConnections.get(String(driverId));
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) {
    driverConnections.delete(String(driverId));
  }
};

const driverRoom = (driverId) => `driver:${String(driverId)}`;
const userRoom = (userId) => `user:${String(userId)}`;

const getRideLocationKey = (rideId) => String(rideId);

const setDriverLocationForRide = (rideId, latitude, longitude, driverId = null) => {
  if (rideId == null || latitude == null || longitude == null) {
    return null;
  }

  const location = {
    ride_id: parseInt(rideId, 10),
    driver_id: driverId != null ? parseInt(driverId, 10) : null,
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    timestamp: new Date().toISOString(),
  };

  rideDriverLocations.set(getRideLocationKey(rideId), location);
  return location;
};

const getDriverLocationForRide = (rideId) => {
  if (rideId == null) {
    return null;
  }

  return rideDriverLocations.get(getRideLocationKey(rideId)) || null;
};

/**
 * Initialize Socket.IO
 */
const initializeSocket = (server) => {
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Driver connects and provides their user ID
    socket.on("driver:connect", (data) => {
      if (data && data.driverId) {
        const driverId = String(data.driverId);
        const prevDriverId = socket.data?.driverId;
        if (prevDriverId && prevDriverId !== driverId) {
          removeDriverSocket(prevDriverId, socket.id);
        }
        socket.data.driverId = driverId;
        socket.join(driverRoom(driverId));
        let set = driverConnections.get(driverId);
        if (!set) {
          set = new Set();
          driverConnections.set(driverId, set);
        }
        set.add(socket.id);
        console.log(
          `Driver ${driverId} connected with socket ${socket.id} (open tabs/sockets: ${set.size})`,
        );
      }
    });

    // Driver updates location
    socket.on("driver:update-location", (data) => {
      if (data && data.driverId) {
        socket.join(driverRoom(data.driverId));
      }
    });

    // User connects
    socket.on("user:connect", (data) => {
      if (data && data.userId) {
        const userId = String(data.userId);
        socket.join(userRoom(userId));
        console.log(`User ${userId} connected with socket ${socket.id}`);
      }
    });

    // Driver shares live location during active ride
    socket.on("ride:driver-location", async (data) => {
      if (
        data &&
        data.ride_id &&
        data.latitude != null &&
        data.longitude != null
      ) {
        try {
          // Get ride to find user_id
          const { Ride } = require("../models");
          const ride = await Ride.findByPk(data.ride_id);

          if (ride && ride.user_id) {
            const location = setDriverLocationForRide(
              data.ride_id,
              data.latitude,
              data.longitude,
              data.driverId || ride.driver_id || null,
            );

            // Emit to user
            io.to(userRoom(ride.user_id)).emit("ride:driver-location-update", {
              ride_id: location.ride_id,
              driver_id: location.driver_id,
              latitude: location.latitude,
              longitude: location.longitude,
              timestamp: location.timestamp,
            });
          }
        } catch (err) {
          console.error("Error finding ride for driver location update:", err);
        }
      }
    });

    // User shares live location during active ride
    socket.on("ride:user-location", async (data) => {
      if (
        data &&
        data.ride_id &&
        data.latitude != null &&
        data.longitude != null
      ) {
        try {
          // Get ride to find driver_id
          const { Ride } = require("../models");
          const ride = await Ride.findByPk(data.ride_id);

          if (ride && ride.driver_id) {
            // Emit to driver
            io.to(driverRoom(ride.driver_id)).emit(
              "ride:user-location-update",
              {
                ride_id: data.ride_id,
                latitude: parseFloat(data.latitude),
                longitude: parseFloat(data.longitude),
                timestamp: new Date().toISOString(),
              },
            );
          }
        } catch (err) {
          console.error("Error finding ride for user location update:", err);
        }
      }
    });

    // Driver disconnects
    socket.on("disconnect", () => {
      const driverId = socket.data?.driverId;
      if (driverId) {
        removeDriverSocket(driverId, socket.id);
        const remaining =
          driverConnections.get(String(driverId))?.size ?? 0;
        console.log(
          `Driver ${driverId} socket ${socket.id} disconnected (remaining tabs/sockets: ${remaining})`,
        );
      } else {
        for (const [did, set] of driverConnections.entries()) {
          if (set.has(socket.id)) {
            removeDriverSocket(did, socket.id);
            console.log(`Driver ${did} socket ${socket.id} disconnected (fallback cleanup)`);
            break;
          }
        }
      }
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
};

/**
 * Emit ride request to specific driver
 */
const emitRideRequestToDriver = (driverId, rideData) => {
  if (io) {
    const room = driverRoom(driverId);
    io.to(room).emit("ride:new-request", rideData);
    const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
    console.log(
      `Ride request emitted to driver ${driverId}; online sockets in room: ${roomSize}`,
    );
  }
};

/**
 * Emit ride request to multiple drivers
 */
const emitRideRequestToDrivers = (driverIds, rideData) => {
  if (io && driverIds.length > 0) {
    const uniqueTargetDriverIds = Array.from(
      new Set(driverIds.map((id) => String(id))),
    );
    const onlineDriverIds = getOnlineDriverIds(uniqueTargetDriverIds);
    const skippedOfflineDriverIds = uniqueTargetDriverIds.filter(
      (id) => !onlineDriverIds.includes(id),
    );

    if (onlineDriverIds.length === 0) {
      console.log("Ride request not emitted: no target drivers are online");
      return;
    }

    onlineDriverIds.forEach((driverId) => {
      const room = driverRoom(driverId);
      const tabCount = driverConnections.get(driverId)?.size ?? 0;
      const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
      io.to(room).emit("ride:new-request", rideData);
      console.log(
        `Ride ${rideData.ride_id} emitted to driver ${driverId} (trackedSockets:${tabCount}, roomSize:${roomSize})`,
      );
    });

    console.log(
      `Ride ${rideData.ride_id} request emitted to ${onlineDriverIds.length}/${uniqueTargetDriverIds.length} drivers (online/target)`,
    );
    console.log(
      `Ride ${rideData.ride_id} online target drivers: ${onlineDriverIds.join(", ")}`,
    );
    if (skippedOfflineDriverIds.length > 0) {
      console.log(
        `Ride ${rideData.ride_id} skipped offline drivers: ${skippedOfflineDriverIds.join(", ")}`,
      );
    }
  }
};

/**
 * Return online driver IDs; optional filter by target IDs
 */
const getOnlineDriverIds = (targetDriverIds = null) => {
  const onlineDriverIds = [];
  for (const [driverId, set] of driverConnections.entries()) {
    if (set && set.size > 0) {
      onlineDriverIds.push(driverId);
    }
  }

  if (!Array.isArray(targetDriverIds) || targetDriverIds.length === 0) {
    return onlineDriverIds;
  }

  const targetSet = new Set(targetDriverIds.map((id) => String(id)));
  return onlineDriverIds.filter((id) => targetSet.has(id));
};

/**
 * Check whether a specific driver is online
 */
const isDriverOnline = (driverId) => {
  const set = driverConnections.get(String(driverId));
  return !!(set && set.size > 0);
};

/**
 * Get socket ID for a specific driver
 */
const getDriverSocketId = (driverId) => {
  const set = driverConnections.get(String(driverId));
  if (!set || set.size === 0) return null;
  return set.values().next().value || null;
};

/**
 * Get total online driver count
 */
const getOnlineDriverCount = () => {
  let n = 0;
  for (const set of driverConnections.values()) {
    if (set && set.size > 0) n += 1;
  }
  return n;
};

/**
 * Emit ride update to user
 */
const emitRideUpdateToUser = (userId, rideData) => {
  if (io) {
    io.to(userRoom(userId)).emit("ride:update", rideData);
  }
};

/**
 * Emit ride update to driver
 */
const emitRideUpdateToDriver = (driverId, rideData) => {
  if (io) {
    io.to(driverRoom(driverId)).emit("ride:update", rideData);
  }
};

/**
 * Emit driver location to user during active ride
 */
const emitDriverLocationToUser = (userId, rideId, latitude, longitude) => {
  if (io) {
    const location = setDriverLocationForRide(rideId, latitude, longitude);
    io.to(userRoom(userId)).emit("ride:driver-location-update", location);
  }
};

/**
 * Emit user location to driver during active ride
 */
const emitUserLocationToDriver = (driverId, rideId, latitude, longitude) => {
  if (io) {
    io.to(driverRoom(driverId)).emit("ride:user-location-update", {
      ride_id: rideId,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      timestamp: new Date().toISOString(),
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
  emitRideUpdateToDriver,
  emitDriverLocationToUser,
  emitUserLocationToDriver,
  getIO,
  getOnlineDriverIds,
  isDriverOnline,
  getOnlineDriverCount,
  getDriverSocketId,
  setDriverLocationForRide,
  getDriverLocationForRide,
};
