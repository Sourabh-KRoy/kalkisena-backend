const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const formController = require('../controllers/formController');

/**
 * Validation rules for Join Kalki Sena Clinic
 *
 * Only `user_id` is required from the client. Donor fields
 * (full_name, mobile_number, email) are auto-filled on the server from
 * the user's profile when missing/blank from the frontend.
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
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 150 }).withMessage('Full name must not exceed 150 characters'),
  body('mobile_number')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 20 }).withMessage('Mobile number must not exceed 20 characters'),
  body('family_members')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0 }).withMessage('Family members must be a non-negative integer'),
  body('email')
    .optional({ nullable: true, checkFalsy: true })
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
 * Validation rules for Check Kalki Sena Membership Payment Status
 */
const checkJoinKalkiSenaPaymentStatusValidation = [
  body('order_id')
    .trim()
    .notEmpty().withMessage('Order ID is required')
];

/**
 * Validation rules for Donate to Abolish Dowry Culture
 *
 * `user_id` is optional (anonymous donations are allowed). All donor
 * fields are optional; only `amount` is strictly required.
 */
const donateAbolishDowryValidation = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .bail()
    .isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
  body('user_id')
    .optional({ nullable: true, checkFalsy: true })
    .isInt().withMessage('User ID must be an integer')
    .custom(async (value) => {
      if (!value) return true;
      const { User } = require('../models');
      const user = await User.findByPk(value);
      if (!user) {
        throw new Error('User not found');
      }
      return true;
    }),
  body('donor_name')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 150 }).withMessage('Donor name must not exceed 150 characters'),
  body('mobile_number')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 20 }).withMessage('Mobile number must not exceed 20 characters'),
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 150 }).withMessage('Email must not exceed 150 characters'),
  body('message')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 1000 }).withMessage('Message must not exceed 1000 characters')
];

/**
 * Validation rules for Check Donate Abolish Dowry Payment Status
 */
const checkDonateAbolishDowryPaymentStatusValidation = [
  body('order_id')
    .trim()
    .notEmpty().withMessage('Order ID is required')
];

/**
 * Validation rules for Donate to Doctors (Free Clinic)
 *
 * `user_id` is optional (anonymous donations allowed). Donor info is
 * optional too — server falls back to the User row when missing.
 * Only `amount` is strictly required.
 */
const donateDoctorsValidation = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .bail()
    .isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
  body('user_id')
    .optional({ nullable: true, checkFalsy: true })
    .isInt().withMessage('User ID must be an integer')
    .custom(async (value) => {
      if (!value) return true;
      const { User } = require('../models');
      const user = await User.findByPk(value);
      if (!user) {
        throw new Error('User not found');
      }
      return true;
    }),
  body('donor_name')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 150 }).withMessage('Donor name must not exceed 150 characters'),
  body('mobile_number')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 20 }).withMessage('Mobile number must not exceed 20 characters'),
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 150 }).withMessage('Email must not exceed 150 characters'),
  body('message')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 1000 }).withMessage('Message must not exceed 1000 characters')
];

/**
 * Validation rules for Check Donate Doctors Payment Status
 */
const checkDonateDoctorsPaymentStatusValidation = [
  body('order_id')
    .trim()
    .notEmpty().withMessage('Order ID is required')
];

/**
 * Routes
 */
router.post('/join-kalki-sena', joinKalkiSenaValidation, formController.joinKalkiSena);

// eSewa callbacks for Kalki Sena membership payment (no auth - called by eSewa redirect)
router.get('/join-kalki-sena/esewa/success', formController.joinKalkiSenaEsewaSuccess);
router.get('/join-kalki-sena/esewa/failure', formController.joinKalkiSenaEsewaFailure);

// Manual status check (useful if redirect was missed)
router.post(
  '/join-kalki-sena/check-payment-status',
  checkJoinKalkiSenaPaymentStatusValidation,
  formController.checkJoinKalkiSenaPaymentStatus
);

router.post('/register-coaching', registerCoachingValidation, formController.registerCoaching);
router.post('/register-hostel', registerHostelValidation, formController.registerHostel);

// Donate to Abolish Dowry Culture (eSewa)
router.post('/donate-abolish-dowry', donateAbolishDowryValidation, formController.donateAbolishDowry);

// eSewa callbacks for Donate Abolish Dowry (no auth - called by eSewa redirect)
router.get('/donate-abolish-dowry/esewa/success', formController.donateAbolishDowryEsewaSuccess);
router.get('/donate-abolish-dowry/esewa/failure', formController.donateAbolishDowryEsewaFailure);

// Manual status check (useful if redirect was missed)
router.post(
  '/donate-abolish-dowry/check-payment-status',
  checkDonateAbolishDowryPaymentStatusValidation,
  formController.checkDonateAbolishDowryPaymentStatus
);

// Donate to Doctors / Kalkiism Free Clinic (eSewa)
router.post('/donate-doctors', donateDoctorsValidation, formController.donateDoctors);

// eSewa callbacks for Donate Doctors (no auth - called by eSewa redirect)
router.get('/donate-doctors/esewa/success', formController.donateDoctorsEsewaSuccess);
router.get('/donate-doctors/esewa/failure', formController.donateDoctorsEsewaFailure);

// Manual status check (useful if redirect was missed)
router.post(
  '/donate-doctors/check-payment-status',
  checkDonateDoctorsPaymentStatusValidation,
  formController.checkDonateDoctorsPaymentStatus
);

module.exports = router;
