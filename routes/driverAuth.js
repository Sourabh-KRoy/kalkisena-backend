const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const driverAuthController = require('../controllers/driverAuthController');
const { authenticateToken } = require('../middleware/auth');
const { handleRiderFileUpload, deleteFileFromS3 } = require('../utils/s3Upload');

/**
 * Validation rules for Driver Login
 */
const driverLoginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
];

/**
 * Validation rules for Rider Registration
 */
const riderRegistrationValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Driver name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters'),
  body('password')
    .trim()
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('phone_number')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .isMobilePhone().withMessage('Please provide a valid phone number'),
  body('dob')
    .trim()
    .notEmpty().withMessage('Date of birth is required')
    .isISO8601().withMessage('Please provide a valid date of birth (YYYY-MM-DD)')
    .toDate(),
  body('gender')
    .trim()
    .notEmpty().withMessage('Gender is required')
    .isIn(['Male', 'Female', 'Other', 'male', 'female', 'other']).withMessage('Gender must be Male, Female, or Other'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('city_to_ride')
    .trim()
    .notEmpty().withMessage('City to ride is required'),
  body('vehicle_type')
    .trim()
    .notEmpty().withMessage('Vehicle type is required')
    .isIn(['car', 'bike', 'scooter', 'taxi']).withMessage('Vehicle type must be car, bike, scooter, or taxi'),
  body('vehicle_make')
    .trim()
    .notEmpty().withMessage('Vehicle make (company name) is required'),
  body('vehicle_model')
    .trim()
    .notEmpty().withMessage('Vehicle model is required'),
  body('year_of_manufacture')
    .trim()
    .notEmpty().withMessage('Year of manufacture is required')
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 }).withMessage('Please provide a valid year of manufacture'),
  body('color')
    .optional()
    .trim(),
  body('number_of_seats')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Number of seats must be a valid number'),
  body('licence_plate_number')
    .optional()
    .trim()
];

/**
 * Middleware to clean up uploaded files if validation fails
 * This runs after validation and before the controller
 */
const cleanupFilesOnValidationError = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Clean up uploaded files if validation fails
    if (req.files) {
      Object.values(req.files).forEach(fileArray => {
        if (fileArray && fileArray[0] && fileArray[0].location) {
          deleteFileFromS3(fileArray[0].location).catch(err => {
            console.error('Error cleaning up file:', err);
          });
        }
      });
    }
    // Let the controller handle the error response
  }
  next();
};

/**
 * Routes
 */
router.post('/login', driverLoginValidation, driverAuthController.login);
router.get('/profile', authenticateToken, driverAuthController.getProfile);
router.post('/register-rider', handleRiderFileUpload, riderRegistrationValidation, cleanupFilesOnValidationError, driverAuthController.registerRider);

module.exports = router;
