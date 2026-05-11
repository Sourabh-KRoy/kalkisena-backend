module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('join_kalkisena_clinic', 'payment_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'payments',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Related payment record (payments.id) for Kalki Sena membership fee'
    });

    await queryInterface.addIndex('join_kalkisena_clinic', ['payment_id'], {
      name: 'join_kalkisena_clinic_payment_id_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('join_kalkisena_clinic', 'join_kalkisena_clinic_payment_id_index');
    await queryInterface.removeColumn('join_kalkisena_clinic', 'payment_id');
  }
};
