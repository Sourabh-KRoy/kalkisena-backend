module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (!table.otp_expires_at) {
      await queryInterface.addColumn('users', 'otp_expires_at', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'OTP expiration timestamp'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (table.otp_expires_at) {
      await queryInterface.removeColumn('users', 'otp_expires_at');
    }
  }
};
