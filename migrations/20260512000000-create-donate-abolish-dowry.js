module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('donate_abolish_dowry', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'User who donated (nullable for anonymous donations)'
      },
      donor_name: {
        type: Sequelize.STRING(150),
        allowNull: true,
        comment: 'Optional donor display name'
      },
      mobile_number: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      email: {
        type: Sequelize.STRING(150),
        allowNull: true
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Donation amount (NPR)'
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Optional message from donor'
      },
      payment_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: 'payments',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Linked payments.id once the eSewa payment is verified'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('donate_abolish_dowry', ['user_id'], {
      name: 'donate_abolish_dowry_user_id_index'
    });

    await queryInterface.addIndex('donate_abolish_dowry', ['payment_id'], {
      name: 'donate_abolish_dowry_payment_id_index'
    });

    await queryInterface.addIndex('donate_abolish_dowry', ['email'], {
      name: 'donate_abolish_dowry_email_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('donate_abolish_dowry', 'donate_abolish_dowry_email_index');
    await queryInterface.removeIndex('donate_abolish_dowry', 'donate_abolish_dowry_payment_id_index');
    await queryInterface.removeIndex('donate_abolish_dowry', 'donate_abolish_dowry_user_id_index');
    await queryInterface.dropTable('donate_abolish_dowry');
  }
};
