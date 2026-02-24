module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('rides', 'actual_distance', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true
    });

    await queryInterface.addColumn('rides', 'actual_duration', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addColumn('rides', 'actual_base_fare', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    });

    await queryInterface.addColumn('rides', 'actual_distance_fare', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    });

    await queryInterface.addColumn('rides', 'actual_time_fare', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    });

    await queryInterface.addColumn('rides', 'actual_total_fare', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    });

    await queryInterface.addColumn('rides', 'fare_adjustment', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('rides', 'actual_distance');
    await queryInterface.removeColumn('rides', 'actual_duration');
    await queryInterface.removeColumn('rides', 'actual_base_fare');
    await queryInterface.removeColumn('rides', 'actual_distance_fare');
    await queryInterface.removeColumn('rides', 'actual_time_fare');
    await queryInterface.removeColumn('rides', 'actual_total_fare');
    await queryInterface.removeColumn('rides', 'fare_adjustment');
  }
};
