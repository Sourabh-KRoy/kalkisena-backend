const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Book = sequelize.define('Book', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    author: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    isbn: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      comment: 'International Standard Book Number'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    promotional_description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Long promotional description (Why you will buy this Book?)'
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: 'NPR',
      comment: 'Currency code (e.g., NPR, USD)'
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Available quantity in stock'
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Book category or genre'
    },
    published_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    publisher: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    language: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'English'
    },
    pages: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Book cover image URL'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether the book is available for purchase'
    },
    balance_payment_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'When true, pre-booked users can pay the remaining balance for clinic pickup'
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
    tableName: 'books',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['isbn'],
        unique: true
      },
      {
        fields: ['title']
      },
      {
        fields: ['author']
      },
      {
        fields: ['category']
      }
    ]
  });

  // Define associations
  Book.associate = function(models) {
    Book.hasMany(models.PurchaseBook, {
      foreignKey: 'book_id',
      as: 'purchases'
    });
  };

  return Book;
};
