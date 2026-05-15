const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PickupClinic = sequelize.define(
    'PickupClinic',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      phone: {
        type: DataTypes.STRING(30),
        allowNull: true
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      opening_hours: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Display text e.g. 9 AM - 5 PM'
      },
      latitude: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      longitude: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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
    },
    {
      tableName: 'pickup_clinics',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [{ fields: ['is_active'] }]
    }
  );

  PickupClinic.associate = function (models) {
    PickupClinic.hasMany(models.PurchaseBook, {
      foreignKey: 'pickup_clinic_id',
      as: 'purchases'
    });
  };

  return PickupClinic;
};
