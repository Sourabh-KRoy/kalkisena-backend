const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Vehicle = sequelize.define('Vehicle', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    vehicle_type: {
      type: DataTypes.ENUM('scooty', 'bike', 'car'),
      allowNull: false
    },
    car_variety: {
      type: DataTypes.ENUM('car_plus', 'car_lite', 'taxi'),
      allowNull: true
    },
    vehicle_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    vehicle_model: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    vehicle_color: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    is_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    current_latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    current_longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
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
    tableName: 'vehicles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['vehicle_number'],
        unique: true
      },
      {
        fields: ['vehicle_type']
      },
      {
        fields: ['is_available']
      }
    ]
  });

  Vehicle.associate = function(models) {
    Vehicle.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'driver'
    });
    Vehicle.hasMany(models.Ride, {
      foreignKey: 'vehicle_id',
      as: 'rides'
    });
  };

  return Vehicle;
};
