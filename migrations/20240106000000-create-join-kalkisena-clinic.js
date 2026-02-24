module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('join_kalkisena_clinic', {
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
      family_members: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      email: {
        type: Sequelize.STRING(150),
        allowNull: true
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
    await queryInterface.addIndex('join_kalkisena_clinic', ['user_id'], {
      name: 'join_kalkisena_clinic_user_id_index'
    });

    await queryInterface.addIndex('join_kalkisena_clinic', ['email'], {
      name: 'join_kalkisena_clinic_email_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('join_kalkisena_clinic');
  }
};
