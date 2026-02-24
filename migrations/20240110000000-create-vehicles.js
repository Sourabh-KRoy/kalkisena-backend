module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vehicles', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      vehicle_type: {
        type: Sequelize.ENUM('scooty', 'bike', 'car'),
        allowNull: false
      },
      vehicle_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      vehicle_model: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      vehicle_color: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      is_available: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      current_latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true
      },
      current_longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true
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

    await queryInterface.addIndex('vehicles', ['user_id'], {
      name: 'vehicles_user_id_index'
    });

    await queryInterface.addIndex('vehicles', ['vehicle_number'], {
      unique: true,
      name: 'vehicles_vehicle_number_unique'
    });

    await queryInterface.addIndex('vehicles', ['vehicle_type'], {
      name: 'vehicles_vehicle_type_index'
    });

    await queryInterface.addIndex('vehicles', ['is_available'], {
      name: 'vehicles_is_available_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('vehicles');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_vehicles_vehicle_type";');
  }
};
