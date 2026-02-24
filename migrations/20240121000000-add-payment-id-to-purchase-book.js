module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('purchase_book', 'payment_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'payments',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Related payment record (payments.id)'
    });

    await queryInterface.addIndex('purchase_book', ['payment_id'], {
      name: 'purchase_book_payment_id_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('purchase_book', 'purchase_book_payment_id_index');
    await queryInterface.removeColumn('purchase_book', 'payment_id');
  }
};

