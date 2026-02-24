const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Payment = sequelize.define('Payment', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    order_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'Unique order ID (e.g., NP-20250115-0001-A3B9)'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Payment amount'
    },
    process_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Process ID from Nepal Payment gateway'
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'INITIATED',
      comment: 'Payment status: INITIATED, SUCCESS, FAILED, PENDING, etc.'
    },
    gateway_response: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Full response from payment gateway (JSON)'
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
    tableName: 'payments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['order_id'],
        unique: true
      },
      {
        fields: ['status']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return Payment;
};
