module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      order_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Unique order ID (e.g., NP-20250115-0001-A3B9)'
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Payment amount'
      },
      process_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Process ID from Nepal Payment gateway'
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'INITIATED',
        comment: 'Payment status: INITIATED, SUCCESS, FAILED, PENDING, etc.'
      },
      gateway_response: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Full response from payment gateway (JSON)'
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

    // Create indexes
    await queryInterface.addIndex('payments', ['order_id'], {
      name: 'payments_order_id_index',
      unique: true
    });

    await queryInterface.addIndex('payments', ['status'], {
      name: 'payments_status_index'
    });

    await queryInterface.addIndex('payments', ['created_at'], {
      name: 'payments_created_at_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('payments');
  }
};
