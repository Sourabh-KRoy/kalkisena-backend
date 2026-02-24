module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_addresses', {
      id: {
        type: Sequelize.INTEGER,
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
        onDelete: 'CASCADE',
        comment: 'User who owns this address'
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Full delivery address'
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'City for delivery'
      },
      state: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'State or province for delivery'
      },
      postal_code: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Postal or ZIP code'
      },
      country: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: 'Nepal',
        comment: 'Country for delivery'
      },
      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Contact phone number for delivery'
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this is the default address'
      },
      label: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Address label (e.g., Home, Office, etc.)'
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
    await queryInterface.addIndex('user_addresses', ['user_id'], {
      name: 'user_addresses_user_id_index'
    });

    await queryInterface.addIndex('user_addresses', ['is_default'], {
      name: 'user_addresses_is_default_index'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('user_addresses', 'user_addresses_user_id_index');
    await queryInterface.removeIndex('user_addresses', 'user_addresses_is_default_index');
    
    // Drop table
    await queryInterface.dropTable('user_addresses');
  }
};
