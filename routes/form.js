const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const formController = require('../controllers/formController');

/**
 * Validation rules for Join Kalki Sena Clinic
 */
const joinKalkiSenaValidation = [
  body('user_id')
    .notEmpty().withMessage('User ID is required')
    .isInt().withMessage('User ID must be an integer')
    .custom(async (value) => {
      const { User } = require('../models');
      const user = await User.findByPk(value);
      if (!user) {
        throw new Error('User not found');
      }
      return true;
    }),
  body('full_name')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ max: 150 }).withMessage('Full name must not exceed 150 characters'),
  body('mobile_number')
    .trim()
    .notEmpty().withMessage('Mobile number is required')
    .isLength({ max: 20 }).withMessage('Mobile number must not exceed 20 characters'),
  body('family_members')
    .optional()
    .isInt({ min: 0 }).withMessage('Family members must be a non-negative integer'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 150 }).withMessage('Email must not exceed 150 characters')
];

/**
 * Validation rules for Free Coaching Registration
 */
const registerCoachingValidation = [
  body('user_id')
    .notEmpty().withMessage('User ID is required')
    .isInt().withMessage('User ID must be an integer')
    .custom(async (value) => {
      const { User } = require('../models');
      const user = await User.findByPk(value);
      if (!user) {
        throw new Error('User not found');
      }
      return true;
    }),
  body('entrance_preparation')
    .trim()
    .notEmpty().withMessage('Entrance preparation is required')
    .isLength({ max: 150 }).withMessage('Entrance preparation must not exceed 150 characters'),
  body('coaching_subject')
    .trim()
    .notEmpty().withMessage('Coaching subject is required')
    .isLength({ max: 150 }).withMessage('Coaching subject must not exceed 150 characters')
];

/**
 * Validation rules for Hostel Registration
 */
const registerHostelValidation = [
  body('user_id')
    .notEmpty().withMessage('User ID is required')
    .isInt().withMessage('User ID must be an integer')
    .custom(async (value) => {
      const { User } = require('../models');
      const user = await User.findByPk(value);
      if (!user) {
        throw new Error('User not found');
      }
      return true;
    }),
  body('full_name')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ max: 150 }).withMessage('Full name must not exceed 150 characters'),
  body('mobile_number')
    .trim()
    .notEmpty().withMessage('Mobile number is required')
    .isLength({ max: 20 }).withMessage('Mobile number must not exceed 20 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 150 }).withMessage('Email must not exceed 150 characters'),
  body('hostel_location')
    .trim()
    .notEmpty().withMessage('Hostel location is required')
    .isLength({ max: 150 }).withMessage('Hostel location must not exceed 150 characters')
];

/**
 * Routes
 */
router.post('/join-kalki-sena', joinKalkiSenaValidation, formController.joinKalkiSena);
router.post('/register-coaching', registerCoachingValidation, formController.registerCoaching);
router.post('/register-hostel', registerHostelValidation, formController.registerHostel);

module.exports = router;
