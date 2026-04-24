const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { handleProfileImageUpload } = require('../utils/s3Upload');

/**
 * Validation rules
 */
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .optional()
    .custom((value, { req }) => {
      // Password is required if google_id is not provided
      if (!req.body.google_id && !value) {
        throw new Error('Password is required for registration');
      }
      // If password is provided, it must be at least 6 characters
      if (value && value.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      return true;
    }),
  body('phone')
    .optional()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid phone number'),
  body('gender')
    .optional({ values: 'falsy' })
    .customSanitizer((value) => {
      if (value === undefined || value === null) return undefined;
      const trimmed = String(value).trim();
      return trimmed === '' ? undefined : trimmed.toLowerCase();
    })
    .isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  body('date_of_birth')
    .optional({ values: 'falsy' })
    .customSanitizer((value) => {
      if (value === undefined || value === null) return undefined;
      const trimmed = String(value).trim();
      return trimmed === '' ? undefined : trimmed;
    })
    .isISO8601().withMessage('Please provide a valid date (YYYY-MM-DD)'),
  body('google_id')
    .optional()
    .isString().withMessage('Google ID must be a string'),
  body('users_type')
    .optional()
    .isIn(['driver', 'users', 'admin', 'hotel']).withMessage('Users type must be driver, users, admin, or hotel')
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
];

const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters'),
  body('phone')
    .optional()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid phone number'),
  body('gender')
    .optional({ values: 'falsy' })
    .customSanitizer((value) => {
      if (value === undefined || value === null) return undefined;
      const trimmed = String(value).trim();
      return trimmed === '' ? undefined : trimmed.toLowerCase();
    })
    .isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  body('date_of_birth')
    .optional({ values: 'falsy' })
    .customSanitizer((value) => {
      if (value === undefined || value === null) return undefined;
      const trimmed = String(value).trim();
      return trimmed === '' ? undefined : trimmed;
    })
    .isISO8601().withMessage('Please provide a valid date (YYYY-MM-DD)'),
  body('users_type')
    .optional()
    .isIn(['driver', 'users', 'admin', 'hotel']).withMessage('Users type must be driver, users, admin, or hotel')
];

const verifyRegistrationOtpValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('otp')
    .trim()
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must be numeric')
];

const googleAuthValidation = [
  body('id_token')
    .trim()
    .notEmpty().withMessage('Google ID token is required')
    .isString().withMessage('ID token must be a string')
];

/**
 * Routes
 */
router.post('/google', googleAuthValidation, authController.googleAuth);
router.post('/verify-registration-otp', verifyRegistrationOtpValidation, authController.verifyRegistrationOtp);
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.post('/logout', authenticateToken, authController.logout);
router.delete('/delete-account', authenticateToken, authController.deleteAccount);
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, handleProfileImageUpload, updateProfileValidation, authController.updateProfile);

module.exports = router;
