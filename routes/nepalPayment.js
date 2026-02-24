const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const nepalPaymentController = require('../controllers/nepalPaymentController');

/**
 * Validation rules for Get Service Charge
 */
const getServiceChargeValidation = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('instrument_code')
    .trim()
    .notEmpty().withMessage('Instrument code is required')
];

/**
 * Validation rules for Create Payment
 */
const createPaymentValidation = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('order_id')
    .optional()
    .trim()
    .isString().withMessage('Order ID must be a string')
];

/**
 * Validation rules for Webhook
 */
const webhookValidation = [
  body('MerchantTxnId')
    .trim()
    .notEmpty().withMessage('MerchantTxnId is required')
];

/**
 * Validation rules for Check Status
 */
const checkStatusValidation = [
  body('order_id')
    .trim()
    .notEmpty().withMessage('Order ID is required')
];

/**
 * Routes
 */
router.get('/instruments', nepalPaymentController.getInstruments);
router.post('/service-charge', getServiceChargeValidation, nepalPaymentController.getServiceCharge);
router.post('/create', createPaymentValidation, nepalPaymentController.createPayment);
router.post('/webhook', webhookValidation, nepalPaymentController.webhook);
router.post('/check-status', checkStatusValidation, nepalPaymentController.checkStatus);

module.exports = router;
