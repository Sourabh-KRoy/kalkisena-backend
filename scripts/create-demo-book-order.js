#!/usr/bin/env node
/**
 * Creates a sample book purchase order for testing My Orders / pickup status.
 *
 * Usage:
 *   node scripts/create-demo-book-order.js
 *   USER_ID=5 CLINIC_ID=2 node scripts/create-demo-book-order.js
 */
require('dotenv').config();

const crypto = require('crypto');
const {
  sequelize,
  User,
  Book,
  PickupClinic,
  Payment,
  PurchaseBook
} = require('../models');

const CLINIC_ID = parseInt(process.env.CLINIC_ID || '2', 10);
const PICKUP_STATUS = process.env.PICKUP_STATUS || 'out_for_delivery';
const FIXED_PRICE = 1000;

const formatClinicAddress = (clinic) => {
  const lines = [`Clinic pickup: ${clinic.name}`, clinic.address];
  if (clinic.opening_hours) lines.push(`Clinic hours: ${clinic.opening_hours}`);
  if (clinic.phone) lines.push(`Clinic phone: ${clinic.phone}`);
  if (clinic.email) lines.push(`Clinic email: ${clinic.email}`);
  lines.push('Ready approximately 2 months after payment. No home delivery.');
  return lines.join('\n');
};

const generateOrderId = () => {
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
  return `BP-${datePrefix}-DEMO-${suffix}`;
};

async function main() {
  const clinic = await PickupClinic.findByPk(CLINIC_ID);
  if (!clinic) {
    throw new Error(`Pickup clinic id=${CLINIC_ID} not found. Create it in Postman first.`);
  }
  if (!clinic.is_active) {
    throw new Error(`Clinic id=${CLINIC_ID} is inactive.`);
  }

  let user;
  if (process.env.USER_ID) {
    user = await User.findByPk(process.env.USER_ID);
    if (!user) throw new Error(`User id=${process.env.USER_ID} not found.`);
  } else {
    user = await User.findOne({
      where: { is_active: true },
      order: [['id', 'ASC']]
    });
    if (!user) throw new Error('No active user in DB. Set USER_ID=<id> or register a user first.');
  }

  const book = await Book.findOne({
    where: { is_active: true },
    order: [['id', 'ASC']]
  });
  if (!book) {
    throw new Error('No active book in DB. Add a book via POST /api/book-purchase/book first.');
  }

  const orderId = generateOrderId();
  const quantity = 1;
  const totalPrice = FIXED_PRICE * quantity;

  const payment = await Payment.create({
    order_id: orderId,
    amount: totalPrice,
    process_id: null,
    status: 'SUCCESS',
    gateway_response: JSON.stringify({
      gateway: 'DEMO_SCRIPT',
      note: 'Test order created by scripts/create-demo-book-order.js'
    })
  });

  const purchase = await PurchaseBook.create({
    payment_id: payment.id,
    user_id: user.id,
    book_id: book.id,
    quantity,
    unit_price: FIXED_PRICE,
    total_price: totalPrice,
    address: formatClinicAddress(clinic),
    city: null,
    state: null,
    postal_code: null,
    country: 'India',
    phone_number: user.phone || clinic.phone,
    notes: 'Demo order (script)',
    pickup_clinic_id: clinic.id,
    pickup_tracking_status: PICKUP_STATUS,
    status: 'processing',
    tracking_number: orderId
  });

  const full = await PurchaseBook.findByPk(purchase.id, {
    include: [
      { model: Book, as: 'book', attributes: ['id', 'title', 'author'] },
      { model: PickupClinic, as: 'pickup_clinic' },
      { model: Payment, as: 'payment', attributes: ['id', 'order_id', 'status', 'amount'] }
    ]
  });

  console.log('\nDemo book order created:\n');
  console.log(JSON.stringify({
    success: true,
    message: 'Demo order created',
    data: {
      purchase_id: full.id,
      order_id: full.tracking_number,
      user_id: full.user_id,
      pickup_tracking_status: full.pickup_tracking_status,
      pickup_tracking_status_label: 'Out for delivery',
      payment_status: full.payment?.status,
      book: full.book ? { id: full.book.id, title: full.book.title } : null,
      pickup_clinic: full.pickup_clinic
        ? {
            id: full.pickup_clinic.id,
            name: full.pickup_clinic.name,
            address: full.pickup_clinic.address
          }
        : null
    }
  }, null, 2));
  console.log('\nTest My Orders with this user JWT:');
  console.log(`  GET /api/book-purchase/my-orders  (user_id=${user.id})\n`);
}

main()
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
