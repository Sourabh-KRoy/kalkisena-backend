module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rides', {
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
      driver_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      vehicle_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'vehicles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      vehicle_type: {
        type: Sequelize.ENUM('scooty', 'bike', 'car'),
        allowNull: false
      },
      from_latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: false
      },
      from_longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: false
      },
      from_address: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      to_latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: false
      },
      to_longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: false
      },
      to_address: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      distance: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      estimated_duration: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      base_fare: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      distance_fare: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      time_fare: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      surge_multiplier: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 1.00
      },
      total_fare: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: Sequelize.ENUM('pending', 'accepted', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancelled_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancellation_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'paid', 'failed', 'refunded'),
        allowNull: false,
        defaultValue: 'pending'
      },
      payment_method: {
        type: Sequelize.ENUM('cash', 'card', 'wallet', 'upi'),
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

    await queryInterface.addIndex('rides', ['user_id'], {
      name: 'rides_user_id_index'
    });

    await queryInterface.addIndex('rides', ['driver_id'], {
      name: 'rides_driver_id_index'
    });

    await queryInterface.addIndex('rides', ['vehicle_id'], {
      name: 'rides_vehicle_id_index'
    });

    await queryInterface.addIndex('rides', ['status'], {
      name: 'rides_status_index'
    });

    await queryInterface.addIndex('rides', ['vehicle_type'], {
      name: 'rides_vehicle_type_index'
    });

    await queryInterface.addIndex('rides', ['created_at'], {
      name: 'rides_created_at_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('rides');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_rides_vehicle_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_rides_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_rides_payment_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_rides_payment_method";');
  }
};
