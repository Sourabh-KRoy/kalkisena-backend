const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const bookPurchaseController = require('../controllers/bookPurchase');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * Validation rules
 */
router.use((req, res, next) => {
  console.log('[BOOK_PURCHASE][API_HIT]', {
    method: req.method,
    path: req.originalUrl,
    has_auth_header: Boolean(req.headers.authorization),
    at: new Date().toISOString()
  });
  next();
});

const addAddressValidation = [
  body('address')
    .trim()
    .notEmpty().withMessage('Address is required')
    .isLength({ min: 5, max: 500 }).withMessage('Address must be between 5 and 500 characters'),
  body('city')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('City must be less than 100 characters'),
  body('state')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('State must be less than 100 characters'),
  body('postal_code')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('Postal code must be less than 20 characters'),
  body('country')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Country must be less than 100 characters'),
  body('phone_number')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid phone number'),
  body('is_default')
    .optional()
    .isBoolean().withMessage('is_default must be a boolean'),
  body('label')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Label must be less than 50 characters')
];

const updateAddressValidation = [
  param('id')
    .isInt().withMessage('Address ID must be an integer'),
  body('address')
    .optional()
    .trim()
    .isLength({ min: 5, max: 500 }).withMessage('Address must be between 5 and 500 characters'),
  body('city')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('City must be less than 100 characters'),
  body('state')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('State must be less than 100 characters'),
  body('postal_code')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('Postal code must be less than 20 characters'),
  body('country')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Country must be less than 100 characters'),
  body('phone_number')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid phone number'),
  body('is_default')
    .optional()
    .isBoolean().withMessage('is_default must be a boolean'),
  body('label')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Label must be less than 50 characters')
];

const purchaseBookValidation = [
  body().custom((value, { req }) => {
    const rawMethod =
      req.body.payment_method ??
      req.body.paymentMethod ??
      req.body.gateway ??
      req.body.payment_gateway ??
      req.body.paymentGateway ??
      req.body.method ??
      req.body.provider;
    if (rawMethod === undefined || rawMethod === null || rawMethod === '') {
      return true; // backward compatibility: default to nepalpayment
    }

    const normalized = String(rawMethod).toLowerCase().replace(/[\s_-]/g, '');
    const allowed = ['nepalpayment', 'nepalpay', 'nepal', 'esewa', 'esewaepay'];
    if (!allowed.includes(normalized)) {
      throw new Error('payment_method/paymentMethod must be one of: nepalpayment, esewa');
    }
    return true;
  }),
  body('book_id')
    .notEmpty().withMessage('Book ID is required')
    .isInt().withMessage('Book ID must be an integer'),
  body('clinic_id')
    .notEmpty().withMessage('clinic_id is required (pickup location)')
    .isInt().withMessage('clinic_id must be an integer'),
  body('quantity')
    .optional()
    .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('phone_number')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid phone number'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters')
];

const getPurchaseHistoryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn([
      'pending',
      'pre_booked',
      'awaiting_balance',
      'processing',
      'completed',
      'cancelled',
      'refunded'
    ])
    .withMessage('Invalid status filter'),
  query('pickup_tracking_status')
    .optional()
    .isIn([
      'order_successful',
      'shipped',
      'out_for_delivery',
      'arrived_at_clinic',
      'order_delivered_success'
    ])
    .withMessage('Invalid pickup_tracking_status filter')
];


const nearestClinicsValidation = [
  query('latitude')
    .notEmpty()
    .withMessage('latitude query param is required')
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude must be between -90 and 90'),
  query('longitude')
    .notEmpty()
    .withMessage('longitude query param is required')
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude must be between -180 and 180'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('limit must be an integer between 1 and 20')
];

const updatePurchasePickupStatusValidation = [
  param('id').isInt().withMessage('Purchase ID must be an integer'),
  body('pickup_tracking_status')
    .notEmpty().withMessage('pickup_tracking_status is required')
    .isIn([
      'order_successful',
      'shipped',
      'out_for_delivery',
      'arrived_at_clinic',
      'order_delivered_success'
    ])
    .withMessage('Invalid pickup_tracking_status')
];

const addBookValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 2, max: 255 }).withMessage('Title must be between 2 and 255 characters'),
  body('author')
    .trim()
    .notEmpty().withMessage('Author is required')
    .isLength({ min: 2, max: 255 }).withMessage('Author must be between 2 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Description must be less than 2000 characters'),
  body('promotional_description')
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage('Promotional description must be less than 5000 characters'),
  body('price')
    .notEmpty().withMessage('Price is required')
    .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('currency')
    .optional()
    .trim()
    .isLength({ max: 10 }).withMessage('Currency must be less than 10 characters'),
  body('image_url')
    .optional()
    .trim()
    .isURL().withMessage('Image URL must be a valid URL')
    .isLength({ max: 500 }).withMessage('Image URL must be less than 500 characters'),
  body('stock')
    .optional()
    .isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('isbn')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('ISBN must be less than 50 characters'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Category must be less than 100 characters'),
  body('published_date')
    .optional()
    .isISO8601().withMessage('Published date must be a valid date (YYYY-MM-DD)'),
  body('publisher')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Publisher must be less than 255 characters'),
  body('language')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Language must be less than 50 characters'),
  body('pages')
    .optional()
    .isInt({ min: 1 }).withMessage('Pages must be a positive integer'),
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean')
];


router.get('/book', bookPurchaseController.getBook);
router.post('/book', addBookValidation, bookPurchaseController.addBook);

const createPickupClinicValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Clinic name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Clinic name must be between 2 and 255 characters'),
  body('address')
    .trim()
    .notEmpty().withMessage('Address is required')
    .isLength({ min: 5, max: 500 }).withMessage('Address must be between 5 and 500 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid phone number'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Please provide a valid email address'),
  body('opening_hours')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Opening hours must be less than 255 characters'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active must be a boolean')
];

router.get('/clinics/nearest', nearestClinicsValidation, bookPurchaseController.listNearestPickupClinics);
router.get('/clinics', bookPurchaseController.listPickupClinics);

router.post('/clinics', createPickupClinicValidation, bookPurchaseController.createPickupClinic);

router.get('/addresses', authenticateToken, bookPurchaseController.getAddresses);
router.post('/addresses', authenticateToken, addAddressValidation, bookPurchaseController.addAddress);
router.put('/addresses/:id', authenticateToken, updateAddressValidation, bookPurchaseController.updateAddress);
router.delete('/addresses/:id', authenticateToken, [param('id').isInt().withMessage('Address ID must be an integer')], bookPurchaseController.deleteAddress);


router.post('/purchase', authenticateToken, purchaseBookValidation, bookPurchaseController.purchaseBook);
router.post(
  '/purchases/:id/pay-balance',
  authenticateToken,
  purchaseBookValidation,
  bookPurchaseController.payBookBalance
);
router.patch(
  '/book/:id/balance-payment',
  authenticateToken,
  requireAdmin,
  [
    body('balance_payment_enabled')
      .optional()
      .isBoolean()
      .withMessage('balance_payment_enabled must be a boolean')
  ],
  bookPurchaseController.setBookBalancePaymentEnabled
);
router.get('/my-orders', authenticateToken, getPurchaseHistoryValidation, bookPurchaseController.getMyOrders);
router.get('/purchases', authenticateToken, getPurchaseHistoryValidation, bookPurchaseController.getPurchaseHistory);
router.get('/purchases/:id', authenticateToken, [param('id').isInt().withMessage('Purchase ID must be an integer')], bookPurchaseController.getPurchaseById);
router.patch(
  '/purchases/:id/pickup-status',
  authenticateToken,
  requireAdmin,
  updatePurchasePickupStatusValidation,
  bookPurchaseController.updatePurchasePickupStatus
);

// Payment routes
router.post('/payment-callback', bookPurchaseController.paymentCallback); // No auth - called by payment gateway
router.get('/esewa/success', bookPurchaseController.esewaSuccessCallback); // No auth - called by eSewa redirect
router.get('/esewa/failure', bookPurchaseController.esewaFailureCallback); // No auth - called by eSewa redirect
router.post('/check-payment-status', authenticateToken, [
  body('order_id').optional().trim().notEmpty().withMessage('Order ID is required if provided'),
  body('purchase_id').optional().isInt().withMessage('Purchase ID must be an integer'),
], bookPurchaseController.checkPaymentStatus);

module.exports = router;
