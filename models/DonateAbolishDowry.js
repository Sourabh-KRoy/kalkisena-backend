const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DonateAbolishDowry = sequelize.define('DonateAbolishDowry', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    donor_name: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    mobile_number: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    payment_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'payments',
        key: 'id'
      }
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'donate_abolish_dowry',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['payment_id'] },
      { fields: ['email'] }
    ]
  });

  DonateAbolishDowry.associate = function (models) {
    if (models.User) {
      DonateAbolishDowry.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });
    }

    if (models.Payment) {
      DonateAbolishDowry.belongsTo(models.Payment, {
        foreignKey: 'payment_id',
        as: 'payment'
      });
    }
  };

  return DonateAbolishDowry;
};
