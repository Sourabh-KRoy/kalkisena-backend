module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('donate_doctors', {
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
        allowNull: true
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
        comment: 'Donation amount (NPR) for the Doctors / Free Clinic cause'
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true
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
        comment: 'Linked payments.id once eSewa payment is verified'
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

    await queryInterface.addIndex('donate_doctors', ['user_id'], {
      name: 'donate_doctors_user_id_index'
    });

    await queryInterface.addIndex('donate_doctors', ['payment_id'], {
      name: 'donate_doctors_payment_id_index'
    });

    await queryInterface.addIndex('donate_doctors', ['email'], {
      name: 'donate_doctors_email_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('donate_doctors', 'donate_doctors_email_index');
    await queryInterface.removeIndex('donate_doctors', 'donate_doctors_payment_id_index');
    await queryInterface.removeIndex('donate_doctors', 'donate_doctors_user_id_index');
    await queryInterface.dropTable('donate_doctors');
  }
};
