module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('free_coaching_registration', {
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
      entrance_preparation: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      coaching_subject: {
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
    await queryInterface.addIndex('free_coaching_registration', ['user_id'], {
      name: 'free_coaching_registration_user_id_index'
    });

    await queryInterface.addIndex('free_coaching_registration', ['entrance_preparation'], {
      name: 'free_coaching_registration_entrance_preparation_index'
    });

    await queryInterface.addIndex('free_coaching_registration', ['coaching_subject'], {
      name: 'free_coaching_registration_coaching_subject_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('free_coaching_registration');
  }
};
