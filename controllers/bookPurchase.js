const { Book, PurchaseBook, UserAddress, User, Payment, PickupClinic } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const axios = require('axios');
const crypto = require('crypto');

/**
 * Books are collected from the clinic (no home delivery). Stored in
 * `purchase_book.address` when the client does not send shipping details.
 */
const BOOK_CLINIC_PICKUP_ADDRESS_LINE =
  'Clinic pickup — Kalkiism Research and Training Center (Kuleshwor). Ready approximately 2 months after full payment. No home delivery.';

const BOOK_FULL_PRICE = parseFloat(process.env.BOOK_FULL_PRICE || '1000');
const BOOK_PRE_BOOKING_AMOUNT = parseFloat(process.env.BOOK_PRE_BOOKING_AMOUNT || '100');
const BOOK_BALANCE_AMOUNT = parseFloat(
  process.env.BOOK_BALANCE_AMOUNT || String(BOOK_FULL_PRICE - BOOK_PRE_BOOKING_AMOUNT)
);

const BOOK_PRICING_SUMMARY = {
  full_price: BOOK_FULL_PRICE,
  pre_booking_amount: BOOK_PRE_BOOKING_AMOUNT,
  balance_amount: BOOK_BALANCE_AMOUNT,
  currency: 'NPR',
  note:
    'Pay NPR 100 now to pre-book. When the book is available (typically in 2–3 months), pay the remaining NPR 900 and collect from your selected clinic.'
};

const PICKUP_TRACKING_STATUS_LABELS = {
  order_successful: 'Order successful',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  arrived_at_clinic: 'Arrived at clinic',
  order_delivered_success: 'Order delivered successfully'
};

const CLINIC_CARD_ATTRIBUTES = [
  'id',
  'name',
  'address',
  'phone',
  'email',
  'opening_hours',
  'latitude',
  'longitude'
];

const distanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const clinicToPublicDTO = (clinic) => {
  const c = clinic.get ? clinic.get({ plain: true }) : { ...clinic };
  return {
    id: c.id,
    name: c.name,
    address: c.address,
    phone: c.phone,
    email: c.email,
    opening_hours: c.opening_hours,
    latitude: c.latitude != null && c.latitude !== '' ? Number(c.latitude) : null,
    longitude: c.longitude != null && c.longitude !== '' ? Number(c.longitude) : null
  };
};

const pickupTrackingStatusLabel = (status) =>
  PICKUP_TRACKING_STATUS_LABELS[status] || status || '';

const formatClinicPickupAddress = (clinic) => {
  const ch = clinic.get ? clinic.get({ plain: true }) : clinic;
  const lines = [`Clinic pickup: ${ch.name}`, ch.address];
  if (ch.opening_hours) lines.push(`Clinic hours: ${ch.opening_hours}`);
  if (ch.phone) lines.push(`Clinic phone: ${ch.phone}`);
  if (ch.email) lines.push(`Clinic email: ${ch.email}`);
  lines.push('Pre-book with NPR 100; pay remaining NPR 900 when available (~2–3 months), then collect from clinic.');
  return lines.join('\n');
};

const withPickupLabels = (instance) => {
  if (!instance) return null;
  const plain = instance.get ? instance.get({ plain: true }) : instance;
  return {
    ...plain,
    pickup_tracking_status_label: pickupTrackingStatusLabel(plain.pickup_tracking_status)
  };
};

const parsePaymentGatewayResponse = (payment) => {
  try {
    if (payment?.gateway_response) return JSON.parse(payment.gateway_response);
  } catch (e) {
    // ignore
  }
  return {};
};

const canPayBalanceForPurchase = (purchase, book) => {
  const plain = purchase.get ? purchase.get({ plain: true }) : purchase;
  const bookPlain = book?.get ? book.get({ plain: true }) : book;
  const balanceDue = Number(plain.balance_due || 0);
  return (
    (plain.status === 'pre_booked' || plain.status === 'awaiting_balance') &&
    balanceDue > 0 &&
    Boolean(bookPlain?.balance_payment_enabled)
  );
};

const formatMyOrderDTO = (purchase) => {
  const plain = purchase.get ? purchase.get({ plain: true }) : { ...purchase };
  const payment = plain.payment || null;
  const balancePayment = plain.balance_payment || null;
  const book = plain.book || null;
  return {
    id: plain.id,
    order_id: plain.tracking_number,
    quantity: plain.quantity,
    unit_price: plain.unit_price,
    total_price: plain.total_price,
    amount_paid: plain.amount_paid != null ? Number(plain.amount_paid) : null,
    balance_due: plain.balance_due != null ? Number(plain.balance_due) : null,
    purchase_date: plain.purchase_date,
    status: plain.status,
    is_pre_booking: plain.status === 'pre_booked' || plain.status === 'awaiting_balance',
    can_pay_balance: canPayBalanceForPurchase(plain, book),
    balance_payment_available: Boolean(book?.balance_payment_enabled),
    pickup_tracking_status: plain.pickup_tracking_status,
    pickup_tracking_status_label: pickupTrackingStatusLabel(plain.pickup_tracking_status),
    payment_status: payment ? payment.status : null,
    payment_order_id: payment ? payment.order_id : plain.tracking_number,
    balance_payment_status: balancePayment ? balancePayment.status : null,
    balance_payment_order_id: balancePayment ? balancePayment.order_id : null,
    book: book || null,
    pickup_clinic: plain.pickup_clinic ? clinicToPublicDTO(plain.pickup_clinic) : null,
    pricing: BOOK_PRICING_SUMMARY
  };
};

/**
 * Payment Gateway Helper Class
 */
class BookPaymentGateway {
  constructor() {
    this.merchantId = process.env.NEPAL_PAYMENT_MERCHANT_ID || '7582';
    this.merchantName = process.env.NEPAL_PAYMENT_MERCHANT_NAME || 'WebStudioNepal';
    this.apiUsername = process.env.NEPAL_PAYMENT_API_USERNAME || 'WebStudioNepal';
    this.apiPassword = process.env.NEPAL_PAYMENT_API_PASSWORD || 'WebStudioNepal#876';
    this.secretKey = process.env.NEPAL_PAYMENT_SECRET_KEY || 'WebStudiol$KEY12';
    this.baseUrl = process.env.NEPAL_PAYMENT_BASE_URL || 'https://apisandbox.nepalpayment.com';
  }

  /**
   * Generate HMAC SHA512 signature
   */
  generateSignature(data) {
    const sortedKeys = Object.keys(data).sort();
    const sortedData = {};
    sortedKeys.forEach(key => {
      sortedData[key] = data[key];
    });
    const value = Object.values(sortedData).join('');
    return crypto.createHmac('sha512', this.secretKey)
      .update(value)
      .digest('hex');
  }

  /**
   * Auth headers
   */
  authHeader() {
    const credentials = Buffer.from(`${this.apiUsername}:${this.apiPassword}`).toString('base64');
    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Generate unique order ID for book purchase
   * Format: BP-{YYYYMMDD}-{SEQUENCE}-{RANDOM}
   */
  async generateOrderId() {
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);

    const lastOrder = await Payment.findOne({
      where: {
        order_id: {
          [Op.like]: `BP-${datePrefix}-%`
        }
      },
      order: [['id', 'DESC']]
    });

    let sequence;
    if (lastOrder && lastOrder.order_id) {
      const match = lastOrder.order_id.match(/BP-\d+-(\d+)-/);
      if (match) {
        sequence = String(parseInt(match[1]) + 1).padStart(4, '0');
      } else {
        sequence = '0001';
      }
    } else {
      sequence = '0001';
    }

    let orderId = `BP-${datePrefix}-${sequence}-${randomSuffix}`;

    const exists = await Payment.findOne({ where: { order_id: orderId } });
    if (exists) {
      const newRandomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
      orderId = `BP-${datePrefix}-${sequence}-${newRandomSuffix}`;
    }

    return orderId;
  }

  /**
   * Create payment and get ProcessId
   */
  async createPayment(amount, orderId) {
    const payload = {
      MerchantId: this.merchantId,
      MerchantName: this.merchantName,
      Amount: amount,
      MerchantTxnId: orderId
    };

    payload.Signature = this.generateSignature(payload);

    const response = await axios.post(
      `${this.baseUrl}/GetProcessId`,
      payload,
      { headers: this.authHeader() }
    );

    return response.data;
  }

  /**
   * Check transaction status from gateway
   */
  async checkTransactionFromGateway(merchantTxnId) {
    try {
      const payload = {
        MerchantId: this.merchantId,
        MerchantName: this.merchantName,
        MerchantTxnId: merchantTxnId
      };

      payload.Signature = this.generateSignature(payload);

      const response = await axios.post(
        `${this.baseUrl}/CheckTransactionStatus`,
        payload,
        { headers: this.authHeader() }
      );

      return response.data?.data || {};
    } catch (error) {
      console.error('Check transaction from gateway error:', error);
      return {};
    }
  }
}

const paymentGateway = new BookPaymentGateway();

/**
 * eSewa ePay v2 helper (UAT/Test)
 * Docs: https://developer.esewa.com.np/pages/Epay-V2
 */
class EsewaGateway {
  constructor() {
    this.productCode = process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST';
    this.secretKey = process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q';
    this.formUrl = process.env.ESEWA_FORM_URL || 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
    this.statusBaseUrl = process.env.ESEWA_STATUS_URL_BASE || 'https://uat.esewa.com.np/api/epay/transaction/status/';
  }

  /**
   * eSewa signature: HMAC SHA256, base64
   * message format: "total_amount=...,transaction_uuid=...,product_code=..."
   */
  sign(message) {
    const digest = crypto
      .createHmac('sha256', this.secretKey)
      .update(message)
      .digest();
    return digest.toString('base64');
  }

  /**
   * Build signature from signed fields list.
   * signedFields: "a,b,c" -> "a=value,b=value,c=value" (same order)
   */
  signatureFromFields(payload, signedFields) {
    const fields = String(signedFields || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const message = fields.map((k) => `${k}=${payload[k] ?? ''}`).join(',');
    return { message, signature: this.sign(message) };
  }

  async checkStatus({ transaction_uuid, total_amount, product_code }) {
    const params = new URLSearchParams({
      product_code,
      total_amount: String(total_amount),
      transaction_uuid: String(transaction_uuid)
    });
    const url = `${this.statusBaseUrl}?${params.toString()}`;
    const res = await axios.get(url);
    return res.data;
  }
}

const esewaGateway = new EsewaGateway();

const logBookPurchaseEvent = (event, payload = {}) => {
  console.log(`[BOOK_PURCHASE][${event}]`, {
    ...payload,
    at: new Date().toISOString()
  });
};

/**
 * Normalize payment method from request.
 * Supports: payment_method, paymentMethod
 */
const normalizePaymentMethod = (reqBody = {}) => {
  const raw =
    reqBody.payment_method ??
    reqBody.paymentMethod ??
    reqBody.gateway ??
    reqBody.payment_gateway ??
    reqBody.paymentGateway ??
    reqBody.method ??
    reqBody.provider ??
    'nepalpayment';
  const normalized = String(raw).toLowerCase().replace(/[\s_-]/g, '');
  if (normalized === 'esewa' || normalized === 'esewaepay') return 'esewa';
  if (normalized === 'nepalpayment' || normalized === 'nepalpay' || normalized === 'nepal') return 'nepalpayment';
  return 'nepalpayment';
};

/**
 * Generate order ID for balance payment.
 * Format: BB-{YYYYMMDD}-{SEQUENCE}-{RANDOM}
 */
const generateBalanceOrderId = async () => {
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);

  const lastOrder = await Payment.findOne({
    where: { order_id: { [Op.like]: `BB-${datePrefix}-%` } },
    order: [['id', 'DESC']]
  });

  let sequence = '0001';
  if (lastOrder?.order_id) {
    const match = lastOrder.order_id.match(/BB-\d+-(\d+)-/);
    if (match) sequence = String(parseInt(match[1], 10) + 1).padStart(4, '0');
  }

  let orderId = `BB-${datePrefix}-${sequence}-${randomSuffix}`;
  const exists = await Payment.findOne({ where: { order_id: orderId } });
  if (exists) {
    const newRandomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
    orderId = `BB-${datePrefix}-${sequence}-${newRandomSuffix}`;
  }
  return orderId;
};

const createPreBookingPurchase = async (payment, purchaseData, trackingNumber) => {
  const existing = await PurchaseBook.findOne({
    where: { tracking_number: trackingNumber }
  });
  if (existing) return existing;

  const book = await Book.findByPk(purchaseData.book_id);
  if (!book) throw new Error('Book not found');
  if (!book.is_active) throw new Error('Book is not available for pre-booking');

  const quantity = purchaseData.quantity || 1;
  const totalPrice = BOOK_FULL_PRICE * quantity;
  const prePaid = BOOK_PRE_BOOKING_AMOUNT * quantity;
  const balanceDue = BOOK_BALANCE_AMOUNT * quantity;

  return PurchaseBook.create({
    payment_id: payment.id,
    user_id: purchaseData.user_id,
    book_id: purchaseData.book_id,
    quantity,
    unit_price: BOOK_FULL_PRICE,
    total_price: totalPrice,
    amount_paid: prePaid,
    balance_due: balanceDue,
    address: purchaseData.address || BOOK_CLINIC_PICKUP_ADDRESS_LINE,
    city: purchaseData.city,
    state: purchaseData.state,
    postal_code: purchaseData.postal_code,
    country: purchaseData.country,
    phone_number: purchaseData.phone_number,
    notes: purchaseData.notes,
    pickup_clinic_id: purchaseData.pickup_clinic_id || null,
    pickup_tracking_status: 'order_successful',
    status: 'pre_booked',
    tracking_number: trackingNumber
  });
};

const applyBalancePaymentSuccess = async (payment, purchaseData) => {
  const purchase = await PurchaseBook.findOne({
    where: { id: purchaseData.purchase_id, user_id: purchaseData.user_id }
  });
  if (!purchase) throw new Error('Pre-booking order not found');

  if (purchase.status === 'processing' || purchase.status === 'completed') {
    return purchase;
  }

  if (purchase.status !== 'pre_booked' && purchase.status !== 'awaiting_balance') {
    throw new Error('Order is not eligible for balance payment');
  }

  const book = await Book.findByPk(purchase.book_id);
  if (!book) throw new Error('Book not found');
  if (!book.balance_payment_enabled) {
    throw new Error('Balance payment is not open yet. The book is not available for pickup payment.');
  }
  if (book.stock < purchase.quantity) {
    throw new Error(`Insufficient stock. Only ${book.stock} available.`);
  }

  const paidNow = Number(payment.amount);
  const newAmountPaid = Number(purchase.amount_paid) + paidNow;
  const newBalanceDue = Math.max(0, Number(purchase.total_price) - newAmountPaid);

  await purchase.update({
    balance_payment_id: payment.id,
    amount_paid: newAmountPaid,
    balance_due: newBalanceDue,
    status: 'processing',
    pickup_tracking_status: 'order_successful'
  });

  await book.update({ stock: book.stock - purchase.quantity });
  return purchase;
};

const fulfillBookPayment = async (payment, options = {}) => {
  const gatewayResponseData = parsePaymentGatewayResponse(payment);
  const purchaseData = gatewayResponseData.purchase_data;
  if (!purchaseData) {
    throw new Error('Purchase data not found in payment record');
  }

  const phase = purchaseData.payment_phase || 'pre_booking';
  const trackingNumber = options.trackingNumber || payment.order_id;

  if (phase === 'balance') {
    return applyBalancePaymentSuccess(payment, purchaseData);
  }

  return createPreBookingPurchase(payment, purchaseData, trackingNumber);
};

const buildPaymentInitResponse = ({
  res,
  paymentMethod,
  paymentMethodDebug,
  orderId,
  amount,
  payment,
  processId,
  esewaPayload,
  book,
  pickupClinicPayload,
  message,
  payment_phase
}) => {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  if (paymentMethod === 'esewa') {
    return res.status(200).json({
      success: true,
      message,
      data: {
        gateway: 'ESEWA',
        payment_method: 'esewa',
        paymentMethod: 'esewa',
        payment_phase,
        order_id: orderId,
        amount,
        currency: 'NPR',
        payment_url: esewaGateway.formUrl,
        form_data: esewaPayload,
        pricing: BOOK_PRICING_SUMMARY,
        book: {
          id: book.id,
          title: book.title,
          author: book.author,
          image_url: book.image_url
        },
        pickup_clinic: pickupClinicPayload,
        debug: {
          resolved_gateway: paymentMethod,
          selected_input: paymentMethodDebug.selectedRaw,
          normalized_input: paymentMethodDebug.normalized
        }
      }
    });
  }

  const paymentUrl =
    process.env.NEPAL_PAYMENT_GATEWAY_URL ||
    'https://gatewaysandbox.nepalpayment.com/Payment/Index';
  const responseUrl =
    process.env.NEPAL_PAYMENT_RESPONSE_URL ||
    `${appUrl}/api/book-purchase/payment-callback`;

  return res.status(200).json({
    success: true,
    message,
    data: {
      gateway: 'NEPALPAYMENT',
      payment_method: 'nepalpayment',
      paymentMethod: 'nepalpayment',
      payment_phase,
      order_id: orderId,
      amount,
      currency: 'NPR',
      payment_url: paymentUrl,
      form_data: {
        MerchantId: paymentGateway.merchantId,
        MerchantName: paymentGateway.merchantName,
        Amount: amount,
        MerchantTxnId: orderId,
        ProcessId: processId,
        ResponseUrl: responseUrl
      },
      pricing: BOOK_PRICING_SUMMARY,
      book: {
        id: book.id,
        title: book.title,
        author: book.author,
        image_url: book.image_url
      },
      pickup_clinic: pickupClinicPayload,
      debug: {
        resolved_gateway: paymentMethod,
        selected_input: paymentMethodDebug.selectedRaw,
        normalized_input: paymentMethodDebug.normalized
      }
    }
  });
};

const resolvePaymentMethodDebug = (reqBody = {}) => {
  const candidates = {
    payment_method: reqBody.payment_method,
    paymentMethod: reqBody.paymentMethod,
    gateway: reqBody.gateway,
    payment_gateway: reqBody.payment_gateway,
    paymentGateway: reqBody.paymentGateway,
    method: reqBody.method,
    provider: reqBody.provider
  };

  const selectedRaw =
    candidates.payment_method ??
    candidates.paymentMethod ??
    candidates.gateway ??
    candidates.payment_gateway ??
    candidates.paymentGateway ??
    candidates.method ??
    candidates.provider ??
    'nepalpayment';

  const normalized = String(selectedRaw).toLowerCase().replace(/[\s_-]/g, '');
  const resolved = normalizePaymentMethod(reqBody);

  return { candidates, selectedRaw, normalized, resolved };
};

/**
 * Add a new book
 */
const addBook = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      title,
      author,
      description,
      promotional_description,
      price,
      currency = 'NPR',
      image_url,
      stock = 0,
      isbn,
      category,
      published_date,
      publisher,
      language = 'English',
      pages,
      is_active = true
    } = req.body;

    // Check if book with same ISBN already exists (if ISBN provided)
    if (isbn) {
      const existingBook = await Book.findOne({ where: { isbn } });
      if (existingBook) {
        return res.status(400).json({
          success: false,
          message: 'Book with this ISBN already exists'
        });
      }
    }

    // Create the book
    const book = await Book.create({
      title,
      author,
      description,
      promotional_description,
      price: parseFloat(price),
      currency,
      image_url,
      stock: parseInt(stock) || 0,
      isbn: isbn || null,
      category: category || null,
      published_date: published_date || null,
      publisher: publisher || null,
      language,
      pages: pages ? parseInt(pages) : null,
      is_active
    });

    res.status(201).json({
      success: true,
      message: 'Book added successfully',
      data: book
    });
  } catch (error) {
    console.error('Add book error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding book',
      error: error.message
    });
  }
};

/**
 * Get the single book details
 */
const getBook = async (req, res) => {
  try {
    const book = await Book.findOne({
      where: { is_active: true },
      order: [['created_at', 'DESC']]
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'No active book available'
      });
    }

    res.json({
      success: true,
      message: 'Book retrieved successfully',
      data: {
        ...book.toJSON(),
        pricing: BOOK_PRICING_SUMMARY,
        balance_payment_enabled: Boolean(book.balance_payment_enabled)
      }
    });
  } catch (error) {
    console.error('Get book error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving book',
      error: error.message
    });
  }
};

/**
 * Get all saved addresses for the authenticated user
 */
const getAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    logBookPurchaseEvent('GET_ADDRESSES_REQUEST', { user_id: userId });

    const addresses = await UserAddress.findAll({
      where: { user_id: userId },
      order: [
        ['is_default', 'DESC'],
        ['created_at', 'DESC']
      ]
    });

    res.json({
      success: true,
      message: 'Addresses retrieved successfully',
      data: addresses
    });
    logBookPurchaseEvent('GET_ADDRESSES_SUCCESS', { user_id: userId, count: addresses.length });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving addresses',
      error: error.message
    });
  }
};

/**
 * Add a new address for the authenticated user
 */
const addAddress = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { address, city, state, postal_code, country, phone_number, is_default, label } = req.body;
    logBookPurchaseEvent('ADD_ADDRESS_REQUEST', {
      user_id: userId,
      is_default: Boolean(is_default),
      label: label || null
    });

    // If this is set as default, unset other default addresses
    if (is_default) {
      await UserAddress.update(
        { is_default: false },
        { where: { user_id: userId } }
      );
    }

    const newAddress = await UserAddress.create({
      user_id: userId,
      address,
      city,
      state,
      postal_code,
      country: country || 'Nepal',
      phone_number,
      is_default: is_default || false,
      label
    });

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: newAddress
    });
    logBookPurchaseEvent('ADD_ADDRESS_SUCCESS', { user_id: userId, address_id: newAddress.id });
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding address',
      error: error.message
    });
  }
};

/**
 * Update an existing address
 */
const updateAddress = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const addressId = req.params.id;
    const { address, city, state, postal_code, country, phone_number, is_default, label } = req.body;
    logBookPurchaseEvent('UPDATE_ADDRESS_REQUEST', {
      user_id: userId,
      address_id: Number(addressId),
      is_default: is_default !== undefined ? Boolean(is_default) : undefined
    });

    // Check if address exists and belongs to user
    const existingAddress = await UserAddress.findOne({
      where: { id: addressId, user_id: userId }
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // If this is set as default, unset other default addresses
    if (is_default && !existingAddress.is_default) {
      await UserAddress.update(
        { is_default: false },
        { where: { user_id: userId, id: { [Op.ne]: addressId } } }
      );
    }

    // Update address
    await existingAddress.update({
      address: address || existingAddress.address,
      city: city !== undefined ? city : existingAddress.city,
      state: state !== undefined ? state : existingAddress.state,
      postal_code: postal_code !== undefined ? postal_code : existingAddress.postal_code,
      country: country || existingAddress.country,
      phone_number: phone_number !== undefined ? phone_number : existingAddress.phone_number,
      is_default: is_default !== undefined ? is_default : existingAddress.is_default,
      label: label !== undefined ? label : existingAddress.label
    });

    res.json({
      success: true,
      message: 'Address updated successfully',
      data: existingAddress
    });
    logBookPurchaseEvent('UPDATE_ADDRESS_SUCCESS', { user_id: userId, address_id: Number(addressId) });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating address',
      error: error.message
    });
  }
};

/**
 * Delete an address
 */
const deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.id;
    logBookPurchaseEvent('DELETE_ADDRESS_REQUEST', { user_id: userId, address_id: Number(addressId) });

    const address = await UserAddress.findOne({
      where: { id: addressId, user_id: userId }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    await address.destroy();

    res.json({
      success: true,
      message: 'Address deleted successfully'
    });
    logBookPurchaseEvent('DELETE_ADDRESS_SUCCESS', { user_id: userId, address_id: Number(addressId) });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting address',
      error: error.message
    });
  }
};

/**
 * Pre-book a book: pay NPR 100 now. When the book is available (~2–3 months),
 * pay the remaining NPR 900 and pick up from the selected clinic.
 */
const purchaseBook = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const {
      book_id,
      clinic_id,
      quantity = 1,
      phone_number,
      notes
    } = req.body;
    const payment_method = normalizePaymentMethod(req.body);
    const paymentMethodDebug = resolvePaymentMethodDebug(req.body);
    console.log('[BOOK_PURCHASE] Incoming purchase request:', {
      user_id: userId,
      book_id,
      clinic_id,
      quantity,
      payment_inputs: paymentMethodDebug.candidates,
      selected_raw: paymentMethodDebug.selectedRaw,
      normalized: paymentMethodDebug.normalized,
      resolved_gateway: paymentMethodDebug.resolved
    });
    console.log('[BOOK_PURCHASE] Full request body:', req.body);

    // Get the book
    const book = await Book.findByPk(book_id);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    if (!book.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Book is not available for purchase'
      });
    }

    const clinic = await PickupClinic.findOne({
      where: { id: clinic_id, is_active: true }
    });
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Pickup clinic not found or inactive'
      });
    }

    logBookPurchaseEvent('CLINIC_SELECTED_FOR_PURCHASE', {
      user_id: userId,
      clinic_id: clinic.id,
      clinic_name: clinic.name
    });

    const pickupClinicPayload = clinicToPublicDTO(clinic);

    const deliveryAddress = {
      address: formatClinicPickupAddress(clinic),
      city: null,
      state: null,
      postal_code: null,
      country: 'Nepal',
      phone_number: req.user.phone || phone_number || null
    };

    const chargeAmount = BOOK_PRE_BOOKING_AMOUNT * quantity;
    const orderId = await paymentGateway.generateOrderId();

    const purchaseData = {
      payment_phase: 'pre_booking',
      user_id: userId,
      book_id: book.id,
      quantity,
      unit_price: BOOK_FULL_PRICE,
      total_price: BOOK_FULL_PRICE * quantity,
      pre_booking_amount: chargeAmount,
      balance_amount: BOOK_BALANCE_AMOUNT * quantity,
      address: deliveryAddress.address,
      city: deliveryAddress.city,
      state: deliveryAddress.state,
      postal_code: deliveryAddress.postal_code,
      country: deliveryAddress.country,
      phone_number: deliveryAddress.phone_number,
      notes: notes || null,
      pickup_clinic_id: clinic.id
    };

    const initMessage =
      'Pre-booking payment initialized (NPR 100). Complete payment to reserve your book. Pay the remaining NPR 900 when the book is available for clinic pickup.';

    if (payment_method === 'esewa') {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const successUrl = process.env.ESEWA_SUCCESS_URL || `${appUrl}/api/book-purchase/esewa/success`;
      const failureUrl = process.env.ESEWA_FAILURE_URL || `${appUrl}/api/book-purchase/esewa/failure`;
      const transactionUuid = String(orderId).replace(/[^a-zA-Z0-9-]/g, '-');
      const signedFieldNames = 'total_amount,transaction_uuid,product_code';

      const esewaPayload = {
        amount: String(chargeAmount),
        tax_amount: '0',
        total_amount: String(chargeAmount),
        transaction_uuid: transactionUuid,
        product_code: esewaGateway.productCode,
        product_service_charge: '0',
        product_delivery_charge: '0',
        success_url: successUrl,
        failure_url: failureUrl,
        signed_field_names: signedFieldNames
      };

      const { signature, message } = esewaGateway.signatureFromFields(esewaPayload, signedFieldNames);
      esewaPayload.signature = signature;

      await Payment.create({
        order_id: transactionUuid,
        amount: chargeAmount,
        process_id: null,
        status: 'INITIATED',
        gateway_response: JSON.stringify({
          gateway: 'ESEWA',
          signature_message: message,
          payment_request: esewaPayload,
          purchase_data: purchaseData
        })
      });

      return buildPaymentInitResponse({
        res,
        paymentMethod: payment_method,
        paymentMethodDebug,
        orderId: transactionUuid,
        amount: chargeAmount,
        esewaPayload,
        book,
        pickupClinicPayload,
        message: initMessage,
        payment_phase: 'pre_booking'
      });
    }

    try {
      const paymentResponse = await paymentGateway.createPayment(String(chargeAmount), orderId);
      if (!paymentResponse.code || paymentResponse.code !== '0') {
        return res.status(400).json({
          success: false,
          message: 'Payment initialization failed',
          error: paymentResponse.message || 'Unable to initialize payment'
        });
      }

      const processId = paymentResponse.data?.ProcessId || null;
      await Payment.create({
        order_id: orderId,
        amount: chargeAmount,
        process_id: processId,
        status: 'INITIATED',
        gateway_response: JSON.stringify({
          gateway: 'NEPALPAYMENT',
          payment_response: paymentResponse,
          purchase_data: purchaseData
        })
      });

      return buildPaymentInitResponse({
        res,
        paymentMethod: payment_method,
        paymentMethodDebug,
        orderId,
        amount: chargeAmount,
        processId,
        book,
        pickupClinicPayload,
        message: initMessage,
        payment_phase: 'pre_booking'
      });
    } catch (paymentError) {
      console.error('Payment creation error:', paymentError);
      return res.status(500).json({
        success: false,
        message: 'Error initializing pre-booking payment',
        error: paymentError.response?.data || paymentError.message
      });
    }
  } catch (error) {
    console.error('Purchase book error:', error);
    res.status(500).json({
      success: false,
      message: 'Error purchasing book',
      error: error.message
    });
  }
};

/**
 * Pay remaining balance (NPR 900) for a pre-booked order when the book is available.
 */
const payBookBalance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const purchaseId = parseInt(req.params.id, 10);
    const payment_method = normalizePaymentMethod(req.body);
    const paymentMethodDebug = resolvePaymentMethodDebug(req.body);

    const purchase = await PurchaseBook.findOne({
      where: { id: purchaseId, user_id: userId },
      include: [{ model: Book, as: 'book' }]
    });

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!canPayBalanceForPurchase(purchase, purchase.book)) {
      const bookReady = Boolean(purchase.book?.balance_payment_enabled);
      return res.status(400).json({
        success: false,
        message: bookReady
          ? 'This order is not eligible for balance payment.'
          : 'Balance payment is not open yet. The book is not available for pickup payment (typically 2–3 months after pre-booking).',
        data: {
          order_id: purchase.tracking_number,
          status: purchase.status,
          balance_due: Number(purchase.balance_due),
          balance_payment_available: bookReady
        }
      });
    }

    const quantity = purchase.quantity || 1;
    const chargeAmount = Number(purchase.balance_due) || BOOK_BALANCE_AMOUNT * quantity;
    const orderId = await generateBalanceOrderId();

    const purchaseData = {
      payment_phase: 'balance',
      purchase_id: purchase.id,
      user_id: userId,
      book_id: purchase.book_id,
      quantity,
      balance_amount: chargeAmount
    };

    const initMessage =
      'Balance payment initialized (NPR 900). Complete payment to confirm clinic pickup when your book is ready.';

    if (payment_method === 'esewa') {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const successUrl = process.env.ESEWA_SUCCESS_URL || `${appUrl}/api/book-purchase/esewa/success`;
      const failureUrl = process.env.ESEWA_FAILURE_URL || `${appUrl}/api/book-purchase/esewa/failure`;
      const transactionUuid = String(orderId).replace(/[^a-zA-Z0-9-]/g, '-');
      const signedFieldNames = 'total_amount,transaction_uuid,product_code';

      const esewaPayload = {
        amount: String(chargeAmount),
        tax_amount: '0',
        total_amount: String(chargeAmount),
        transaction_uuid: transactionUuid,
        product_code: esewaGateway.productCode,
        product_service_charge: '0',
        product_delivery_charge: '0',
        success_url: successUrl,
        failure_url: failureUrl,
        signed_field_names: signedFieldNames
      };

      const { signature, message } = esewaGateway.signatureFromFields(esewaPayload, signedFieldNames);
      esewaPayload.signature = signature;

      await Payment.create({
        order_id: transactionUuid,
        amount: chargeAmount,
        process_id: null,
        status: 'INITIATED',
        gateway_response: JSON.stringify({
          gateway: 'ESEWA',
          signature_message: message,
          payment_request: esewaPayload,
          purchase_data: purchaseData
        })
      });

      return buildPaymentInitResponse({
        res,
        paymentMethod: payment_method,
        paymentMethodDebug,
        orderId: transactionUuid,
        amount: chargeAmount,
        esewaPayload,
        book: purchase.book,
        pickupClinicPayload: purchase.pickup_clinic_id
          ? clinicToPublicDTO(
              await PickupClinic.findByPk(purchase.pickup_clinic_id, {
                attributes: CLINIC_CARD_ATTRIBUTES
              })
            )
          : null,
        message: initMessage,
        payment_phase: 'balance'
      });
    }

    const paymentResponse = await paymentGateway.createPayment(String(chargeAmount), orderId);
    if (!paymentResponse.code || paymentResponse.code !== '0') {
      return res.status(400).json({
        success: false,
        message: 'Balance payment initialization failed',
        error: paymentResponse.message || 'Unable to initialize payment'
      });
    }

    const processId = paymentResponse.data?.ProcessId || null;
    await Payment.create({
      order_id: orderId,
      amount: chargeAmount,
      process_id: processId,
      status: 'INITIATED',
      gateway_response: JSON.stringify({
        gateway: 'NEPALPAYMENT',
        payment_response: paymentResponse,
        purchase_data: purchaseData
      })
    });

    const clinic =
      purchase.pickup_clinic_id &&
      (await PickupClinic.findByPk(purchase.pickup_clinic_id, {
        attributes: CLINIC_CARD_ATTRIBUTES
      }));

    return buildPaymentInitResponse({
      res,
      paymentMethod: payment_method,
      paymentMethodDebug,
      orderId,
      amount: chargeAmount,
      processId,
      book: purchase.book,
      pickupClinicPayload: clinic ? clinicToPublicDTO(clinic) : null,
      message: initMessage,
      payment_phase: 'balance'
    });
  } catch (error) {
    console.error('Pay book balance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error initializing balance payment',
      error: error.message
    });
  }
};

/**
 * Admin: enable balance payment on a book when stock is ready for pickup.
 */
const setBookBalancePaymentEnabled = async (req, res) => {
  try {
    const bookId = parseInt(req.params.id, 10);
    const enabled =
      req.body.balance_payment_enabled !== undefined
        ? Boolean(req.body.balance_payment_enabled)
        : true;

    const book = await Book.findByPk(bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    await book.update({ balance_payment_enabled: enabled });

    if (enabled) {
      await PurchaseBook.update(
        { status: 'awaiting_balance' },
        { where: { book_id: book.id, status: 'pre_booked' } }
      );
    }

    return res.json({
      success: true,
      message: enabled
        ? 'Balance payment enabled. Pre-booked customers can now pay NPR 900 and pick up from clinic.'
        : 'Balance payment disabled for this book.',
      data: {
        id: book.id,
        title: book.title,
        balance_payment_enabled: book.balance_payment_enabled,
        pricing: BOOK_PRICING_SUMMARY
      }
    });
  } catch (error) {
    console.error('Set book balance payment enabled error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating book balance payment setting',
      error: error.message
    });
  }
};

/**
 * Get logged-in user's book orders (My Orders screen)
 */
const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status, pickup_tracking_status } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const whereClause = { user_id: userId };

    if (status) {
      whereClause.status = status;
    }
    if (pickup_tracking_status) {
      whereClause.pickup_tracking_status = pickup_tracking_status;
    }

    const { count, rows: purchases } = await PurchaseBook.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Book,
          as: 'book',
          attributes: ['id', 'title', 'author', 'price', 'image_url', 'currency']
        },
        {
          model: PickupClinic,
          as: 'pickup_clinic',
          attributes: CLINIC_CARD_ATTRIBUTES
        },
        {
          model: Payment,
          as: 'payment',
          attributes: ['id', 'order_id', 'status', 'amount']
        },
        {
          model: Payment,
          as: 'balance_payment',
          attributes: ['id', 'order_id', 'status', 'amount']
        }
      ],
      order: [['purchase_date', 'DESC']],
      limit: parseInt(limit, 10),
      offset
    });

    res.json({
      success: true,
      message: 'My orders retrieved successfully',
      data: {
        orders: purchases.map((p) => formatMyOrderDTO(p)),
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(count / parseInt(limit, 10))
        }
      }
    });
  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving my orders',
      error: error.message
    });
  }
};

/**
 * Get purchase history for the authenticated user
 */
const getPurchaseHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status, pickup_tracking_status } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = { user_id: userId };

    if (status) {
      whereClause.status = status;
    }
    if (pickup_tracking_status) {
      whereClause.pickup_tracking_status = pickup_tracking_status;
    }

    const { count, rows: purchases } = await PurchaseBook.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Book,
          as: 'book',
          attributes: ['id', 'title', 'author', 'price', 'image_url']
        },
        {
          model: PickupClinic,
          as: 'pickup_clinic',
          attributes: CLINIC_CARD_ATTRIBUTES
        }
      ],
      order: [['purchase_date', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      success: true,
      message: 'Purchase history retrieved successfully',
      data: {
        purchases: purchases.map((p) => withPickupLabels(p)),
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get purchase history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving purchase history',
      error: error.message
    });
  }
};

/**
 * Get a single purchase by ID
 */
const getPurchaseById = async (req, res) => {
  try {
    const userId = req.user.id;
    const purchaseId = req.params.id;

    const purchase = await PurchaseBook.findOne({
      where: { id: purchaseId, user_id: userId },
      include: [
        {
          model: Book,
          as: 'book',
          attributes: [
            'id',
            'title',
            'author',
            'price',
            'image_url',
            'description',
            'balance_payment_enabled'
          ]
        },
        {
          model: PickupClinic,
          as: 'pickup_clinic',
          attributes: CLINIC_CARD_ATTRIBUTES
        },
        { model: Payment, as: 'payment', attributes: ['id', 'order_id', 'status', 'amount'] },
        { model: Payment, as: 'balance_payment', attributes: ['id', 'order_id', 'status', 'amount'] }
      ]
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    res.json({
      success: true,
      message: 'Purchase retrieved successfully',
      data: formatMyOrderDTO(purchase)
    });
  } catch (error) {
    console.error('Get purchase by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving purchase',
      error: error.message
    });
  }
};

/**
 * Payment callback/webhook handler
 * Called by payment gateway after payment completion
 */
const paymentCallback = async (req, res) => {
  try {
    const { MerchantTxnId } = req.body;

    if (!MerchantTxnId) {
      return res.status(400).json({
        success: false,
        message: 'MerchantTxnId is required'
      });
    }

    console.log('Payment callback received for order:', MerchantTxnId);

    // Check transaction status from gateway
    const status = await paymentGateway.checkTransactionFromGateway(MerchantTxnId);

    // Find payment record
    const payment = await Payment.findOne({
      where: { order_id: MerchantTxnId }
    });

    if (!payment) {
      console.error('Payment record not found for order:', MerchantTxnId);
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    // Update payment status
    const paymentStatus = status.Status || 'UNKNOWN';
    
    // Parse existing gateway_response to preserve purchase_data
    let gatewayResponseData = {};
    try {
      if (payment.gateway_response) {
        gatewayResponseData = JSON.parse(payment.gateway_response);
      }
    } catch (e) {
      console.error('Error parsing gateway_response:', e);
    }

    await payment.update({
      status: paymentStatus,
      gateway_response: JSON.stringify({
        gateway: gatewayResponseData.gateway || 'NEPALPAYMENT',
        payment_response: status,
        purchase_data: gatewayResponseData.purchase_data || null
      }),
      updated_at: new Date()
    });

    if (paymentStatus === 'SUCCESS') {
      try {
        await fulfillBookPayment(payment, { trackingNumber: MerchantTxnId });
        console.log('Book payment fulfilled for order:', MerchantTxnId);
      } catch (fulfillError) {
        console.error('Fulfill book payment error:', fulfillError.message);
      }
    } else if (paymentStatus === 'FAILED') {
      console.log('Payment failed for order:', MerchantTxnId);
    }

    // Return success response to gateway
    return res.status(200).send('received');
  } catch (error) {
    console.error('Payment callback error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing payment callback',
      error: error.message
    });
  }
};

/**
 * eSewa success redirect handler (GET)
 * eSewa sends a base64-encoded response payload (commonly as `data` query param).
 * We verify signature, optionally verify status from eSewa, then create purchase.
 */
const esewaSuccessCallback = async (req, res) => {
  try {
    const encoded = req.query.data || req.query.response || req.query.payload;
    if (!encoded) {
      return res.status(400).json({ success: false, message: 'Missing eSewa response payload' });
    }

    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(String(encoded), 'base64').toString('utf-8'));
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid eSewa payload encoding' });
    }

    const {
      status,
      signature,
      transaction_uuid,
      total_amount,
      product_code,
      signed_field_names
    } = decoded || {};

    if (!transaction_uuid) {
      return res.status(400).json({ success: false, message: 'transaction_uuid missing in eSewa payload' });
    }

    const payment = await Payment.findOne({ where: { order_id: transaction_uuid } });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    // Verify response signature integrity (best-effort)
    let signatureValid = false;
    if (signature && signed_field_names) {
      const { signature: expectedSig } = esewaGateway.signatureFromFields(decoded, signed_field_names);
      signatureValid = expectedSig === signature;
    }

    // Verify status from eSewa status API (authoritative)
    let statusApiResult = null;
    try {
      statusApiResult = await esewaGateway.checkStatus({
        transaction_uuid,
        total_amount,
        product_code: product_code || esewaGateway.productCode
      });
    } catch (e) {
      statusApiResult = { error: e.response?.data || e.message };
    }

    const finalStatus = statusApiResult?.status || status || 'UNKNOWN';
    const paymentStatus = finalStatus === 'COMPLETE' ? 'SUCCESS' : finalStatus;

    // Preserve purchase_data stored at initialization
    let gatewayResponseData = {};
    try {
      if (payment.gateway_response) gatewayResponseData = JSON.parse(payment.gateway_response);
    } catch (e) {}

    await payment.update({
      status: paymentStatus,
      gateway_response: JSON.stringify({
        gateway: 'ESEWA',
        response_payload: decoded,
        signature_valid: signatureValid,
        status_api: statusApiResult,
        purchase_data: gatewayResponseData.purchase_data || null
      }),
      updated_at: new Date()
    });

    if (finalStatus !== 'COMPLETE') {
      return res.status(200).json({
        success: false,
        message: 'eSewa payment not complete',
        data: { status: finalStatus, order_id: transaction_uuid, signature_valid: signatureValid }
      });
    }

    let purchase;
    try {
      purchase = await fulfillBookPayment(payment, { trackingNumber: transaction_uuid });
    } catch (fulfillError) {
      return res.status(400).json({
        success: false,
        message: fulfillError.message || 'Could not confirm payment',
        data: { order_id: transaction_uuid }
      });
    }

    const purchasePhase = gatewayResponseData.purchase_data?.payment_phase || 'pre_booking';
    const successMessage =
      purchasePhase === 'balance'
        ? 'Balance payment complete. Your order is confirmed for clinic pickup.'
        : 'Pre-booking payment complete. Pay the remaining NPR 900 when the book is available for pickup.';

    return res.status(200).json({
      success: true,
      message: successMessage,
      data: {
        order_id: transaction_uuid,
        payment_phase: purchasePhase,
        purchase: withPickupLabels(
          await PurchaseBook.findByPk(purchase.id, {
            include: [
              {
                model: Book,
                as: 'book',
                attributes: ['id', 'title', 'author', 'price', 'image_url', 'balance_payment_enabled']
              },
              {
                model: PickupClinic,
                as: 'pickup_clinic',
                attributes: CLINIC_CARD_ATTRIBUTES
              },
              { model: Payment, as: 'payment', attributes: ['id', 'order_id', 'status', 'amount'] },
              { model: Payment, as: 'balance_payment', attributes: ['id', 'order_id', 'status', 'amount'] }
            ]
          })
        )
      }
    });
  } catch (error) {
    console.error('eSewa success callback error:', error);
    return res.status(500).json({ success: false, message: 'Error processing eSewa success callback', error: error.message });
  }
};

/**
 * eSewa failure redirect handler (GET)
 */
const esewaFailureCallback = async (req, res) => {
  try {
    const encoded = req.query.data || req.query.response || req.query.payload;
    let decoded = null;
    if (encoded) {
      try {
        decoded = JSON.parse(Buffer.from(String(encoded), 'base64').toString('utf-8'));
      } catch (e) {
        decoded = null;
      }
    }

    const transaction_uuid = decoded?.transaction_uuid || req.query.transaction_uuid;
    if (transaction_uuid) {
      const payment = await Payment.findOne({ where: { order_id: transaction_uuid } });
      if (payment) {
        let gatewayResponseData = {};
        try {
          if (payment.gateway_response) gatewayResponseData = JSON.parse(payment.gateway_response);
        } catch (e) {}

        await payment.update({
          status: 'FAILED',
          gateway_response: JSON.stringify({
            gateway: 'ESEWA',
            response_payload: decoded,
            purchase_data: gatewayResponseData.purchase_data || null
          }),
          updated_at: new Date()
        });
      }
    }

    return res.status(200).json({
      success: false,
      message: 'eSewa payment failed/cancelled',
      data: { order_id: transaction_uuid || null, payload: decoded }
    });
  } catch (error) {
    console.error('eSewa failure callback error:', error);
    return res.status(500).json({ success: false, message: 'Error processing eSewa failure callback', error: error.message });
  }
};

/**
 * Check payment status for a purchase
 */
const checkPaymentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { order_id, purchase_id } = req.body;

    if (!order_id && !purchase_id) {
      return res.status(400).json({
        success: false,
        message: 'Either order_id or purchase_id is required'
      });
    }

    let orderId;
    let purchase = null;

    // If purchase_id is provided, find purchase first
    if (purchase_id) {
      purchase = await PurchaseBook.findOne({
        where: { id: purchase_id, user_id: userId }
      });
      if (purchase) {
        orderId = purchase.tracking_number;
      } else {
        return res.status(404).json({
          success: false,
          message: 'Purchase not found'
        });
      }
    } else {
      // If order_id is provided, check if purchase exists
      orderId = order_id;
      purchase = await PurchaseBook.findOne({
        where: { tracking_number: orderId, user_id: userId }
      });
    }

    // Find payment record
    const payment = await Payment.findOne({
      where: { order_id: orderId }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    // Check status from gateway
    const status = await paymentGateway.checkTransactionFromGateway(orderId);
    const paymentStatus = status.Status || payment.status;

    // Parse existing gateway_response to preserve purchase_data
    let gatewayResponseData = {};
    try {
      if (payment.gateway_response) {
        gatewayResponseData = JSON.parse(payment.gateway_response);
      }
    } catch (e) {
      console.error('Error parsing gateway_response:', e);
    }

    // Update payment record
    await payment.update({
      status: paymentStatus,
      gateway_response: JSON.stringify({
        payment_response: status,
        purchase_data: gatewayResponseData.purchase_data || null
      }),
      updated_at: new Date()
    });

    const purchaseData = gatewayResponseData.purchase_data;
    const isBalancePayment = purchaseData?.payment_phase === 'balance';

    if (paymentStatus === 'SUCCESS') {
      if (isBalancePayment && purchaseData?.purchase_id) {
        if (purchaseData.user_id === userId) {
          try {
            purchase = await fulfillBookPayment(payment);
          } catch (e) {
            console.error('Balance fulfill error:', e.message);
          }
        }
      } else if (!purchase && purchaseData?.user_id === userId) {
        try {
          purchase = await fulfillBookPayment(payment, { trackingNumber: orderId });
        } catch (e) {
          console.error('Pre-booking fulfill error:', e.message);
        }
      }
    } else if (isBalancePayment && purchaseData?.purchase_id && !purchase) {
      purchase = await PurchaseBook.findOne({
        where: { id: purchaseData.purchase_id, user_id: userId }
      });
    }

    // Fetch purchase with book details if it exists
    let purchaseWithDetails = null;
    if (purchase) {
      purchaseWithDetails = await PurchaseBook.findByPk(purchase.id, {
        include: [
          {
            model: Book,
            as: 'book',
            attributes: ['id', 'title', 'author', 'price', 'image_url']
          },
          {
            model: PickupClinic,
            as: 'pickup_clinic',
            attributes: CLINIC_CARD_ATTRIBUTES
          }
        ]
      });
    }

    const purchasePlain = purchaseWithDetails ? purchaseWithDetails.get({ plain: true }) : null;

    res.json({
      success: true,
      message: 'Payment status retrieved successfully',
      data: {
        purchase: purchaseWithDetails ? withPickupLabels(purchaseWithDetails) : null,
        payment_status: paymentStatus,
        payment_details: status,
        order_id: orderId,
        pickup_tracking_status: purchasePlain?.pickup_tracking_status ?? null,
        pickup_tracking_status_label: purchasePlain
          ? pickupTrackingStatusLabel(purchasePlain.pickup_tracking_status)
          : null
      }
    });
  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking payment status',
      error: error.message
    });
  }
};

const listNearestPickupClinics = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const lat = parseFloat(String(req.query.latitude));
    const lng = parseFloat(String(req.query.longitude));
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '5'), 10) || 5, 1), 20);

    const clinics = await PickupClinic.findAll({
      where: {
        is_active: true,
        latitude: { [Op.ne]: null },
        longitude: { [Op.ne]: null }
      },
      attributes: CLINIC_CARD_ATTRIBUTES
    });

    if (!clinics.length) {
      return res.json({
        success: true,
        message:
          'No clinics with coordinates on file; add latitude and longitude when creating clinics',
        data: {
          user_location: { latitude: lat, longitude: lng },
          clinics: []
        }
      });
    }

    const ranked = clinics
      .map((c) => {
        const plain = c.get({ plain: true });
        const cLat = Number(plain.latitude);
        const cLng = Number(plain.longitude);
        return {
          ...clinicToPublicDTO(c),
          distance_km: Math.round(distanceKm(lat, lng, cLat, cLng) * 100) / 100
        };
      })
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit);

    res.json({
      success: true,
      message: 'Nearest pickup clinics',
      data: {
        user_location: { latitude: lat, longitude: lng },
        clinics: ranked
      }
    });
  } catch (error) {
    console.error('List nearest pickup clinics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error finding nearest clinics',
      error: error.message
    });
  }
};

const listPickupClinics = async (req, res) => {
  try {
    const clinics = await PickupClinic.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']],
      attributes: CLINIC_CARD_ATTRIBUTES
    });
    res.json({
      success: true,
      message: 'Pickup clinics retrieved successfully',
      data: clinics.map((c) => clinicToPublicDTO(c))
    });
  } catch (error) {
    console.error('List pickup clinics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving pickup clinics',
      error: error.message
    });
  }
};

const createPickupClinic = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      name,
      address,
      phone,
      email,
      opening_hours,
      latitude,
      longitude,
      is_active = true
    } = req.body;

    const hasLat =
      latitude !== undefined && latitude !== null && String(latitude).trim() !== '';
    const hasLng =
      longitude !== undefined && longitude !== null && String(longitude).trim() !== '';
    const latVal = hasLat ? parseFloat(String(latitude)) : null;
    const lngVal = hasLng ? parseFloat(String(longitude)) : null;

    const clinic = await PickupClinic.create({
      name: String(name).trim(),
      address: String(address).trim(),
      phone: phone != null && String(phone).trim() !== '' ? String(phone).trim() : null,
      email: email != null && String(email).trim() !== '' ? String(email).trim() : null,
      opening_hours:
        opening_hours != null && String(opening_hours).trim() !== ''
          ? String(opening_hours).trim()
          : null,
      latitude: hasLat && hasLng ? latVal : null,
      longitude: hasLat && hasLng ? lngVal : null,
      is_active: Boolean(is_active)
    });

    res.status(201).json({
      success: true,
      message: 'Pickup clinic created successfully',
      data: clinicToPublicDTO(clinic)
    });
  } catch (error) {
    console.error('Create pickup clinic error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating pickup clinic',
      error: error.message
    });
  }
};

const updatePurchasePickupStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const purchaseId = req.params.id;
    const { pickup_tracking_status } = req.body;

    const purchase = await PurchaseBook.findByPk(purchaseId);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    if (!['processing', 'completed'].includes(purchase.status)) {
      return res.status(400).json({
        success: false,
        message:
          'Pickup tracking can only be updated after the full balance is paid (order status must be processing or completed).'
      });
    }

    await purchase.update({ pickup_tracking_status });

    const updated = await PurchaseBook.findByPk(purchaseId, {
      include: [
        {
          model: PickupClinic,
          as: 'pickup_clinic',
          attributes: CLINIC_CARD_ATTRIBUTES
        },
        {
          model: Book,
          as: 'book',
          attributes: ['id', 'title', 'author', 'price', 'image_url']
        }
      ]
    });

    res.json({
      success: true,
      message: 'Pickup tracking status updated',
      data: withPickupLabels(updated)
    });
  } catch (error) {
    console.error('Update purchase pickup status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating pickup status',
      error: error.message
    });
  }
};

module.exports = {
  getBook,
  addBook,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  purchaseBook,
  payBookBalance,
  setBookBalancePaymentEnabled,
  getMyOrders,
  getPurchaseHistory,
  getPurchaseById,
  paymentCallback,
  esewaSuccessCallback,
  esewaFailureCallback,
  checkPaymentStatus,
  listPickupClinics,
  listNearestPickupClinics,
  createPickupClinic,
  updatePurchasePickupStatus
};
