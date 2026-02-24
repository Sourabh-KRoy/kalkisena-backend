module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'profile_image', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'Profile image URL stored in S3'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'profile_image');
  }
};
