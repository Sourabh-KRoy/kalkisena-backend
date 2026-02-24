const { Payment } = require('../models');
const axios = require('axios');
const crypto = require('crypto');
const { Op } = require('sequelize');

class NepalPaymentController {
  constructor() {
    this.merchantId = process.env.NEPAL_PAYMENT_MERCHANT_ID || '7582';
    this.merchantName = process.env.NEPAL_PAYMENT_MERCHANT_NAME || 'WebStudioNepal';
    this.apiUsername = process.env.NEPAL_PAYMENT_API_USERNAME || 'WebStudioNepal';
    this.apiPassword = process.env.NEPAL_PAYMENT_API_PASSWORD || 'WebStudioNepal#876';
    this.secretKey = process.env.NEPAL_PAYMENT_SECRET_KEY || 'WebStudiol$KEY12';
    this.baseUrl = process.env.NEPAL_PAYMENT_BASE_URL || 'https://apisandbox.nepalpayment.com';
  }

  /**
   * Helper: Generate HMAC SHA512 signature
   */
  generateSignature(data) {
    // Sort keys alphabetically
    const sortedKeys = Object.keys(data).sort();
    const sortedData = {};
    sortedKeys.forEach(key => {
      sortedData[key] = data[key];
    });

    // Concatenate all values
    const value = Object.values(sortedData).join('');

    // Generate HMAC SHA512
    return crypto.createHmac('sha512', this.secretKey)
      .update(value)
      .digest('hex');
  }

  /**
   * Helper: Auth headers
   */
  authHeader() {
    const credentials = Buffer.from(`${this.apiUsername}:${this.apiPassword}`).toString('base64');
    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Generate unique order ID with sequence
   * Format: NP-{YYYYMMDD}-{SEQUENCE}-{RANDOM}
   * Example: NP-20250115-0001-A3B9
   */
  async generateOrderId() {
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD format
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4); // 4 character random string

    // Get the last order ID for today to generate sequence
    const lastOrder = await Payment.findOne({
      where: {
        order_id: {
          [Op.like]: `NP-${datePrefix}-%`
        }
      },
      order: [['id', 'DESC']]
    });

    let sequence;
    if (lastOrder && lastOrder.order_id) {
      const match = lastOrder.order_id.match(/NP-\d+-(\d+)-/);
      if (match) {
        sequence = String(parseInt(match[1]) + 1).padStart(4, '0');
      } else {
        sequence = '0001';
      }
    } else {
      sequence = '0001'; // First order of the day
    }

    let orderId = `NP-${datePrefix}-${sequence}-${randomSuffix}`;

    // Ensure uniqueness (in case of race condition)
    const exists = await Payment.findOne({ where: { order_id: orderId } });
    if (exists) {
      // If exists, regenerate with new random suffix
      const newRandomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
      orderId = `NP-${datePrefix}-${sequence}-${newRandomSuffix}`;
    }

    return orderId;
  }

  /**
   * 1. Get Payment Instruments
   */
  async getInstruments(req, res) {
    try {
      const payload = {
        MerchantId: this.merchantId,
        MerchantName: this.merchantName
      };

      payload.Signature = this.generateSignature(payload);

      const response = await axios.post(
        `${this.baseUrl}/GetPaymentInstrumentDetails`,
        payload,
        { headers: this.authHeader() }
      );

      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('Get instruments error:', error);
      return res.status(error.response?.status || 500).json({
        success: false,
        message: 'Error fetching payment instruments',
        error: error.response?.data || error.message
      });
    }
  }

  /**
   * 2. Get Service Charge
   */
  async getServiceCharge(req, res) {
    try {
      const { amount, instrument_code } = req.body;

      if (!amount || !instrument_code) {
        return res.status(400).json({
          success: false,
          message: 'Amount and instrument_code are required'
        });
      }

      const payload = {
        MerchantId: this.merchantId,
        MerchantName: this.merchantName,
        Amount: amount,
        InstrumentCode: instrument_code
      };

      payload.Signature = this.generateSignature(payload);

      const response = await axios.post(
        `${this.baseUrl}/GetServiceCharge`,
        payload,
        { headers: this.authHeader() }
      );

      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('Get service charge error:', error);
      return res.status(error.response?.status || 500).json({
        success: false,
        message: 'Error fetching service charge',
        error: error.response?.data || error.message
      });
    }
  }

  /**
   * 3. Create Payment (Get ProcessId)
   */
  async createPayment(req, res) {
    try {
      const { amount, order_id } = req.body;

      if (!amount) {
        return res.status(400).json({
          success: false,
          message: 'Amount is required'
        });
      }

      // Generate order ID if not provided, otherwise use the provided one
      const merchantTxnId = order_id || await this.generateOrderId();

      const payload = {
        MerchantId: this.merchantId,
        MerchantName: this.merchantName,
        Amount: amount,
        MerchantTxnId: merchantTxnId
      };

      payload.Signature = this.generateSignature(payload);

      const response = await axios.post(
        `${this.baseUrl}/GetProcessId`,
        payload,
        { headers: this.authHeader() }
      );

      const responseData = response.data;

      if (!responseData.code || responseData.code !== '0') {
        return res.status(400).json(responseData);
      }

      // Save transaction
      await Payment.create({
        order_id: merchantTxnId,
        amount: parseFloat(amount),
        process_id: responseData.data?.ProcessId || null,
        status: 'INITIATED',
        gateway_response: JSON.stringify(responseData)
      });

      const paymentUrl = process.env.NEPAL_PAYMENT_GATEWAY_URL || 'https://gatewaysandbox.nepalpayment.com/Payment/Index';
      const responseUrl = process.env.NEPAL_PAYMENT_RESPONSE_URL || 'https://yourdomain.com/payment-response';

      return res.json({
        payment_url: paymentUrl,
        form_data: {
          MerchantId: this.merchantId,
          MerchantName: this.merchantName,
          Amount: amount,
          MerchantTxnId: merchantTxnId,
          ProcessId: responseData.data?.ProcessId || null,
          ResponseUrl: responseUrl
        }
      });
    } catch (error) {
      console.error('Create payment error:', error);
      return res.status(error.response?.status || 500).json({
        success: false,
        message: 'Error creating payment',
        error: error.response?.data || error.message
      });
    }
  }

  /**
   * 4. Webhook (Notification URL)
   */
  async webhook(req, res) {
    try {
      const { MerchantTxnId } = req.body;

      if (!MerchantTxnId) {
        return res.status(400).json({
          success: false,
          message: 'MerchantTxnId is required'
        });
      }

      const status = await this.checkTransactionFromGateway(MerchantTxnId);

      if (status && Object.keys(status).length > 0) {
        await Payment.update(
          {
            status: status.Status || 'UNKNOWN',
            gateway_response: JSON.stringify(status),
            updated_at: new Date()
          },
          {
            where: { order_id: MerchantTxnId }
          }
        );
      }

      return res.status(200).send('received');
    } catch (error) {
      console.error('Webhook error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error processing webhook',
        error: error.message
      });
    }
  }

  /**
   * 5. Check Transaction Status
   */
  async checkStatus(req, res) {
    try {
      const { order_id } = req.body;

      if (!order_id) {
        return res.status(400).json({
          success: false,
          message: 'order_id is required'
        });
      }

      const status = await this.checkTransactionFromGateway(order_id);

      return res.json(status);
    } catch (error) {
      console.error('Check status error:', error);
      return res.status(error.response?.status || 500).json({
        success: false,
        message: 'Error checking transaction status',
        error: error.response?.data || error.message
      });
    }
  }

  /**
   * Helper: Call gateway to check transaction
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

// Export instance methods
const controller = new NepalPaymentController();

module.exports = {
  getInstruments: (req, res) => controller.getInstruments(req, res),
  getServiceCharge: (req, res) => controller.getServiceCharge(req, res),
  createPayment: (req, res) => controller.createPayment(req, res),
  webhook: (req, res) => controller.webhook(req, res),
  checkStatus: (req, res) => controller.checkStatus(req, res)
};
