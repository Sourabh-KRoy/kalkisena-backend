const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserAddress = sequelize.define('UserAddress', {
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
      comment: 'User who owns this address'
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Full delivery address'
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'City for delivery'
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'State or province for delivery'
    },
    postal_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Postal or ZIP code'
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'Nepal',
      comment: 'Country for delivery'
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Contact phone number for delivery'
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether this is the default address'
    },
    label: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Address label (e.g., Home, Office, etc.)'
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
    tableName: 'user_addresses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['is_default']
      }
    ]
  });

  // Define associations
  UserAddress.associate = function(models) {
    UserAddress.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return UserAddress;
};
