module.exports = {
  async up(queryInterface, Sequelize) {
    // Create enum type for purchase status
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_purchase_book_status" AS ENUM ('pending', 'processing', 'completed', 'cancelled', 'refunded');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('purchase_book', {
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
        comment: 'User who made the purchase'
      },
      book_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'books',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Book being purchased'
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: {
          min: 1
        }
      },
      unit_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Price per unit at the time of purchase'
      },
      total_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Total price (quantity * unit_price)'
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Delivery address for the purchase'
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'City for delivery'
      },
      state: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'State or province for delivery'
      },
      postal_code: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Postal or ZIP code'
      },
      country: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: 'Nepal',
        comment: 'Country for delivery'
      },
      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Contact phone number for delivery'
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'cancelled', 'refunded'),
        allowNull: false,
        defaultValue: 'pending'
      },
      purchase_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Date and time of purchase'
      },
      delivery_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Expected or actual delivery date'
      },
      tracking_number: {
        type: Sequelize.STRING(100),
        allowNull: true,
        unique: true,
        comment: 'Shipping tracking number'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Additional notes or special instructions'
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
    await queryInterface.addIndex('purchase_book', ['user_id'], {
      name: 'purchase_book_user_id_index'
    });

    await queryInterface.addIndex('purchase_book', ['book_id'], {
      name: 'purchase_book_book_id_index'
    });

    await queryInterface.addIndex('purchase_book', ['status'], {
      name: 'purchase_book_status_index'
    });

    await queryInterface.addIndex('purchase_book', ['purchase_date'], {
      name: 'purchase_book_purchase_date_index'
    });

    await queryInterface.addIndex('purchase_book', ['tracking_number'], {
      name: 'purchase_book_tracking_number_index',
      unique: true,
      where: {
        tracking_number: {
          [Sequelize.Op.ne]: null
        }
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('purchase_book');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_purchase_book_status";');
  }
};
