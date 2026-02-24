module.exports = {
  async up(queryInterface, Sequelize) {
    // Create enum types
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_driver_registration_gender" AS ENUM ('Male', 'Female', 'Other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_driver_registration_vehicle_type" AS ENUM ('car', 'bike', 'scooter', 'taxi');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_driver_registration_status" AS ENUM ('pending', 'approved', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('driver_registration', {
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
        comment: 'Authentication user ID from external auth system - ensures only one registration per user'
      },
      full_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      date_of_birth: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      gender: {
        type: Sequelize.ENUM('Male', 'Female', 'Other'),
        allowNull: false
      },
      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      vehicle_type: {
        type: Sequelize.ENUM('car', 'bike', 'scooter', 'taxi'),
        allowNull: false
      },
      make: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      model: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      year_of_manufacture: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Year of manufacture (4 digits)'
      },
      driving_license_front: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      driving_license_back: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      vehicle_registration_front: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      insurance_certificate: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      citizenship_front: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      citizenship_back: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      number_plate_front: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      number_plate_back: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending'
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
    await queryInterface.addIndex('driver_registration', ['user_id'], {
      name: 'driver_registration_user_id_index',
      unique: true
    });

    await queryInterface.addIndex('driver_registration', ['email'], {
      name: 'driver_registration_email_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('driver_registration');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_driver_registration_gender";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_driver_registration_vehicle_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_driver_registration_status";');
  }
};
