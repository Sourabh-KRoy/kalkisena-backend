module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('users', 'remember_token', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('users', 'remember_token', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
  }
};
