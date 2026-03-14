const { Ride, Vehicle, User, DriverRegistration } = require("../models");
const { validationResult } = require("express-validator");
const {
  calculateRidePrice,
  calculateActualRidePrice,
  calculateSurgeMultiplier,
} = require("../utils/priceCalculation");
const {
  emitRideRequestToDrivers,
  emitRideUpdateToUser,
  emitRideUpdateToDriver,
  getOnlineDriverIds,
  getOnlineDriverCount,
  getDriverLocationForRide,
} = require("../utils/socketService");
const { generateOTP } = require("../utils/helpers");
const { Op } = require("sequelize");
const { all } = require("axios");

const attachDriverLocationToRide = (rideRecord) => {
  const rideData = rideRecord?.toJSON ? rideRecord.toJSON() : rideRecord;

  if (!rideData || !rideData.id || !rideData.driver_id) {
    return rideData;
  }

  const driverLocation = getDriverLocationForRide(rideData.id);
  if (driverLocation) {
    rideData.driver_current_location = driverLocation;
  }

  return rideData;
};

const bookRide = async (req, res) => {
  console.log(req.body);
  console.log(req.user);
  console.log("😀😀😀😀😀😀😀😀😀😀😀😀😀");
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
    const {
      from_latitude,
      from_longitude,
      from_address,
      to_latitude,
      to_longitude,
      to_address,
      vehicle_type,
      car_variety,
      surge_multiplier,
    } = req.body;

    if (!["scooty", "bike", "car"].includes(vehicle_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicle type. Must be scooty, bike, or car",
      });
    }

    if (vehicle_type === "car" && car_variety) {
      if (!["car_plus", "car_lite", "taxi"].includes(car_variety)) {
        return res.status(400).json({
          success: false,
          message: "Invalid car variety. Must be car_plus, car_lite, or taxi",
        });
      }
    }

    const surge = surge_multiplier || calculateSurgeMultiplier(1.0);
    const priceDetails = calculateRidePrice(
      from_latitude,
      from_longitude,
      to_latitude,
      to_longitude,
      vehicle_type,
      surge,
      car_variety || null,
    );

    // Generate 4-digit OTP for driver to verify rider at pickup (Ola/Uber style)
    const rideOtp = generateOTP(4);

    const ride = await Ride.create({
      user_id: userId,
      vehicle_type,
      car_variety: vehicle_type === "car" ? car_variety : null,
      from_latitude,
      from_longitude,
      from_address,
      to_latitude,
      to_longitude,
      to_address,
      distance: priceDetails.distance,
      estimated_duration: priceDetails.estimatedDuration,
      base_fare: priceDetails.baseFare,
      distance_fare: priceDetails.distanceFare,
      time_fare: priceDetails.timeFare,
      surge_multiplier: priceDetails.surgeMultiplier,
      total_fare: priceDetails.totalFare,
      ride_otp: rideOtp,
      status: "pending",
    });

    const rideWithUser = await Ride.findByPk(ride.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "phone"],
        },
      ],
    });

    // Send ride request to all active and available matching drivers (no radius filter)
    try {
      const driverRegistrationWhereClause = {
        status: "approved",
      };

      if (vehicle_type === "scooty") {
        driverRegistrationWhereClause.vehicle_type = "scooter";
      } else if (vehicle_type === "bike") {
        driverRegistrationWhereClause.vehicle_type = "bike";
      } else if (vehicle_type === "car") {
        driverRegistrationWhereClause.vehicle_type =
          car_variety === "taxi" ? "taxi" : "car";
      }

      // Get all approved drivers with matching vehicle type from driver_registration
      const availableDrivers = await DriverRegistration.findAll({
        where: driverRegistrationWhereClause,
        include: [
          {
            model: User,
            as: "user",
            where: {
              users_type: "driver",
              is_active: true,
            },
            attributes: ["id", "name", "email", "phone"],
          },
        ],
      });

      // Commented out as requested: vehicle-table based lookup
      // const vehicleWhereClause = {
      //   vehicle_type: vehicle_type,
      //   is_active: true,
      //   is_available: true,
      // };
      //
      // if (vehicle_type === "car" && car_variety) {
      //   vehicleWhereClause.car_variety = car_variety;
      // }
      //
      // const availableVehicles = await Vehicle.findAll({
      //   where: vehicleWhereClause,
      //   include: [
      //     {
      //       model: User,
      //       as: "driver",
      //       where: {
      //         users_type: "driver",
      //         is_active: true,
      //       },
      //       attributes: ["id", "name", "email", "phone"],
      //     },
      //   ],
      // });

      // Prepare ride request data for drivers
      const rideRequestData = {
        ride_id: ride.id,
        user: {
          id: rideWithUser.user.id,
          name: rideWithUser.user.name,
          phone: rideWithUser.user.phone,
        },
        from: {
          latitude: parseFloat(from_latitude),
          longitude: parseFloat(from_longitude),
          address: from_address,
        },
        to: {
          latitude: parseFloat(to_latitude),
          longitude: parseFloat(to_longitude),
          address: to_address,
        },
        vehicle_type: vehicle_type,
        car_variety: car_variety || null,
        price: {
          base_fare: parseFloat(priceDetails.baseFare),
          distance_fare: parseFloat(priceDetails.distanceFare),
          time_fare: parseFloat(priceDetails.timeFare),
          surge_multiplier: parseFloat(priceDetails.surgeMultiplier),
          total_fare: parseFloat(priceDetails.totalFare),
        },
        distance: parseFloat(priceDetails.distance),
        estimated_duration: priceDetails.estimatedDuration,
        created_at: ride.created_at,
      };

      const driverIds = availableDrivers
        .map((registration) =>
          registration.user ? registration.user.id : registration.user_id,
        )
        .filter(Boolean)
        .map((id) => String(id));

      const onlineDriverIds = getOnlineDriverIds(driverIds);
      const offlineMatchingDriverIds = driverIds.filter(
        (id) => !onlineDriverIds.includes(id),
      );

      console.log(
        `Ride ${ride.id} filter => vehicle_type:${vehicle_type}, car_variety:${car_variety || "none"}`,
      );
      console.log(
        `Ride ${ride.id} matching driver IDs: ${driverIds.join(", ") || "none"}`,
      );
      console.log(`Total online drivers: ${getOnlineDriverCount()}`);
      console.log(`Matching active drivers: ${driverIds.length}`);
      console.log(`Matching online drivers: ${onlineDriverIds.length}`);
      if (offlineMatchingDriverIds.length > 0) {
        console.log(
          `Ride ${ride.id} matching but offline driver IDs: ${offlineMatchingDriverIds.join(", ")}`,
        );
      }

      if (onlineDriverIds.length > 0) {
        console.log(
          `Ride ${ride.id} sending booking to driver IDs: ${onlineDriverIds.join(", ")}`,
        );
        emitRideRequestToDrivers(onlineDriverIds, rideRequestData);
        console.log(
          `Ride ${ride.id} request sent to ${onlineDriverIds.length} active connected drivers`,
        );
      } else {
        console.log(
          `Ride ${ride.id} no active connected drivers found for this vehicle type`,
        );
      }
    } catch (socketError) {
      // Don't fail the ride booking if socket emission fails
      console.error("Error emitting ride request to drivers:", socketError);
    }

    res.status(201).json({
      success: true,
      message: "Ride booked successfully",
      data: {
        ride: rideWithUser,
      },
    });
  } catch (error) {
    console.error("Book ride error:", error);
    res.status(500).json({
      success: false,
      message: "Error booking ride",
      error: error.message,
    });
  }
};

const getAvailableRides = async (req, res) => {
  console.log("getAvailableRides😎😎😎😎😎", req.query);
  try {
    const driverId = req.user.id;

    if (req.user.users_type !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Only drivers can view available rides",
      });
    }

    // Get driver's vehicle_type from driver registration (car → only car rides, bike → only bike rides, etc.)
    const driverRegistration = await DriverRegistration.findOne({
      where: { user_id: driverId },
    });

    if (!driverRegistration) {
      return res.status(404).json({
        success: false,
        message:
          "Driver registration not found. Please complete your driver registration first.",
      });
    }

    // Commented out as requested: do not use vehicle table
    // const driverVehicle = await Vehicle.findOne({
    //   where: {
    //     user_id: driverId,
    //     is_active: true,
    //     is_available: true,
    //   },
    // });
    const driverVehicle = null;

    const whereClause = {
      status: "pending",
    };

    // Filter by driver's vehicle_type from driver registration: only show rides matching driver's vehicle
    // DriverRegistration: car, bike, scooter, taxi → Ride: car (car_plus/car_lite/taxi), bike, scooty
    const regVehicleType = driverRegistration.vehicle_type;

    if (regVehicleType === "car") {
      whereClause.vehicle_type = "car";
      // Driver with 'car' sees only car_plus/car_lite (exclude taxi; taxi drivers use regVehicleType 'taxi')
      whereClause[Op.or] = [
        { car_variety: "car_plus" },
        { car_variety: "car_lite" },
        { car_variety: null },
      ];
    } else if (regVehicleType === "bike") {
      whereClause.vehicle_type = "bike";
    } else if (regVehicleType === "scooter") {
      whereClause.vehicle_type = "scooty";
    } else if (regVehicleType === "taxi") {
      whereClause.vehicle_type = "car";
      whereClause.car_variety = "taxi";
    } else {
      whereClause.vehicle_type = "bike";
    }

    // Get all pending rides (latest first)
    const allRides = await Ride.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "phone"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: 100,
    });

    res.json({
      success: true,
      data: {
        rides: allRides,
        driver_vehicle: driverVehicle
          ? {
              id: driverVehicle.id,
              vehicle_type: driverVehicle.vehicle_type,
              car_variety: driverVehicle.car_variety,
              vehicle_number: driverVehicle.vehicle_number,
              current_location:
                driverVehicle.current_latitude != null &&
                driverVehicle.current_longitude != null
                  ? {
                      latitude: parseFloat(driverVehicle.current_latitude),
                      longitude: parseFloat(driverVehicle.current_longitude),
                    }
                  : null,
            }
          : null,
        driver_registration_vehicle_type: driverRegistration.vehicle_type,
        driver_registration: {
          user_id: driverRegistration.user_id,
          status: driverRegistration.status,
          vehicle_type: driverRegistration.vehicle_type,
          city_to_ride: driverRegistration.city_to_ride,
        },
        total_rides: allRides.length,
      },
    });
  } catch (error) {
    console.error("Get available rides error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching available rides",
      error: error.message,
    });
  }
};

const acceptRide = async (req, res) => {
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
    const { ride_id } = req.body;

    if (req.user.users_type !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Only drivers can accept rides",
      });
    }

    const ride = await Ride.findByPk(ride_id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "phone"],
        },
      ],
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    if (ride.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Ride is already ${ride.status}`,
      });
    }

    // Commented out as requested: do not use vehicle table
    // const vehicleWhereClause = {
    //   user_id: driverId,
    //   vehicle_type: ride.vehicle_type,
    //   is_active: true,
    //   is_available: true,
    // };
    //
    // if (ride.vehicle_type === "car" && ride.car_variety) {
    //   vehicleWhereClause.car_variety = ride.car_variety;
    // }
    //
    // const driverVehicle = await Vehicle.findOne({
    //   where: vehicleWhereClause,
    // });

    const driverRegistration = await DriverRegistration.findOne({
      where: {
        user_id: driverId,
        status: "approved",
      },
    });

    if (!driverRegistration) {
      return res.status(404).json({
        success: false,
        message: "Approved driver registration not found",
      });
    }

    const rideExpectedRegistrationType =
      ride.vehicle_type === "scooty"
        ? "scooter"
        : ride.vehicle_type === "car" && ride.car_variety === "taxi"
          ? "taxi"
          : ride.vehicle_type;

    if (driverRegistration.vehicle_type !== rideExpectedRegistrationType) {
      return res.status(400).json({
        success: false,
        message:
          "Driver registration vehicle type does not match this ride type",
      });
    }

    const existingActiveRide = await Ride.findOne({
      where: {
        driver_id: driverId,
        status: {
          [Op.in]: ["accepted", "in_progress"],
        },
      },
    });

    if (existingActiveRide) {
      return res.status(400).json({
        success: false,
        message: "You already have an active ride",
      });
    }

    ride.driver_id = driverId;
    // ride.vehicle_id = driverVehicle.id;
    ride.status = "accepted";
    await ride.save();

    // driverVehicle.is_available = false;
    // await driverVehicle.save();

    const updatedRide = await Ride.findByPk(ride.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: User,
          as: "driver",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: Vehicle,
          as: "vehicle",
          attributes: [
            "id",
            "vehicle_type",
            "vehicle_number",
            "vehicle_model",
            "vehicle_color",
          ],
        },
      ],
    });

    // Hide ride_otp from driver; only rider can see OTP
    const rideData = updatedRide.toJSON ? updatedRide.toJSON() : updatedRide;
    const userRideData = updatedRide.toJSON
      ? updatedRide.toJSON()
      : updatedRide;
    if (rideData && rideData.ride_otp) delete rideData.ride_otp;

    if (ride.user_id) {
      emitRideUpdateToUser(ride.user_id, userRideData);
    }
    if (ride.driver_id) {
      emitRideUpdateToDriver(ride.driver_id, rideData);
    }

    res.json({
      success: true,
      message: "Ride accepted successfully",
      data: {
        ride: rideData,
      },
    });
  } catch (error) {
    console.error("Accept ride error:", error);
    res.status(500).json({
      success: false,
      message: "Error accepting ride",
      error: error.message,
    });
  }
};

const startRide = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { ride_id } = req.body;

    if (req.user.users_type !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Only drivers can start rides",
      });
    }

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
        message: "You are not authorized to start this ride",
      });
    }

    if (ride.status !== "accepted") {
      return res.status(400).json({
        success: false,
        message: `Ride must be accepted before starting. Current status: ${ride.status}`,
      });
    }

    if (!ride.otp_verified_at) {
      return res.status(400).json({
        success: false,
        message: "Please verify the rider's OTP before starting the ride",
      });
    }

    ride.status = "in_progress";
    ride.started_at = new Date();
    await ride.save();

    const updatedRide = await Ride.findByPk(ride.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: User,
          as: "driver",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: Vehicle,
          as: "vehicle",
          attributes: [
            "id",
            "vehicle_type",
            "vehicle_number",
            "vehicle_model",
            "vehicle_color",
          ],
        },
      ],
    });

    const rideJson = updatedRide?.toJSON ? updatedRide.toJSON() : updatedRide;
    if (ride.user_id) emitRideUpdateToUser(ride.user_id, rideJson);
    if (ride.driver_id) emitRideUpdateToDriver(ride.driver_id, rideJson);

    res.json({
      success: true,
      message: "Ride started successfully",
      data: {
        ride: updatedRide,
      },
    });
  } catch (error) {
    console.error("Start ride error:", error);
    res.status(500).json({
      success: false,
      message: "Error starting ride",
      error: error.message,
    });
  }
};

/**
 * Verify rider OTP (driver only). Driver asks rider for the 4-digit OTP
 * and verifies it before starting the ride. Same flow as Ola/Uber.
 */
const verifyRideOtp = async (req, res) => {
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
    const { ride_id, otp } = req.body;

    if (req.user.users_type !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Only drivers can verify rider OTP",
      });
    }

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
        message: "You are not the driver of this ride",
      });
    }

    if (ride.status !== "accepted") {
      return res.status(400).json({
        success: false,
        message: `OTP can only be verified for accepted rides. Current status: ${ride.status}`,
      });
    }

    if (ride.otp_verified_at) {
      return res.status(400).json({
        success: false,
        message: "OTP has already been verified for this ride",
      });
    }

    if (!ride.ride_otp) {
      return res.status(400).json({
        success: false,
        message: "No OTP is set for this ride",
      });
    }

    const otpString = String(otp).trim();
    if (ride.ride_otp !== otpString) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid OTP. Please ask the rider for the correct 4-digit OTP.",
      });
    }

    ride.otp_verified_at = new Date();
    ride.ride_otp = null; // Clear OTP after successful verification
    ride.status = "in_progress";
    ride.started_at = new Date();
    await ride.save();

    const updatedRide = await Ride.findByPk(ride.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: User,
          as: "driver",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: Vehicle,
          as: "vehicle",
          attributes: [
            "id",
            "vehicle_type",
            "vehicle_number",
            "vehicle_model",
            "vehicle_color",
          ],
        },
      ],
    });

    const rideJson = updatedRide?.toJSON ? updatedRide.toJSON() : updatedRide;
    if (ride.user_id) emitRideUpdateToUser(ride.user_id, rideJson);
    if (ride.driver_id) emitRideUpdateToDriver(ride.driver_id, rideJson);

    res.json({
      success: true,
      message: "Rider verified successfully. Ride has started automatically.",
      data: {
        ride: updatedRide,
      },
    });
  } catch (error) {
    console.error("Verify ride OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying OTP",
      error: error.message,
    });
  }
};

const completeRide = async (req, res) => {
  try {
    const driverId = req.user.id;
    const { ride_id, payment_method, actual_distance, actual_duration } =
      req.body;

    if (req.user.users_type !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Only drivers can complete rides",
      });
    }

    const ride = await Ride.findByPk(ride_id, {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
        },
      ],
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    if (ride.driver_id !== driverId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to complete this ride",
      });
    }

    if (!["accepted", "in_progress"].includes(ride.status)) {
      return res.status(400).json({
        success: false,
        message: `Ride cannot be completed. Current status: ${ride.status}`,
      });
    }

    let finalTotalFare = ride.total_fare;
    let fareAdjustment = 0;

    if (actual_distance && actual_duration) {
      const actualDistance = parseFloat(actual_distance);
      const actualDuration = parseInt(actual_duration);

      if (actualDistance > 0 && actualDuration > 0) {
        const actualPriceDetails = calculateActualRidePrice(
          actualDistance,
          actualDuration,
          ride.vehicle_type,
          ride.surge_multiplier,
          ride.car_variety,
        );

        ride.actual_distance = actualDistance;
        ride.actual_duration = actualDuration;
        ride.actual_base_fare = actualPriceDetails.baseFare;
        ride.actual_distance_fare = actualPriceDetails.distanceFare;
        ride.actual_time_fare = actualPriceDetails.timeFare;
        ride.actual_total_fare = actualPriceDetails.totalFare;

        const estimatedTotal = parseFloat(ride.total_fare);
        const actualTotal = actualPriceDetails.totalFare;

        if (actualTotal > estimatedTotal) {
          fareAdjustment = actualTotal - estimatedTotal;
          finalTotalFare = actualTotal;
        } else {
          finalTotalFare = estimatedTotal;
        }

        ride.fare_adjustment = fareAdjustment;
        ride.total_fare = finalTotalFare;
      }
    }

    ride.status = "completed";
    ride.completed_at = new Date();
    ride.payment_status = "paid";

    if (
      payment_method &&
      ["cash", "card", "wallet", "upi"].includes(payment_method)
    ) {
      ride.payment_method = payment_method;
    }

    await ride.save();

    if (ride.vehicle) {
      ride.vehicle.is_available = true;
      await ride.vehicle.save();
    }

    const updatedRide = await Ride.findByPk(ride.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: User,
          as: "driver",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: Vehicle,
          as: "vehicle",
          attributes: [
            "id",
            "vehicle_type",
            "vehicle_number",
            "vehicle_model",
            "vehicle_color",
          ],
        },
      ],
    });

    const rideJson = updatedRide?.toJSON ? updatedRide.toJSON() : updatedRide;
    if (ride.user_id) emitRideUpdateToUser(ride.user_id, rideJson);
    if (ride.driver_id) emitRideUpdateToDriver(ride.driver_id, rideJson);

    res.json({
      success: true,
      message: "Ride completed successfully",
      data: {
        ride: updatedRide,
        fare_details: {
          estimated_fare:
            parseFloat(ride.base_fare) +
            parseFloat(ride.distance_fare) +
            parseFloat(ride.time_fare),
          actual_fare: ride.actual_total_fare || null,
          fare_adjustment: fareAdjustment,
          final_fare: finalTotalFare,
        },
      },
    });
  } catch (error) {
    console.error("Complete ride error:", error);
    res.status(500).json({
      success: false,
      message: "Error completing ride",
      error: error.message,
    });
  }
};

const cancelRide = async (req, res) => {
  try {
    const userId = req.user.id;
    const { ride_id, cancellation_reason } = req.body;

    const ride = await Ride.findByPk(ride_id, {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
        },
      ],
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    const isUser = ride.user_id === userId;
    const isDriver = ride.driver_id === userId;

    if (!isUser && !isDriver) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this ride",
      });
    }

    if (["completed", "cancelled"].includes(ride.status)) {
      return res.status(400).json({
        success: false,
        message: `Ride is already ${ride.status}`,
      });
    }

    ride.status = "cancelled";
    ride.cancelled_at = new Date();
    if (cancellation_reason) {
      ride.cancellation_reason = cancellation_reason;
    }

    if (isDriver && ride.vehicle) {
      ride.vehicle.is_available = true;
      await ride.vehicle.save();
    }

    await ride.save();

    const updatedRide = await Ride.findByPk(ride.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: User,
          as: "driver",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: Vehicle,
          as: "vehicle",
          attributes: [
            "id",
            "vehicle_type",
            "vehicle_number",
            "vehicle_model",
            "vehicle_color",
          ],
        },
      ],
    });

    const rideJson = updatedRide?.toJSON ? updatedRide.toJSON() : updatedRide;
    if (ride.user_id) emitRideUpdateToUser(ride.user_id, rideJson);
    if (ride.driver_id) emitRideUpdateToDriver(ride.driver_id, rideJson);

    res.json({
      success: true,
      message: "Ride cancelled successfully",
      data: {
        ride: updatedRide,
      },
    });
  } catch (error) {
    console.error("Cancel ride error:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling ride",
      error: error.message,
    });
  }
};

const getUserRides = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 20, offset = 0 } = req.query;

    const whereClause = {
      user_id: userId,
    };

    if (
      status &&
      ["pending", "accepted", "in_progress", "completed", "cancelled"].includes(
        status,
      )
    ) {
      whereClause.status = status;
    }

    const rides = await Ride.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "driver",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: Vehicle,
          as: "vehicle",
          attributes: [
            "id",
            "vehicle_type",
            "vehicle_number",
            "vehicle_model",
            "vehicle_color",
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const ridesData = rides.rows.map((ride) => attachDriverLocationToRide(ride));

    res.json({
      success: true,
      data: {
        rides: ridesData,
        total: rides.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error("Get user rides error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching rides",
      error: error.message,
    });
  }
};

const getDriverRides = async (req, res) => {
  try {
    if (req.user.users_type !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Only drivers can view driver rides",
      });
    }

    const driverId = req.user.id;
    const { status, limit = 20, offset = 0 } = req.query;

    const whereClause = {
      driver_id: driverId,
    };

    if (
      status &&
      ["pending", "accepted", "in_progress", "completed", "cancelled"].includes(
        status,
      )
    ) {
      whereClause.status = status;
    }

    const rides = await Ride.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: Vehicle,
          as: "vehicle",
          attributes: [
            "id",
            "vehicle_type",
            "vehicle_number",
            "vehicle_model",
            "vehicle_color",
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Hide ride_otp from driver; only rider can see OTP
    const ridesData = rides.rows.map((r) => {
      const j = attachDriverLocationToRide(r);
      if (j && j.ride_otp) delete j.ride_otp;
      return j;
    });

    res.json({
      success: true,
      data: {
        rides: ridesData,
        total: rides.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error("Get driver rides error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching rides",
      error: error.message,
    });
  }
};

const getRideDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { ride_id } = req.params;

    const ride = await Ride.findByPk(ride_id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: User,
          as: "driver",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: Vehicle,
          as: "vehicle",
          attributes: [
            "id",
            "vehicle_type",
            "vehicle_number",
            "vehicle_model",
            "vehicle_color",
          ],
        },
      ],
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    const isUser = ride.user_id === userId;
    const isDriver = ride.driver_id === userId;

    if (!isUser && !isDriver) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this ride",
      });
    }

    // Hide ride_otp from driver; only rider (user) can see OTP to share with driver
    const rideData = attachDriverLocationToRide(ride);
    if (isDriver && rideData.ride_otp) {
      delete rideData.ride_otp;
    }

    res.json({
      success: true,
      data: {
        ride: rideData,
      },
    });
  } catch (error) {
    console.error("Get ride details error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching ride details",
      error: error.message,
    });
  }
};

const getPriceEstimate = async (req, res) => {
  try {
    const {
      from_latitude,
      from_longitude,
      to_latitude,
      to_longitude,
      vehicle_type,
      car_variety,
    } = req.query;

    if (!from_latitude || !from_longitude || !to_latitude || !to_longitude) {
      return res.status(400).json({
        success: false,
        message: "From and to coordinates are required",
      });
    }

    const surge = calculateSurgeMultiplier(1.0);
    const estimates = [];

    if (vehicle_type && vehicle_type === "car") {
      const varieties = car_variety
        ? [car_variety]
        : ["car_plus", "car_lite", "taxi"];

      for (const variety of varieties) {
        if (!["car_plus", "car_lite", "taxi"].includes(variety)) continue;

        const priceDetails = calculateRidePrice(
          from_latitude,
          from_longitude,
          to_latitude,
          to_longitude,
          "car",
          surge,
          variety,
        );

        const varietyNames = {
          car_plus: "Car Plus",
          car_lite: "Car Lite",
          taxi: "Taxi",
        };

        const varietyDescriptions = {
          car_plus: "Affordable and comfy",
          car_lite: "Affordable and comfy",
          taxi: "Affordable and comfy",
        };

        estimates.push({
          vehicle_type: "car",
          car_variety: variety,
          name: varietyNames[variety],
          estimated_time: `${priceDetails.estimatedDuration} Min`,
          description: varietyDescriptions[variety],
          distance: priceDetails.distance,
          base_fare: priceDetails.baseFare,
          distance_fare: priceDetails.distanceFare,
          time_fare: priceDetails.timeFare,
          surge_multiplier: priceDetails.surgeMultiplier,
          total_fare: priceDetails.totalFare,
        });
      }
    } else {
      const vehicleTypes = vehicle_type
        ? [vehicle_type]
        : ["scooty", "bike", "car"];

      for (const vType of vehicleTypes) {
        if (!["scooty", "bike", "car"].includes(vType)) continue;

        const priceDetails = calculateRidePrice(
          from_latitude,
          from_longitude,
          to_latitude,
          to_longitude,
          vType,
          surge,
          null,
        );

        const vehicleNames = {
          scooty: "Scooty",
          bike: "Bike",
          car: "Car",
        };

        estimates.push({
          vehicle_type: vType,
          car_variety: null,
          name: vehicleNames[vType],
          estimated_time: `${priceDetails.estimatedDuration} Min`,
          description: "Affordable and reliable",
          distance: priceDetails.distance,
          base_fare: priceDetails.baseFare,
          distance_fare: priceDetails.distanceFare,
          time_fare: priceDetails.timeFare,
          surge_multiplier: priceDetails.surgeMultiplier,
          total_fare: priceDetails.totalFare,
        });
      }
    }

    res.json({
      success: true,
      data: {
        estimates,
        note: "Prices are estimates. Final fare may vary based on actual distance and time.",
      },
    });
  } catch (error) {
    console.error("Get price estimate error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching price estimate",
      error: error.message,
    });
  }
};

const getCarVarieties = async (req, res) => {
  try {
    const { from_latitude, from_longitude, to_latitude, to_longitude } =
      req.query;

    if (!from_latitude || !from_longitude || !to_latitude || !to_longitude) {
      return res.status(400).json({
        success: false,
        message: "From and to coordinates are required",
      });
    }

    const surge = calculateSurgeMultiplier(1.0);
    const varieties = ["car_plus", "car_lite", "taxi"];
    const carVarieties = [];

    for (const variety of varieties) {
      const priceDetails = calculateRidePrice(
        from_latitude,
        from_longitude,
        to_latitude,
        to_longitude,
        "car",
        surge,
        variety,
      );

      const varietyNames = {
        car_plus: "Car Plus",
        car_lite: "Car Lite",
        taxi: "Taxi",
      };

      const varietyDescriptions = {
        car_plus: "Affordable and comfy",
        car_lite: "Affordable and comfy",
        taxi: "Affordable and comfy",
      };

      carVarieties.push({
        variety: variety,
        name: varietyNames[variety],
        estimated_time: `${priceDetails.estimatedDuration} Min`,
        description: varietyDescriptions[variety],
        base_fare: priceDetails.baseFare,
        total_fare: priceDetails.totalFare,
        distance: priceDetails.distance,
      });
    }

    res.json({
      success: true,
      data: {
        car_varieties: carVarieties,
      },
    });
  } catch (error) {
    console.error("Get car varieties error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching car varieties",
      error: error.message,
    });
  }
};

const updateDriverLocation = async (req, res) => {
  try {
    if (req.user.users_type !== "driver") {
      return res.status(403).json({
        success: false,
        message: "Only drivers can update location",
      });
    }

    const driverId = req.user.id;
    const { latitude, longitude, vehicle_id } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    // Validate coordinates
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude. Must be between -90 and 90",
      });
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: "Invalid longitude. Must be between -180 and 180",
      });
    }

    // Commented out as requested: do not use vehicle table
    // let vehicle;
    // if (vehicle_id) {
    //   vehicle = await Vehicle.findOne({
    //     where: {
    //       id: vehicle_id,
    //       user_id: driverId,
    //     },
    //   });
    //
    //   if (!vehicle) {
    //     return res.status(404).json({
    //       success: false,
    //       message: "Vehicle not found or does not belong to this driver",
    //     });
    //   }
    // } else {
    //   const vehicles = await Vehicle.findAll({
    //     where: { user_id: driverId },
    //   });
    //
    //   if (vehicles.length === 0) {
    //     return res.status(404).json({
    //       success: false,
    //       message: "No vehicles found for this driver",
    //     });
    //   }
    //
    //   await Vehicle.update(
    //     {
    //       current_latitude: parseFloat(latitude),
    //       current_longitude: parseFloat(longitude),
    //     },
    //     {
    //       where: { user_id: driverId },
    //     },
    //   );
    //
    //   return res.json({
    //     success: true,
    //     message: "Driver location updated successfully",
    //     data: {
    //       latitude: parseFloat(latitude),
    //       longitude: parseFloat(longitude),
    //       vehicles_updated: vehicles.length,
    //     },
    //   });
    // }
    //
    // vehicle.current_latitude = parseFloat(latitude);
    // vehicle.current_longitude = parseFloat(longitude);
    // await vehicle.save();

    res.json({
      success: true,
      message: "Driver location received (vehicle table update is disabled)",
      data: {
        vehicle_id: vehicle_id || null,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      },
    });
  } catch (error) {
    console.error("Update driver location error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating driver location",
      error: error.message,
    });
  }
};

module.exports = {
  bookRide,
  getAvailableRides,
  acceptRide,
  startRide,
  verifyRideOtp,
  completeRide,
  cancelRide,
  getUserRides,
  getDriverRides,
  getRideDetails,
  getPriceEstimate,
  getCarVarieties,
  updateDriverLocation,
};
