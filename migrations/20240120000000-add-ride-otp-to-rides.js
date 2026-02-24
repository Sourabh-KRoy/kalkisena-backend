'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('rides', 'ride_otp', {
      type: Sequelize.STRING(4),
      allowNull: true,
      comment: '4-digit OTP for driver to verify rider at pickup (Ola/Uber style)'
    });

    await queryInterface.addColumn('rides', 'otp_verified_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When driver successfully verified the rider OTP'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('rides', 'ride_otp');
    await queryInterface.removeColumn('rides', 'otp_verified_at');
  }
};
