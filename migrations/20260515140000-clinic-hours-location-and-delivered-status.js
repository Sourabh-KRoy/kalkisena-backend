'use strict';

/** @param {import('sequelize').QueryInterface} queryInterface */
/** @param {import('sequelize').Sequelize} Sequelize */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('pickup_clinics', 'opening_hours', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'e.g. 9 AM - 5 PM'
    });

    await queryInterface.addColumn('pickup_clinics', 'latitude', {
      type: Sequelize.DOUBLE,
      allowNull: true
    });

    await queryInterface.addColumn('pickup_clinics', 'longitude', {
      type: Sequelize.DOUBLE,
      allowNull: true
    });

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'enum_purchase_book_pickup_tracking_status'
            AND e.enumlabel = 'order_delivered_success'
        ) THEN
          ALTER TYPE "enum_purchase_book_pickup_tracking_status" ADD VALUE 'order_delivered_success';
        END IF;
      END $$;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pickup_clinics', 'longitude');
    await queryInterface.removeColumn('pickup_clinics', 'latitude');
    await queryInterface.removeColumn('pickup_clinics', 'opening_hours');
  }
};
