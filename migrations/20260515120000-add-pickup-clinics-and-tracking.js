'use strict';

/** @param {import('sequelize').QueryInterface} queryInterface */
/** @param {import('sequelize').Sequelize} Sequelize */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pickup_clinics', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('pickup_clinics', ['is_active'], {
      name: 'pickup_clinics_is_active_index'
    });

    await queryInterface.addColumn('purchase_book', 'pickup_clinic_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'pickup_clinics', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Clinic where the customer will collect the order'
    });

    await queryInterface.addColumn('purchase_book', 'pickup_tracking_status', {
      type: Sequelize.ENUM('order_successful', 'shipped', 'out_for_delivery', 'arrived_at_clinic'),
      allowNull: false,
      defaultValue: 'order_successful',
      comment: 'Clinic pickup / shipment progress shown to the customer'
    });

    await queryInterface.addIndex('purchase_book', ['pickup_clinic_id'], {
      name: 'purchase_book_pickup_clinic_id_index'
    });

    await queryInterface.addIndex('purchase_book', ['pickup_tracking_status'], {
      name: 'purchase_book_pickup_tracking_status_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('purchase_book', 'purchase_book_pickup_tracking_status_index');
    await queryInterface.removeIndex('purchase_book', 'purchase_book_pickup_clinic_id_index');
    await queryInterface.removeColumn('purchase_book', 'pickup_tracking_status');
    await queryInterface.removeColumn('purchase_book', 'pickup_clinic_id');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_purchase_book_pickup_tracking_status";'
    );
    await queryInterface.dropTable('pickup_clinics');
  }
};
