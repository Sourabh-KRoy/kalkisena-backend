module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('books', 'promotional_description', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Long promotional description (Why you will buy this Book?)'
    });

    await queryInterface.addColumn('books', 'currency', {
      type: Sequelize.STRING(10),
      allowNull: true,
      defaultValue: 'NPR',
      comment: 'Currency code (e.g., NPR, USD)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('books', 'promotional_description');
    await queryInterface.removeColumn('books', 'currency');
  }
};
