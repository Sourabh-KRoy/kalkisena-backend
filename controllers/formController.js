const { JoinKalkisenaClinic, FreeCoachingRegistration, HostelRegistration, DonateAbolishDowry, DonateDoctors, User, Payment } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const axios = require('axios');
const crypto = require('crypto');

/**
 * Fixed Kalki Sena membership fee (NPR)
 */
const KALKI_SENA_MEMBERSHIP_FEE = parseFloat(process.env.KALKI_SENA_MEMBERSHIP_FEE || '101');

/**
 * eSewa ePay v2 helper (UAT/Test)
 * Docs: https://developer.esewa.com.np/pages/Epay-V2
 *
 * Mirrors the EsewaGateway used in controllers/bookPurchase.js
 * so behavior is consistent across the backend.
 */
class EsewaGateway {
  constructor() {
    this.productCode = process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST';
    this.secretKey = process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q';
    this.formUrl = process.env.ESEWA_FORM_URL || 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
    this.statusBaseUrl = process.env.ESEWA_STATUS_URL_BASE || 'https://uat.esewa.com.np/api/epay/transaction/status/';
  }

  sign(message) {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(message)
      .digest('base64');
  }

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

/**
 * Generate unique order ID for Kalki Sena membership payment.
 * Format: KM-{YYYYMMDD}-{SEQUENCE}-{RANDOM}
 */
const generateMembershipOrderId = async () => {
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);

  const lastOrder = await Payment.findOne({
    where: {
      order_id: {
        [Op.like]: `KM-${datePrefix}-%`
      }
    },
    order: [['id', 'DESC']]
  });

  let sequence;
  if (lastOrder && lastOrder.order_id) {
    const match = lastOrder.order_id.match(/KM-\d+-(\d+)-/);
    sequence = match ? String(parseInt(match[1]) + 1).padStart(4, '0') : '0001';
  } else {
    sequence = '0001';
  }

  let orderId = `KM-${datePrefix}-${sequence}-${randomSuffix}`;

  const exists = await Payment.findOne({ where: { order_id: orderId } });
  if (exists) {
    const newRandomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
    orderId = `KM-${datePrefix}-${sequence}-${newRandomSuffix}`;
  }

  return orderId;
};

/**
 * Join Kalki Sena Clinic (Kalkiism Research Center membership)
 *
 * NOTE: This endpoint no longer creates the membership record directly.
 * It initializes an eSewa payment for the membership fee (100 NPR).
 * The membership record is created in `joinKalkiSenaEsewaSuccess`
 * after the payment is verified as COMPLETE.
 */
const joinKalkiSena = async (req, res) => {
  console.log('[JOIN_KALKI_SENA] Incoming request body:', req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { user_id, full_name, mobile_number, family_members, email } = req.body;

    if (!user_id) {
      return res.status(422).json({
        success: false,
        message: 'Missing required fields',
        errors: [{ msg: 'User ID is required', param: 'user_id' }]
      });
    }

    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Donor fields are auto-derived from the user profile when the
    // frontend doesn't provide them (UI no longer collects them).
    const resolvedFullName =
      (full_name && String(full_name).trim()) ||
      user.name ||
      'Member';
    const resolvedMobileNumber =
      (mobile_number && String(mobile_number).trim()) ||
      user.phone ||
      '';
    const resolvedEmail =
      (email && String(email).trim()) ||
      user.email ||
      null;

    const formData = {
      user_id: parseInt(user_id),
      full_name: resolvedFullName.slice(0, 150),
      mobile_number: resolvedMobileNumber.slice(0, 20),
      family_members: family_members ? parseInt(family_members) : 0,
      email: resolvedEmail
    };

    const totalAmount = KALKI_SENA_MEMBERSHIP_FEE;
    const orderId = await generateMembershipOrderId();

    // eSewa requires transaction_uuid to be alphanumeric and hyphen(-) only.
    const transactionUuid = String(orderId).replace(/[^a-zA-Z0-9-]/g, '-');
    const signedFieldNames = 'total_amount,transaction_uuid,product_code';

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const successUrl =
      process.env.ESEWA_JOIN_KALKI_SENA_SUCCESS_URL ||
      `${appUrl}/api/form/join-kalki-sena/esewa/success`;
    const failureUrl =
      process.env.ESEWA_JOIN_KALKI_SENA_FAILURE_URL ||
      `${appUrl}/api/form/join-kalki-sena/esewa/failure`;

    const esewaPayload = {
      amount: String(totalAmount),
      tax_amount: '0',
      total_amount: String(totalAmount),
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

    const payment = await Payment.create({
      order_id: transactionUuid,
      amount: totalAmount,
      process_id: null,
      status: 'INITIATED',
      gateway_response: JSON.stringify({
        gateway: 'ESEWA',
        purpose: 'JOIN_KALKI_SENA',
        signature_message: message,
        payment_request: esewaPayload,
        form_data: formData
      })
    });

    console.log('[JOIN_KALKI_SENA] eSewa payment initialized:', {
      order_id: transactionUuid,
      payment_id: payment.id,
      amount: totalAmount
    });

    return res.status(200).json({
      success: true,
      message: 'eSewa payment initialized for Kalki Sena membership. Please complete the payment to confirm your registration.',
      data: {
        gateway: 'ESEWA',
        payment_method: 'esewa',
        purpose: 'JOIN_KALKI_SENA',
        order_id: transactionUuid,
        amount: totalAmount,
        currency: 'NPR',
        payment_url: esewaGateway.formUrl,
        form_data: esewaPayload,
        membership: {
          name: 'Kalkiism Research Center - Kalki Sena Membership',
          fee: totalAmount,
          currency: 'NPR'
        }
      }
    });
  } catch (error) {
    console.error('Join Kalki Sena error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error initializing Kalki Sena membership payment',
      error: error.message
    });
  }
};

/**
 * Helper: persist final state of a Kalki Sena membership payment and
 * create the JoinKalkisenaClinic record on success (idempotent).
 */
const finalizeJoinKalkiSenaPayment = async ({ payment, decoded, signatureValid, statusApiResult }) => {
  const finalStatus = statusApiResult?.status || decoded?.status || 'UNKNOWN';
  const paymentStatus = finalStatus === 'COMPLETE' ? 'SUCCESS' : finalStatus;

  let gatewayResponseData = {};
  try {
    if (payment.gateway_response) gatewayResponseData = JSON.parse(payment.gateway_response);
  } catch (e) {
    gatewayResponseData = {};
  }

  await payment.update({
    status: paymentStatus,
    gateway_response: JSON.stringify({
      gateway: 'ESEWA',
      purpose: 'JOIN_KALKI_SENA',
      response_payload: decoded,
      signature_valid: signatureValid,
      status_api: statusApiResult,
      form_data: gatewayResponseData.form_data || null
    }),
    updated_at: new Date()
  });

  if (finalStatus !== 'COMPLETE') {
    return { paymentStatus, membership: null, finalStatus };
  }

  // Create the membership record if not already created for this payment
  let membership = await JoinKalkisenaClinic.findOne({ where: { payment_id: payment.id } });
  if (!membership) {
    const formData = gatewayResponseData.form_data;
    if (!formData) {
      throw new Error('Form data not found in payment record');
    }

    const user = await User.findByPk(formData.user_id);
    if (!user) {
      throw new Error('User not found while finalizing Kalki Sena membership');
    }

    membership = await JoinKalkisenaClinic.create({
      user_id: formData.user_id,
      full_name: formData.full_name,
      mobile_number: formData.mobile_number,
      family_members: formData.family_members || 0,
      email: formData.email || null,
      payment_id: payment.id
    });

    console.log('[JOIN_KALKI_SENA] Membership record created after payment success:', {
      membership_id: membership.id,
      payment_id: payment.id
    });
  }

  return { paymentStatus, membership, finalStatus };
};

/**
 * eSewa success redirect handler for Kalki Sena membership (GET)
 */
const joinKalkiSenaEsewaSuccess = async (req, res) => {
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

    let signatureValid = false;
    if (signature && signed_field_names) {
      const { signature: expectedSig } = esewaGateway.signatureFromFields(decoded, signed_field_names);
      signatureValid = expectedSig === signature;
    }

    // Authoritative status verification with eSewa
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

    const { paymentStatus, membership, finalStatus } = await finalizeJoinKalkiSenaPayment({
      payment,
      decoded,
      signatureValid,
      statusApiResult
    });

    if (finalStatus !== 'COMPLETE') {
      return res.status(200).json({
        success: false,
        message: 'eSewa payment not complete for Kalki Sena membership',
        data: {
          status: finalStatus,
          payment_status: paymentStatus,
          order_id: transaction_uuid,
          signature_valid: signatureValid
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Joined Kalkiism Research Center - Kalki Sena successfully. Membership confirmed after eSewa payment.',
      data: {
        order_id: transaction_uuid,
        payment_id: payment.id,
        payment_status: paymentStatus,
        membership: membership ? membership.toJSON() : null
      }
    });
  } catch (error) {
    console.error('Join Kalki Sena eSewa success callback error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing eSewa success callback for Kalki Sena membership',
      error: error.message
    });
  }
};

/**
 * eSewa failure redirect handler for Kalki Sena membership (GET)
 */
const joinKalkiSenaEsewaFailure = async (req, res) => {
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
        } catch (e) {
          gatewayResponseData = {};
        }

        await payment.update({
          status: 'FAILED',
          gateway_response: JSON.stringify({
            gateway: 'ESEWA',
            purpose: 'JOIN_KALKI_SENA',
            response_payload: decoded,
            form_data: gatewayResponseData.form_data || null
          }),
          updated_at: new Date()
        });
      }
    }

    return res.status(200).json({
      success: false,
      message: 'eSewa payment failed/cancelled for Kalki Sena membership',
      data: { order_id: transaction_uuid || null, payload: decoded }
    });
  } catch (error) {
    console.error('Join Kalki Sena eSewa failure callback error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing eSewa failure callback for Kalki Sena membership',
      error: error.message
    });
  }
};

/**
 * Check Kalki Sena membership payment status by order_id.
 * Useful for the frontend to verify state if the redirect was missed.
 */
const checkJoinKalkiSenaPaymentStatus = async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'order_id is required'
      });
    }

    const payment = await Payment.findOne({ where: { order_id } });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    let gatewayResponseData = {};
    try {
      if (payment.gateway_response) gatewayResponseData = JSON.parse(payment.gateway_response);
    } catch (e) {
      gatewayResponseData = {};
    }

    // If still pending, ask eSewa for the authoritative status and finalize.
    if (payment.status === 'INITIATED' || payment.status === 'PENDING') {
      let statusApiResult = null;
      try {
        statusApiResult = await esewaGateway.checkStatus({
          transaction_uuid: payment.order_id,
          total_amount: payment.amount,
          product_code: esewaGateway.productCode
        });
      } catch (e) {
        statusApiResult = { error: e.response?.data || e.message };
      }

      const decoded = {
        status: statusApiResult?.status,
        transaction_uuid: payment.order_id,
        total_amount: payment.amount,
        product_code: esewaGateway.productCode
      };

      const { paymentStatus, membership } = await finalizeJoinKalkiSenaPayment({
        payment,
        decoded,
        signatureValid: false,
        statusApiResult
      });

      return res.status(200).json({
        success: paymentStatus === 'SUCCESS',
        message: `Kalki Sena membership payment status: ${paymentStatus}`,
        data: {
          order_id: payment.order_id,
          payment_id: payment.id,
          payment_status: paymentStatus,
          status_api: statusApiResult,
          membership: membership ? membership.toJSON() : null
        }
      });
    }

    // Already finalized; return current state and any linked membership.
    const membership = await JoinKalkisenaClinic.findOne({ where: { payment_id: payment.id } });
    return res.status(200).json({
      success: payment.status === 'SUCCESS',
      message: `Kalki Sena membership payment status: ${payment.status}`,
      data: {
        order_id: payment.order_id,
        payment_id: payment.id,
        payment_status: payment.status,
        form_data: gatewayResponseData.form_data || null,
        membership: membership ? membership.toJSON() : null
      }
    });
  } catch (error) {
    console.error('Check Kalki Sena payment status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking Kalki Sena membership payment status',
      error: error.message
    });
  }
};

/**
 * Generate unique order ID for "Donate to Abolish Dowry" payment.
 * Format: AD-{YYYYMMDD}-{SEQUENCE}-{RANDOM}
 */
const generateAbolishDowryOrderId = async () => {
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);

  const lastOrder = await Payment.findOne({
    where: {
      order_id: {
        [Op.like]: `AD-${datePrefix}-%`
      }
    },
    order: [['id', 'DESC']]
  });

  let sequence;
  if (lastOrder && lastOrder.order_id) {
    const match = lastOrder.order_id.match(/AD-\d+-(\d+)-/);
    sequence = match ? String(parseInt(match[1]) + 1).padStart(4, '0') : '0001';
  } else {
    sequence = '0001';
  }

  let orderId = `AD-${datePrefix}-${sequence}-${randomSuffix}`;

  const exists = await Payment.findOne({ where: { order_id: orderId } });
  if (exists) {
    const newRandomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
    orderId = `AD-${datePrefix}-${sequence}-${newRandomSuffix}`;
  }

  return orderId;
};

/**
 * Donate to Abolish Dowry Culture
 *
 * Initializes an eSewa payment for the donation. The donation record is
 * NOT created here; it is created in `donateAbolishDowrySuccess` once
 * eSewa confirms the payment is COMPLETE.
 *
 * Body:
 *   - amount (required, > 0)
 *   - user_id (optional)
 *   - donor_name (optional)
 *   - mobile_number (optional)
 *   - email (optional)
 *   - message (optional)
 */
const donateAbolishDowry = async (req, res) => {
  console.log('[DONATE_ABOLISH_DOWRY] Incoming request body:', req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { user_id, donor_name, mobile_number, email, message, amount } = req.body;

    const amountValue = Number(amount);
    if (!amountValue || isNaN(amountValue) || amountValue <= 0) {
      return res.status(422).json({
        success: false,
        message: 'Amount must be a positive number',
        errors: [{ msg: 'Amount must be a positive number', param: 'amount' }]
      });
    }

    if (user_id) {
      const user = await User.findByPk(user_id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
    }

    const formData = {
      user_id: user_id ? parseInt(user_id) : null,
      donor_name: donor_name ? String(donor_name).trim() : null,
      mobile_number: mobile_number ? String(mobile_number).trim() : null,
      email: email ? String(email).trim() : null,
      message: message ? String(message).trim() : null,
      amount: amountValue
    };

    const totalAmount = amountValue;
    const orderId = await generateAbolishDowryOrderId();

    // eSewa requires transaction_uuid to be alphanumeric and hyphen only.
    const transactionUuid = String(orderId).replace(/[^a-zA-Z0-9-]/g, '-');
    const signedFieldNames = 'total_amount,transaction_uuid,product_code';

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const successUrl =
      process.env.ESEWA_DONATE_ABOLISH_DOWRY_SUCCESS_URL ||
      `${appUrl}/api/form/donate-abolish-dowry/esewa/success`;
    const failureUrl =
      process.env.ESEWA_DONATE_ABOLISH_DOWRY_FAILURE_URL ||
      `${appUrl}/api/form/donate-abolish-dowry/esewa/failure`;

    const esewaPayload = {
      amount: String(totalAmount),
      tax_amount: '0',
      total_amount: String(totalAmount),
      transaction_uuid: transactionUuid,
      product_code: esewaGateway.productCode,
      product_service_charge: '0',
      product_delivery_charge: '0',
      success_url: successUrl,
      failure_url: failureUrl,
      signed_field_names: signedFieldNames
    };

    const { signature, message: signatureMessage } =
      esewaGateway.signatureFromFields(esewaPayload, signedFieldNames);
    esewaPayload.signature = signature;

    const payment = await Payment.create({
      order_id: transactionUuid,
      amount: totalAmount,
      process_id: null,
      status: 'INITIATED',
      gateway_response: JSON.stringify({
        gateway: 'ESEWA',
        purpose: 'DONATE_ABOLISH_DOWRY',
        signature_message: signatureMessage,
        payment_request: esewaPayload,
        form_data: formData
      })
    });

    console.log('[DONATE_ABOLISH_DOWRY] eSewa payment initialized:', {
      order_id: transactionUuid,
      payment_id: payment.id,
      amount: totalAmount
    });

    return res.status(200).json({
      success: true,
      message: 'eSewa payment initialized for Donate to Abolish Dowry. Please complete the payment to confirm your donation.',
      data: {
        gateway: 'ESEWA',
        payment_method: 'esewa',
        purpose: 'DONATE_ABOLISH_DOWRY',
        order_id: transactionUuid,
        amount: totalAmount,
        currency: 'NPR',
        payment_url: esewaGateway.formUrl,
        form_data: esewaPayload,
        receiver: {
          name: 'Kalkiism Research and Training Center',
          bank: 'Nabil Bank',
          branch: 'Kuleshwor',
          account_number: '03801017501357'
        }
      }
    });
  } catch (error) {
    console.error('Donate Abolish Dowry error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error initializing Donate Abolish Dowry payment',
      error: error.message
    });
  }
};

/**
 * Helper: finalize the donation payment and create the donation
 * record once eSewa confirms COMPLETE. Idempotent.
 */
const finalizeDonateAbolishDowryPayment = async ({ payment, decoded, signatureValid, statusApiResult }) => {
  const finalStatus = statusApiResult?.status || decoded?.status || 'UNKNOWN';
  const paymentStatus = finalStatus === 'COMPLETE' ? 'SUCCESS' : finalStatus;

  let gatewayResponseData = {};
  try {
    if (payment.gateway_response) gatewayResponseData = JSON.parse(payment.gateway_response);
  } catch (e) {
    gatewayResponseData = {};
  }

  await payment.update({
    status: paymentStatus,
    gateway_response: JSON.stringify({
      gateway: 'ESEWA',
      purpose: 'DONATE_ABOLISH_DOWRY',
      response_payload: decoded,
      signature_valid: signatureValid,
      status_api: statusApiResult,
      form_data: gatewayResponseData.form_data || null
    }),
    updated_at: new Date()
  });

  if (finalStatus !== 'COMPLETE') {
    return { paymentStatus, donation: null, finalStatus };
  }

  let donation = await DonateAbolishDowry.findOne({ where: { payment_id: payment.id } });
  if (!donation) {
    const formData = gatewayResponseData.form_data || {};
    donation = await DonateAbolishDowry.create({
      user_id: formData.user_id || null,
      donor_name: formData.donor_name || null,
      mobile_number: formData.mobile_number || null,
      email: formData.email || null,
      message: formData.message || null,
      amount: formData.amount || payment.amount,
      payment_id: payment.id
    });

    console.log('[DONATE_ABOLISH_DOWRY] Donation record created after payment success:', {
      donation_id: donation.id,
      payment_id: payment.id
    });
  }

  return { paymentStatus, donation, finalStatus };
};

/**
 * eSewa success redirect handler for Donate Abolish Dowry (GET)
 */
const donateAbolishDowryEsewaSuccess = async (req, res) => {
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

    let signatureValid = false;
    if (signature && signed_field_names) {
      const { signature: expectedSig } = esewaGateway.signatureFromFields(decoded, signed_field_names);
      signatureValid = expectedSig === signature;
    }

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

    const { paymentStatus, donation, finalStatus } = await finalizeDonateAbolishDowryPayment({
      payment,
      decoded,
      signatureValid,
      statusApiResult
    });

    if (finalStatus !== 'COMPLETE') {
      return res.status(200).json({
        success: false,
        message: 'eSewa payment not complete for Donate Abolish Dowry',
        data: {
          status: finalStatus,
          payment_status: paymentStatus,
          order_id: transaction_uuid,
          signature_valid: signatureValid
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Donation received successfully. Thank you for supporting the abolition of dowry culture.',
      data: {
        order_id: transaction_uuid,
        payment_id: payment.id,
        payment_status: paymentStatus,
        donation: donation ? donation.toJSON() : null
      }
    });
  } catch (error) {
    console.error('Donate Abolish Dowry eSewa success callback error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing eSewa success callback for Donate Abolish Dowry',
      error: error.message
    });
  }
};

/**
 * eSewa failure redirect handler for Donate Abolish Dowry (GET)
 */
const donateAbolishDowryEsewaFailure = async (req, res) => {
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
        } catch (e) {
          gatewayResponseData = {};
        }

        await payment.update({
          status: 'FAILED',
          gateway_response: JSON.stringify({
            gateway: 'ESEWA',
            purpose: 'DONATE_ABOLISH_DOWRY',
            response_payload: decoded,
            form_data: gatewayResponseData.form_data || null
          }),
          updated_at: new Date()
        });
      }
    }

    return res.status(200).json({
      success: false,
      message: 'eSewa payment failed/cancelled for Donate Abolish Dowry',
      data: { order_id: transaction_uuid || null, payload: decoded }
    });
  } catch (error) {
    console.error('Donate Abolish Dowry eSewa failure callback error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing eSewa failure callback for Donate Abolish Dowry',
      error: error.message
    });
  }
};

/**
 * Check Donate Abolish Dowry payment status by order_id.
 */
const checkDonateAbolishDowryPaymentStatus = async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'order_id is required'
      });
    }

    const payment = await Payment.findOne({ where: { order_id } });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    let gatewayResponseData = {};
    try {
      if (payment.gateway_response) gatewayResponseData = JSON.parse(payment.gateway_response);
    } catch (e) {
      gatewayResponseData = {};
    }

    if (payment.status === 'INITIATED' || payment.status === 'PENDING') {
      let statusApiResult = null;
      try {
        statusApiResult = await esewaGateway.checkStatus({
          transaction_uuid: payment.order_id,
          total_amount: payment.amount,
          product_code: esewaGateway.productCode
        });
      } catch (e) {
        statusApiResult = { error: e.response?.data || e.message };
      }

      const decoded = {
        status: statusApiResult?.status,
        transaction_uuid: payment.order_id,
        total_amount: payment.amount,
        product_code: esewaGateway.productCode
      };

      const { paymentStatus, donation } = await finalizeDonateAbolishDowryPayment({
        payment,
        decoded,
        signatureValid: false,
        statusApiResult
      });

      return res.status(200).json({
        success: paymentStatus === 'SUCCESS',
        message: `Donate Abolish Dowry payment status: ${paymentStatus}`,
        data: {
          order_id: payment.order_id,
          payment_id: payment.id,
          payment_status: paymentStatus,
          status_api: statusApiResult,
          donation: donation ? donation.toJSON() : null
        }
      });
    }

    const donation = await DonateAbolishDowry.findOne({ where: { payment_id: payment.id } });
    return res.status(200).json({
      success: payment.status === 'SUCCESS',
      message: `Donate Abolish Dowry payment status: ${payment.status}`,
      data: {
        order_id: payment.order_id,
        payment_id: payment.id,
        payment_status: payment.status,
        form_data: gatewayResponseData.form_data || null,
        donation: donation ? donation.toJSON() : null
      }
    });
  } catch (error) {
    console.error('Check Donate Abolish Dowry payment status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking Donate Abolish Dowry payment status',
      error: error.message
    });
  }
};

/**
 * Generate unique order ID for "Donate to Doctors" payment.
 * Format: DD-{YYYYMMDD}-{SEQUENCE}-{RANDOM}
 */
const generateDonateDoctorsOrderId = async () => {
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);

  const lastOrder = await Payment.findOne({
    where: {
      order_id: {
        [Op.like]: `DD-${datePrefix}-%`
      }
    },
    order: [['id', 'DESC']]
  });

  let sequence;
  if (lastOrder && lastOrder.order_id) {
    const match = lastOrder.order_id.match(/DD-\d+-(\d+)-/);
    sequence = match ? String(parseInt(match[1]) + 1).padStart(4, '0') : '0001';
  } else {
    sequence = '0001';
  }

  let orderId = `DD-${datePrefix}-${sequence}-${randomSuffix}`;

  const exists = await Payment.findOne({ where: { order_id: orderId } });
  if (exists) {
    const newRandomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
    orderId = `DD-${datePrefix}-${sequence}-${newRandomSuffix}`;
  }

  return orderId;
};

/**
 * Donate to Doctors (Kalkiism Free Clinic)
 *
 * Initializes an eSewa payment for the donation. The donation row is
 * created in the success callback once eSewa confirms COMPLETE.
 *
 * Body:
 *   - amount (required, > 0)
 *   - user_id (optional)
 *   - donor_name (optional)
 *   - mobile_number (optional)
 *   - email (optional)
 *   - message (optional)
 */
const donateDoctors = async (req, res) => {
  console.log('[DONATE_DOCTORS] Incoming request body:', req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { user_id, donor_name, mobile_number, email, message, amount } = req.body;

    const amountValue = Number(amount);
    if (!amountValue || isNaN(amountValue) || amountValue <= 0) {
      return res.status(422).json({
        success: false,
        message: 'Amount must be a positive number',
        errors: [{ msg: 'Amount must be a positive number', param: 'amount' }]
      });
    }

    let user = null;
    if (user_id) {
      user = await User.findByPk(user_id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
    }

    const resolvedDonorName =
      (donor_name && String(donor_name).trim()) ||
      (user && user.name) ||
      null;
    const resolvedMobile =
      (mobile_number && String(mobile_number).trim()) ||
      (user && user.phone) ||
      null;
    const resolvedEmail =
      (email && String(email).trim()) ||
      (user && user.email) ||
      null;

    const formData = {
      user_id: user_id ? parseInt(user_id) : null,
      donor_name: resolvedDonorName ? resolvedDonorName.slice(0, 150) : null,
      mobile_number: resolvedMobile ? resolvedMobile.slice(0, 20) : null,
      email: resolvedEmail ? resolvedEmail.slice(0, 150) : null,
      message: message ? String(message).trim().slice(0, 1000) : null,
      amount: amountValue
    };

    const totalAmount = amountValue;
    const orderId = await generateDonateDoctorsOrderId();

    // eSewa requires transaction_uuid to be alphanumeric and hyphen only.
    const transactionUuid = String(orderId).replace(/[^a-zA-Z0-9-]/g, '-');
    const signedFieldNames = 'total_amount,transaction_uuid,product_code';

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const successUrl =
      process.env.ESEWA_DONATE_DOCTORS_SUCCESS_URL ||
      `${appUrl}/api/form/donate-doctors/esewa/success`;
    const failureUrl =
      process.env.ESEWA_DONATE_DOCTORS_FAILURE_URL ||
      `${appUrl}/api/form/donate-doctors/esewa/failure`;

    const esewaPayload = {
      amount: String(totalAmount),
      tax_amount: '0',
      total_amount: String(totalAmount),
      transaction_uuid: transactionUuid,
      product_code: esewaGateway.productCode,
      product_service_charge: '0',
      product_delivery_charge: '0',
      success_url: successUrl,
      failure_url: failureUrl,
      signed_field_names: signedFieldNames
    };

    const { signature, message: signatureMessage } =
      esewaGateway.signatureFromFields(esewaPayload, signedFieldNames);
    esewaPayload.signature = signature;

    const payment = await Payment.create({
      order_id: transactionUuid,
      amount: totalAmount,
      process_id: null,
      status: 'INITIATED',
      gateway_response: JSON.stringify({
        gateway: 'ESEWA',
        purpose: 'DONATE_DOCTORS',
        signature_message: signatureMessage,
        payment_request: esewaPayload,
        form_data: formData
      })
    });

    console.log('[DONATE_DOCTORS] eSewa payment initialized:', {
      order_id: transactionUuid,
      payment_id: payment.id,
      amount: totalAmount
    });

    return res.status(200).json({
      success: true,
      message: 'eSewa payment initialized for Donate to Doctors. Please complete the payment to confirm your donation.',
      data: {
        gateway: 'ESEWA',
        payment_method: 'esewa',
        purpose: 'DONATE_DOCTORS',
        order_id: transactionUuid,
        amount: totalAmount,
        currency: 'NPR',
        payment_url: esewaGateway.formUrl,
        form_data: esewaPayload,
        receiver: {
          name: 'Kalkiism Research and Training Center',
          bank: 'Nabil Bank',
          branch: 'Kuleshwor',
          account_number: '03801017501357'
        }
      }
    });
  } catch (error) {
    console.error('Donate Doctors error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error initializing Donate to Doctors payment',
      error: error.message
    });
  }
};

/**
 * Helper: finalize the Donate Doctors payment and create the donation
 * row when eSewa confirms COMPLETE. Idempotent.
 */
const finalizeDonateDoctorsPayment = async ({ payment, decoded, signatureValid, statusApiResult }) => {
  const finalStatus = statusApiResult?.status || decoded?.status || 'UNKNOWN';
  const paymentStatus = finalStatus === 'COMPLETE' ? 'SUCCESS' : finalStatus;

  let gatewayResponseData = {};
  try {
    if (payment.gateway_response) gatewayResponseData = JSON.parse(payment.gateway_response);
  } catch (e) {
    gatewayResponseData = {};
  }

  await payment.update({
    status: paymentStatus,
    gateway_response: JSON.stringify({
      gateway: 'ESEWA',
      purpose: 'DONATE_DOCTORS',
      response_payload: decoded,
      signature_valid: signatureValid,
      status_api: statusApiResult,
      form_data: gatewayResponseData.form_data || null
    }),
    updated_at: new Date()
  });

  if (finalStatus !== 'COMPLETE') {
    return { paymentStatus, donation: null, finalStatus };
  }

  let donation = await DonateDoctors.findOne({ where: { payment_id: payment.id } });
  if (!donation) {
    const formData = gatewayResponseData.form_data || {};
    donation = await DonateDoctors.create({
      user_id: formData.user_id || null,
      donor_name: formData.donor_name || null,
      mobile_number: formData.mobile_number || null,
      email: formData.email || null,
      message: formData.message || null,
      amount: formData.amount || payment.amount,
      payment_id: payment.id
    });

    console.log('[DONATE_DOCTORS] Donation record created after payment success:', {
      donation_id: donation.id,
      payment_id: payment.id
    });
  }

  return { paymentStatus, donation, finalStatus };
};

/**
 * eSewa success redirect handler for Donate Doctors (GET)
 */
const donateDoctorsEsewaSuccess = async (req, res) => {
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

    let signatureValid = false;
    if (signature && signed_field_names) {
      const { signature: expectedSig } = esewaGateway.signatureFromFields(decoded, signed_field_names);
      signatureValid = expectedSig === signature;
    }

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

    const { paymentStatus, donation, finalStatus } = await finalizeDonateDoctorsPayment({
      payment,
      decoded,
      signatureValid,
      statusApiResult
    });

    if (finalStatus !== 'COMPLETE') {
      return res.status(200).json({
        success: false,
        message: 'eSewa payment not complete for Donate to Doctors',
        data: {
          status: finalStatus,
          payment_status: paymentStatus,
          order_id: transaction_uuid,
          signature_valid: signatureValid
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Donation received successfully. Thank you for supporting doctors and free clinics.',
      data: {
        order_id: transaction_uuid,
        payment_id: payment.id,
        payment_status: paymentStatus,
        donation: donation ? donation.toJSON() : null
      }
    });
  } catch (error) {
    console.error('Donate Doctors eSewa success callback error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing eSewa success callback for Donate to Doctors',
      error: error.message
    });
  }
};

/**
 * eSewa failure redirect handler for Donate Doctors (GET)
 */
const donateDoctorsEsewaFailure = async (req, res) => {
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
        } catch (e) {
          gatewayResponseData = {};
        }

        await payment.update({
          status: 'FAILED',
          gateway_response: JSON.stringify({
            gateway: 'ESEWA',
            purpose: 'DONATE_DOCTORS',
            response_payload: decoded,
            form_data: gatewayResponseData.form_data || null
          }),
          updated_at: new Date()
        });
      }
    }

    return res.status(200).json({
      success: false,
      message: 'eSewa payment failed/cancelled for Donate to Doctors',
      data: { order_id: transaction_uuid || null, payload: decoded }
    });
  } catch (error) {
    console.error('Donate Doctors eSewa failure callback error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing eSewa failure callback for Donate to Doctors',
      error: error.message
    });
  }
};

/**
 * Check Donate Doctors payment status by order_id.
 */
const checkDonateDoctorsPaymentStatus = async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'order_id is required'
      });
    }

    const payment = await Payment.findOne({ where: { order_id } });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    let gatewayResponseData = {};
    try {
      if (payment.gateway_response) gatewayResponseData = JSON.parse(payment.gateway_response);
    } catch (e) {
      gatewayResponseData = {};
    }

    if (payment.status === 'INITIATED' || payment.status === 'PENDING') {
      let statusApiResult = null;
      try {
        statusApiResult = await esewaGateway.checkStatus({
          transaction_uuid: payment.order_id,
          total_amount: payment.amount,
          product_code: esewaGateway.productCode
        });
      } catch (e) {
        statusApiResult = { error: e.response?.data || e.message };
      }

      const decoded = {
        status: statusApiResult?.status,
        transaction_uuid: payment.order_id,
        total_amount: payment.amount,
        product_code: esewaGateway.productCode
      };

      const { paymentStatus, donation } = await finalizeDonateDoctorsPayment({
        payment,
        decoded,
        signatureValid: false,
        statusApiResult
      });

      return res.status(200).json({
        success: paymentStatus === 'SUCCESS',
        message: `Donate Doctors payment status: ${paymentStatus}`,
        data: {
          order_id: payment.order_id,
          payment_id: payment.id,
          payment_status: paymentStatus,
          status_api: statusApiResult,
          donation: donation ? donation.toJSON() : null
        }
      });
    }

    const donation = await DonateDoctors.findOne({ where: { payment_id: payment.id } });
    return res.status(200).json({
      success: payment.status === 'SUCCESS',
      message: `Donate Doctors payment status: ${payment.status}`,
      data: {
        order_id: payment.order_id,
        payment_id: payment.id,
        payment_status: payment.status,
        form_data: gatewayResponseData.form_data || null,
        donation: donation ? donation.toJSON() : null
      }
    });
  } catch (error) {
    console.error('Check Donate Doctors payment status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking Donate Doctors payment status',
      error: error.message
    });
  }
};

/**
 * Register For Free Coaching
 */
const registerCoaching = async (req, res) => {
  console.log('Request body:', req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { user_id, entrance_preparation, coaching_subject } = req.body;

    if (!user_id || !entrance_preparation || !coaching_subject) {
      return res.status(422).json({
        success: false,
        message: 'Missing required fields',
        errors: [
          !user_id && { msg: 'User ID is required', param: 'user_id' },
          !entrance_preparation && { msg: 'Entrance preparation is required', param: 'entrance_preparation' },
          !coaching_subject && { msg: 'Coaching subject is required', param: 'coaching_subject' }
        ].filter(Boolean)
      });
    }

    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const trimmedEntrancePrep = entrance_preparation.trim();
    const trimmedCoachingSubject = coaching_subject.trim();

    if (!trimmedEntrancePrep || !trimmedCoachingSubject) {
      return res.status(422).json({
        success: false,
        message: 'Fields cannot be empty after trimming whitespace'
      });
    }

    const data = await FreeCoachingRegistration.create({
      user_id: parseInt(user_id),
      entrance_preparation: trimmedEntrancePrep,
      coaching_subject: trimmedCoachingSubject
    });

    console.log('Successfully created coaching registration:', data.toJSON());

    return res.status(201).json({
      success: true,
      message: 'Free coaching registration successful.',
      data: data.toJSON()
    });

  } catch (error) {
    console.error('Free coaching registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error registering for free coaching',
      error: error.message
    });
  }
};

/**
 * Register For Hostel
 */
const registerHostel = async (req, res) => {
  console.log('Request body:', req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { user_id, full_name, mobile_number, email, hostel_location } = req.body;

    if (!user_id || !full_name || !mobile_number || !hostel_location) {
      return res.status(422).json({
        success: false,
        message: 'Missing required fields',
        errors: [
          !user_id && { msg: 'User ID is required', param: 'user_id' },
          !full_name && { msg: 'Full name is required', param: 'full_name' },
          !mobile_number && { msg: 'Mobile number is required', param: 'mobile_number' },
          !hostel_location && { msg: 'Hostel location is required', param: 'hostel_location' }
        ].filter(Boolean)
      });
    }

    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const trimmedFullName = full_name.trim();
    const trimmedMobileNumber = mobile_number.trim();
    const trimmedEmail = email ? email.trim() : null;
    const trimmedHostelLocation = hostel_location.trim();

    if (!trimmedFullName || !trimmedMobileNumber || !trimmedHostelLocation) {
      return res.status(422).json({
        success: false,
        message: 'Required fields cannot be empty after trimming whitespace'
      });
    }

    const data = await HostelRegistration.create({
      user_id: parseInt(user_id),
      full_name: trimmedFullName,
      mobile_number: trimmedMobileNumber,
      email: trimmedEmail || null,
      hostel_location: trimmedHostelLocation
    });

    console.log('Successfully created hostel registration record:', data.toJSON());

    return res.status(201).json({
      success: true,
      message: 'Hostel registration successful.',
      data: data.toJSON()
    });

  } catch (error) {
    console.error('Hostel registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error registering for hostel',
      error: error.message
    });
  }
};

module.exports = {
  joinKalkiSena,
  joinKalkiSenaEsewaSuccess,
  joinKalkiSenaEsewaFailure,
  checkJoinKalkiSenaPaymentStatus,
  donateAbolishDowry,
  donateAbolishDowryEsewaSuccess,
  donateAbolishDowryEsewaFailure,
  checkDonateAbolishDowryPaymentStatus,
  donateDoctors,
  donateDoctorsEsewaSuccess,
  donateDoctorsEsewaFailure,
  checkDonateDoctorsPaymentStatus,
  registerCoaching,
  registerHostel
};
