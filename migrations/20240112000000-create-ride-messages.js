module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ride_messages', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true
      },
      ride_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'rides',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      sender_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      receiver_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      is_read: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      read_at: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('ride_messages', ['ride_id'], {
      name: 'ride_messages_ride_id_index'
    });

    await queryInterface.addIndex('ride_messages', ['sender_id'], {
      name: 'ride_messages_sender_id_index'
    });

    await queryInterface.addIndex('ride_messages', ['receiver_id'], {
      name: 'ride_messages_receiver_id_index'
    });

    await queryInterface.addIndex('ride_messages', ['is_read'], {
      name: 'ride_messages_is_read_index'
    });

    await queryInterface.addIndex('ride_messages', ['created_at'], {
      name: 'ride_messages_created_at_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ride_messages');
  }
};
