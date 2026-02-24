const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DriverRegistration = sequelize.define('DriverRegistration', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Authentication user ID from external auth system - ensures only one registration per user'
    },
    full_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    gender: {
      type: DataTypes.ENUM('Male', 'Female', 'Other'),
      allowNull: false
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    memberid: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Optional member ID'
    },
    city_to_ride: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'City where rider will operate'
    },
    vehicle_type: {
      type: DataTypes.ENUM('car', 'bike', 'scooter', 'taxi'),
      allowNull: false
    },
    make: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    model: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    year_of_manufacture: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Year of manufacture (4 digits)'
    },
    color: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Vehicle color'
    },
    number_of_seats: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Number of seats in the vehicle'
    },
    licence_plate_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Vehicle licence plate number'
    },
    driving_license_front: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    driving_license_back: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    vehicle_registration_front: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    insurance_certificate: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    citizenship_front: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    citizenship_back: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    number_plate_front: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    number_plate_back: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'driver_registration',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id'],
        unique: true
      },
      {
        fields: ['email']
      }
    ]
  });

  // Define association with User model
  DriverRegistration.associate = function(models) {
    DriverRegistration.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return DriverRegistration;
};
