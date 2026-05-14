const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PurchaseBook = sequelize.define('PurchaseBook', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    payment_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'payments',
        key: 'id'
      },
      comment: 'Related payment record (payments.id)'
    },
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'User who made the purchase'
    },
    book_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'books',
        key: 'id'
      },
      comment: 'Book being purchased'
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1
      }
    },
    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Price per unit at the time of purchase'
    },
    total_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Total price (quantity * unit_price)'
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Fulfillment note; home delivery not used — clinic pickup after ~2 months unless legacy address supplied'
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
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'cancelled', 'refunded'),
      allowNull: false,
      defaultValue: 'pending'
    },
    purchase_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Date and time of purchase'
    },
    delivery_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Expected or actual delivery date'
    },
    tracking_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
      comment: 'Shipping tracking number'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes or special instructions'
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
    tableName: 'purchase_book',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['book_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['purchase_date']
      },
      {
        fields: ['tracking_number'],
        unique: true
      }
    ]
  });

  // Define associations
  PurchaseBook.associate = function(models) {
    PurchaseBook.belongsTo(models.Payment, {
      foreignKey: 'payment_id',
      as: 'payment'
    });
    PurchaseBook.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
    PurchaseBook.belongsTo(models.Book, {
      foreignKey: 'book_id',
      as: 'book'
    });
  };

  return PurchaseBook;
};
