module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true
      },
      google_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      phone: {
        type: Sequelize.STRING(15),
        allowNull: true
      },
      gender: {
        type: Sequelize.ENUM('male', 'female', 'other'),
        allowNull: true
      },
      date_of_birth: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      email_verified_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: true // Allow null for Google OAuth users
      },
      otp: {
        type: Sequelize.STRING(6),
        allowNull: true
      },
      remember_token: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      ip: {
        type: Sequelize.STRING(45),
        allowNull: true,
        comment: 'IP address of the user'
      },
      last_login_ip: {
        type: Sequelize.STRING(45),
        allowNull: true,
        comment: 'Last login IP address'
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last login timestamp'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'User account status'
      },
      login_attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Number of failed login attempts'
      },
      locked_until: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Account locked until timestamp'
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
    await queryInterface.addIndex('users', ['email'], {
      unique: true,
      name: 'users_email_unique'
    });

    await queryInterface.addIndex('users', ['google_id'], {
      name: 'users_google_id_index',
      where: {
        google_id: {
          [Sequelize.Op.ne]: null
        }
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('users');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_gender";');
  }
};
