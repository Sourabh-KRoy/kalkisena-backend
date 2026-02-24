module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('hostel_registration', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      full_name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      mobile_number: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(150),
        allowNull: true
      },
      hostel_location: {
        type: Sequelize.STRING(150),
        allowNull: false
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

    // Create indexes
    await queryInterface.addIndex('hostel_registration', ['user_id'], {
      name: 'hostel_registration_user_id_index'
    });

    await queryInterface.addIndex('hostel_registration', ['email'], {
      name: 'hostel_registration_email_index'
    });

    await queryInterface.addIndex('hostel_registration', ['hostel_location'], {
      name: 'hostel_registration_hostel_location_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('hostel_registration');
  }
};
