const express = require("express");
const router = express.Router();
const { body, param, query } = require("express-validator");
const rideController = require("../controllers/rideController");
const messageController = require("../controllers/messageController");
const { authenticateToken } = require("../middleware/auth");

const bookRideValidation = [
  body("from_latitude")
    .notEmpty()
    .withMessage("From latitude is required")
    .isFloat({ min: -90, max: 90 })
    .withMessage("Invalid from latitude"),
  body("from_longitude")
    .notEmpty()
    .withMessage("From longitude is required")
    .isFloat({ min: -180, max: 180 })
    .withMessage("Invalid from longitude"),
  body("from_address")
    .trim()
    .notEmpty()
    .withMessage("From address is required")
    .isLength({ min: 5, max: 500 })
    .withMessage("From address must be between 5 and 500 characters"),
  body("to_latitude")
    .notEmpty()
    .withMessage("To latitude is required")
    .isFloat({ min: -90, max: 90 })
    .withMessage("Invalid to latitude"),
  body("to_longitude")
    .notEmpty()
    .withMessage("To longitude is required")
    .isFloat({ min: -180, max: 180 })
    .withMessage("Invalid to longitude"),
  body("to_address")
    .trim()
    .notEmpty()
    .withMessage("To address is required")
    .isLength({ min: 5, max: 500 })
    .withMessage("To address must be between 5 and 500 characters"),
  body("vehicle_type")
    .notEmpty()
    .withMessage("Vehicle type is required")
    .isIn(["scooty", "bike", "car"])
    .withMessage("Vehicle type must be scooty, bike, or car"),
  body("car_variety")
    .optional()
    .custom((value, { req }) => {
      if (req.body.vehicle_type === "car" && value) {
        if (!["car_plus", "car_lite", "taxi"].includes(value)) {
          throw new Error("Car variety must be car_plus, car_lite, or taxi");
        }
      }
      return true;
    }),
  body("surge_multiplier")
    .optional()
    .isFloat({ min: 1.0, max: 3.0 })
    .withMessage("Surge multiplier must be between 1.0 and 3.0"),
];

const acceptRideValidation = [
  body("ride_id")
    .notEmpty()
    .withMessage("Ride ID is required")
    .isInt({ min: 1 })
    .withMessage("Ride ID must be a valid integer"),
];

const startRideValidation = [
  body("ride_id")
    .notEmpty()
    .withMessage("Ride ID is required")
    .isInt({ min: 1 })
    .withMessage("Ride ID must be a valid integer"),
];

const verifyRideOtpValidation = [
  body("ride_id")
    .notEmpty()
    .withMessage("Ride ID is required")
    .isInt({ min: 1 })
    .withMessage("Ride ID must be a valid integer"),
  body("otp")
    .notEmpty()
    .withMessage("OTP is required")
    .isLength({ min: 4, max: 4 })
    .withMessage("OTP must be 4 digits")
    .isNumeric()
    .withMessage("OTP must be numeric"),
];

const completeRideValidation = [
  body("ride_id")
    .notEmpty()
    .withMessage("Ride ID is required")
    .isInt({ min: 1 })
    .withMessage("Ride ID must be a valid integer"),
  body("payment_method")
    .optional()
    .isIn(["cash", "card", "wallet", "upi"])
    .withMessage("Payment method must be cash, card, wallet, or upi"),
  body("actual_distance")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Actual distance must be a positive number"),
  body("actual_duration")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Actual duration must be a positive integer (in minutes)"),
];

const cancelRideValidation = [
  body("ride_id")
    .notEmpty()
    .withMessage("Ride ID is required")
    .isInt({ min: 1 })
    .withMessage("Ride ID must be a valid integer"),
  body("cancellation_reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Cancellation reason must be less than 500 characters"),
];

const sendMessageValidation = [
  body("ride_id")
    .notEmpty()
    .withMessage("Ride ID is required")
    .isInt({ min: 1 })
    .withMessage("Ride ID must be a valid integer"),
  body("message")
    .trim()
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ min: 1, max: 1000 })
    .withMessage("Message must be between 1 and 1000 characters"),
];

const markMessagesReadValidation = [
  body("ride_id")
    .notEmpty()
    .withMessage("Ride ID is required")
    .isInt({ min: 1 })
    .withMessage("Ride ID must be a valid integer"),
];

const setDriverStatusValidation = [
  body("mode")
    .notEmpty()
    .withMessage("mode is required")
    .isIn(["online", "offline"])
    .withMessage("mode must be online or offline"),
  body("latitude")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Invalid latitude"),
  body("longitude")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("Invalid longitude"),
];

router.get("/price-estimate", rideController.getPriceEstimate);

router.get("/car-varieties", rideController.getCarVarieties);

router.post(
  "/book",
  authenticateToken,
  bookRideValidation,
  rideController.bookRide,
);

router.get("/available", authenticateToken, rideController.getAvailableRides);

router.post(
  "/driver/status",
  authenticateToken,
  setDriverStatusValidation,
  rideController.setDriverStatus,
);

router.post(
  "/accept",
  authenticateToken,
  acceptRideValidation,
  rideController.acceptRide,
);

router.post(
  "/start",
  authenticateToken,
  startRideValidation,
  rideController.startRide,
);

router.post(
  "/verify-otp",
  authenticateToken,
  verifyRideOtpValidation,
  rideController.verifyRideOtp,
);

router.post(
  "/complete",
  authenticateToken,
  completeRideValidation,
  rideController.completeRide,
);

router.post(
  "/cancel",
  authenticateToken,
  cancelRideValidation,
  rideController.cancelRide,
);
router.post(
  "/reject",
  authenticateToken,
  [
    body("ride_id")
      .notEmpty()
      .withMessage("Ride ID is required")
      .isInt({ min: 1 })
      .withMessage("Ride ID must be valid"),
  ],
  rideController.rejectRide,
);

router.get("/my-rides", authenticateToken, rideController.getUserRides);
router.get(
  "/user/ride/history",
  authenticateToken,
  rideController.getUserRidesHistory,
);
router.get(
  "/driver/ride/history",
  authenticateToken,
  rideController.getDriverRidesHistory,
);

router.get("/driver-rides", authenticateToken, rideController.getDriverRides);

router.get("/:ride_id", authenticateToken, rideController.getRideDetails);

router.post(
  "/messages/send",
  authenticateToken,
  sendMessageValidation,
  messageController.sendMessage,
);

router.get(
  "/messages/:ride_id",
  authenticateToken,
  messageController.getRideMessages,
);

router.post(
  "/messages/mark-read",
  authenticateToken,
  markMessagesReadValidation,
  messageController.markMessagesAsRead,
);

router.get(
  "/messages/unread/count",
  authenticateToken,
  messageController.getUnreadMessageCount,
);

router.post(
  "/driver/update-location",
  authenticateToken,
  [
    body("latitude")
      .notEmpty()
      .withMessage("Latitude is required")
      .isFloat({ min: -90, max: 90 })
      .withMessage("Invalid latitude"),
    body("longitude")
      .notEmpty()
      .withMessage("Longitude is required")
      .isFloat({ min: -180, max: 180 })
      .withMessage("Invalid longitude"),
    body("vehicle_id")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Vehicle ID must be a valid integer"),
  ],
  rideController.updateDriverLocation,
);

// Live location sharing routes
const locationController = require("../controllers/locationController");

router.post(
  "/driver/share-location",
  authenticateToken,
  [
    body("ride_id")
      .notEmpty()
      .withMessage("Ride ID is required")
      .isInt({ min: 1 })
      .withMessage("Ride ID must be a valid integer"),
    body("latitude")
      .notEmpty()
      .withMessage("Latitude is required")
      .isFloat({ min: -90, max: 90 })
      .withMessage("Invalid latitude"),
    body("longitude")
      .notEmpty()
      .withMessage("Longitude is required")
      .isFloat({ min: -180, max: 180 })
      .withMessage("Invalid longitude"),
  ],
  locationController.shareDriverLocation,
);

router.post(
  "/user/share-location",
  authenticateToken,
  [
    body("ride_id")
      .notEmpty()
      .withMessage("Ride ID is required")
      .isInt({ min: 1 })
      .withMessage("Ride ID must be a valid integer"),
    body("latitude")
      .notEmpty()
      .withMessage("Latitude is required")
      .isFloat({ min: -90, max: 90 })
      .withMessage("Invalid latitude"),
    body("longitude")
      .notEmpty()
      .withMessage("Longitude is required")
      .isFloat({ min: -180, max: 180 })
      .withMessage("Invalid longitude"),
  ],
  locationController.shareUserLocation,
);

router.get(
  "/:ride_id/driver-location",
  authenticateToken,
  locationController.getDriverLocation,
);

module.exports = router;
