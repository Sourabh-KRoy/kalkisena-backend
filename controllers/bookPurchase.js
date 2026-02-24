const { Book, PurchaseBook, UserAddress, User, Payment } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const axios = require('axios');
const crypto = require('crypto');

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
      data: book
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
 * Purchase book with payment gateway integration
 * Fixed price: 1000 rupees
 * If address_id is provided, use that address
 * Otherwise, use the address details from request body
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
    const { book_id, quantity = 1, address_id, address, city, state, postal_code, country, phone_number, notes } = req.body;
    console.log('Purchase book request:', req.body);

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

    if (book.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Only ${book.stock} available.`
      });
    }

    // Get delivery address
    let deliveryAddress = {
      address: null,
      city: null,
      state: null,
      postal_code: null,
      country: 'Nepal',
      phone_number: null
    };

    if (address_id) {
      // Use saved address
      const savedAddress = await UserAddress.findOne({
        where: { id: address_id, user_id: userId }
      });

      if (!savedAddress) {
        return res.status(404).json({
          success: false,
          message: 'Address not found'
        });
      }

      deliveryAddress = {
        address: savedAddress.address,
        city: savedAddress.city,
        state: savedAddress.state,
        postal_code: savedAddress.postal_code,
        country: savedAddress.country,
        phone_number: savedAddress.phone_number || req.user.phone
      };
    } else {
      // Use address from request body
      if (!address) {
        return res.status(400).json({
          success: false,
          message: 'Address is required'
        });
      }

      deliveryAddress = {
        address,
        city,
        state,
        postal_code,
        country: country || 'Nepal',
        phone_number: phone_number || req.user.phone
      };
    }

    // Fixed price: 1000 rupees
    const FIXED_PRICE = 1000;
    const unitPrice = FIXED_PRICE;
    const totalPrice = FIXED_PRICE * quantity;

    // Generate order ID
    const orderId = await paymentGateway.generateOrderId();

    // Create payment record first
    let payment;
    let processId = null;
    
    try {
      const paymentResponse = await paymentGateway.createPayment(totalPrice.toString(), orderId);
      
      if (!paymentResponse.code || paymentResponse.code !== '0') {
        return res.status(400).json({
          success: false,
          message: 'Payment initialization failed',
          error: paymentResponse.message || 'Unable to initialize payment'
        });
      }

      processId = paymentResponse.data?.ProcessId || null;

      // Prepare purchase data to store in payment record (will be used to create purchase after payment success)
      const purchaseData = {
        user_id: userId,
        book_id: book.id,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        address: deliveryAddress.address,
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        postal_code: deliveryAddress.postal_code,
        country: deliveryAddress.country,
        phone_number: deliveryAddress.phone_number,
        notes: notes || null
      };

      // Save payment record with purchase data in gateway_response
      // Structure: { payment_response: {...}, purchase_data: {...} }
      payment = await Payment.create({
        order_id: orderId,
        amount: totalPrice,
        process_id: processId,
        status: 'INITIATED',
        gateway_response: JSON.stringify({
          payment_response: paymentResponse,
          purchase_data: purchaseData
        })
      });
    } catch (paymentError) {
      console.error('Payment creation error:', paymentError);
      return res.status(500).json({
        success: false,
        message: 'Error initializing payment',
        error: paymentError.response?.data || paymentError.message
      });
    }

    // Payment gateway URLs
    const paymentUrl = process.env.NEPAL_PAYMENT_GATEWAY_URL || 'https://gatewaysandbox.nepalpayment.com/Payment/Index';
    const responseUrl = process.env.NEPAL_PAYMENT_RESPONSE_URL || `${process.env.APP_URL || 'http://localhost:3000'}/api/book-purchase/payment-callback`;

    // Return payment URL and form data (NO purchase record created yet)
    res.status(200).json({
      success: true,
      message: 'Payment initialized. Please complete the payment. Purchase will be created after successful payment.',
      data: {
        order_id: orderId,
        amount: totalPrice,
        payment_url: paymentUrl,
        form_data: {
          MerchantId: paymentGateway.merchantId,
          MerchantName: paymentGateway.merchantName,
          Amount: totalPrice,
          MerchantTxnId: orderId,
          ProcessId: processId,
          ResponseUrl: responseUrl
        },
        book: {
          id: book.id,
          title: book.title,
          author: book.author,
          image_url: book.image_url
        }
      }
    });
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
 * Get purchase history for the authenticated user
 */
const getPurchaseHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = { user_id: userId };
    
    if (status) {
      whereClause.status = status;
    }

    const { count, rows: purchases } = await PurchaseBook.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Book,
          as: 'book',
          attributes: ['id', 'title', 'author', 'price', 'image_url']
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
        purchases,
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
          attributes: ['id', 'title', 'author', 'price', 'image_url', 'description']
        }
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
      data: purchase
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

    // Update payment record with new status and preserve purchase_data
    await payment.update({
      status: paymentStatus,
      gateway_response: JSON.stringify({
        payment_response: status,
        purchase_data: gatewayResponseData.purchase_data || null
      }),
      updated_at: new Date()
    });

    // Only create purchase record if payment is successful
    if (paymentStatus === 'SUCCESS') {
      // Check if purchase already exists (in case callback is called multiple times)
      let purchase = await PurchaseBook.findOne({
        where: { tracking_number: MerchantTxnId }
      });

      if (!purchase) {
        // Extract purchase data from payment record
        const purchaseData = gatewayResponseData.purchase_data;
        
        if (!purchaseData) {
          console.error('Purchase data not found in payment record for order:', MerchantTxnId);
          return res.status(400).json({
            success: false,
            message: 'Purchase data not found in payment record'
          });
        }

        // Verify book still exists and is available
        const book = await Book.findByPk(purchaseData.book_id);
        if (!book) {
          console.error('Book not found for purchase:', purchaseData.book_id);
          return res.status(404).json({
            success: false,
            message: 'Book not found'
          });
        }

        if (!book.is_active) {
          console.error('Book is not active:', purchaseData.book_id);
          return res.status(400).json({
            success: false,
            message: 'Book is not available for purchase'
          });
        }

        if (book.stock < purchaseData.quantity) {
          console.error('Insufficient stock for book:', purchaseData.book_id);
          return res.status(400).json({
            success: false,
            message: `Insufficient stock. Only ${book.stock} available.`
          });
        }

        // Create purchase record with processing status and link to payment
        purchase = await PurchaseBook.create({
          payment_id: payment.id,
          user_id: purchaseData.user_id,
          book_id: purchaseData.book_id,
          quantity: purchaseData.quantity,
          unit_price: purchaseData.unit_price,
          total_price: purchaseData.total_price,
          address: purchaseData.address,
          city: purchaseData.city,
          state: purchaseData.state,
          postal_code: purchaseData.postal_code,
          country: purchaseData.country,
          phone_number: purchaseData.phone_number,
          notes: purchaseData.notes,
          status: 'processing',
          tracking_number: MerchantTxnId
        });

        // Reduce book stock
        await book.update({
          stock: book.stock - purchaseData.quantity
        });

        console.log('Purchase created successfully after payment success for order:', MerchantTxnId);
      } else {
        console.log('Purchase already exists for order:', MerchantTxnId);
      }
    } else if (paymentStatus === 'FAILED') {
      console.log('Payment failed for order:', MerchantTxnId, '- No purchase record created');
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

    // If payment is successful and purchase doesn't exist yet, create it
    if (paymentStatus === 'SUCCESS' && !purchase) {
      const purchaseData = gatewayResponseData.purchase_data;
      
      if (purchaseData && purchaseData.user_id === userId) {
        // Verify book still exists and is available
        const book = await Book.findByPk(purchaseData.book_id);
        if (book && book.is_active && book.stock >= purchaseData.quantity) {
          // Create purchase record and link to payment
          purchase = await PurchaseBook.create({
            payment_id: payment.id,
            user_id: purchaseData.user_id,
            book_id: purchaseData.book_id,
            quantity: purchaseData.quantity,
            unit_price: purchaseData.unit_price,
            total_price: purchaseData.total_price,
            address: purchaseData.address,
            city: purchaseData.city,
            state: purchaseData.state,
            postal_code: purchaseData.postal_code,
            country: purchaseData.country,
            phone_number: purchaseData.phone_number,
            notes: purchaseData.notes,
            status: 'processing',
            tracking_number: orderId
          });

          // Reduce book stock
          await book.update({
            stock: book.stock - purchaseData.quantity
          });

          console.log('Purchase created after status check for order:', orderId);
        }
      }
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
          }
        ]
      });
    }

    res.json({
      success: true,
      message: 'Payment status retrieved successfully',
      data: {
        purchase: purchaseWithDetails,
        payment_status: paymentStatus,
        payment_details: status,
        order_id: orderId
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

module.exports = {
  getBook,
  addBook,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  purchaseBook,
  getPurchaseHistory,
  getPurchaseById,
  paymentCallback,
  checkPaymentStatus
};
