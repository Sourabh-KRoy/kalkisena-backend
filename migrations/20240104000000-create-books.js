module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('books', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      author: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      isbn: {
        type: Sequelize.STRING(50),
        allowNull: true,
        unique: true,
        comment: 'International Standard Book Number'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      stock: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Available quantity in stock'
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Book category or genre'
      },
      published_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      publisher: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      language: {
        type: Sequelize.STRING(50),
        allowNull: true,
        defaultValue: 'English'
      },
      pages: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      image_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Book cover image URL'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the book is available for purchase'
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
    await queryInterface.addIndex('books', ['isbn'], {
      name: 'books_isbn_index',
      unique: true,
      where: {
        isbn: {
          [Sequelize.Op.ne]: null
        }
      }
    });

    await queryInterface.addIndex('books', ['title'], {
      name: 'books_title_index'
    });

    await queryInterface.addIndex('books', ['author'], {
      name: 'books_author_index'
    });

    await queryInterface.addIndex('books', ['category'], {
      name: 'books_category_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('books');
  }
};
