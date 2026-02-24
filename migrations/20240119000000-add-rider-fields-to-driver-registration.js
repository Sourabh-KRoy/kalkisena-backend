module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('driver_registration', 'memberid', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Optional member ID'
    });

    await queryInterface.addColumn('driver_registration', 'city_to_ride', {
      type: Sequelize.STRING(100),
      allowNull: false,
      defaultValue: '',
      comment: 'City where rider will operate'
    });

    await queryInterface.addColumn('driver_registration', 'color', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Vehicle color'
    });

    await queryInterface.addColumn('driver_registration', 'number_of_seats', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Number of seats in the vehicle'
    });

    await queryInterface.addColumn('driver_registration', 'licence_plate_number', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Vehicle licence plate number'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('driver_registration', 'memberid');
    await queryInterface.removeColumn('driver_registration', 'city_to_ride');
    await queryInterface.removeColumn('driver_registration', 'color');
    await queryInterface.removeColumn('driver_registration', 'number_of_seats');
    await queryInterface.removeColumn('driver_registration', 'licence_plate_number');
  }
};
