'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_purchase_book_status" ADD VALUE IF NOT EXISTS 'pre_booked';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_purchase_book_status" ADD VALUE IF NOT EXISTS 'awaiting_balance';
    `);

    await queryInterface.addColumn('books', 'balance_payment_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'When true, pre-booked customers can pay the remaining balance and pick up from clinic'
    });

    await queryInterface.addColumn('purchase_book', 'balance_payment_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'payments', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Payment record for the remaining balance (900 NPR)'
    });

    await queryInterface.addColumn('purchase_book', 'amount_paid', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Total amount paid so far (pre-booking + balance)'
    });

    await queryInterface.addColumn('purchase_book', 'balance_due', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Remaining amount due before clinic pickup'
    });

    await queryInterface.addIndex('purchase_book', ['balance_payment_id'], {
      name: 'purchase_book_balance_payment_id_index'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('purchase_book', 'purchase_book_balance_payment_id_index');
    await queryInterface.removeColumn('purchase_book', 'balance_due');
    await queryInterface.removeColumn('purchase_book', 'amount_paid');
    await queryInterface.removeColumn('purchase_book', 'balance_payment_id');
    await queryInterface.removeColumn('books', 'balance_payment_enabled');
  }
};
