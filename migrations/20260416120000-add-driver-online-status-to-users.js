module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("users");

    if (!table.driver_mode) {
      await queryInterface.addColumn("users", "driver_mode", {
        type: Sequelize.ENUM("offline", "online"),
        allowNull: false,
        defaultValue: "offline",
        comment: "Driver app presence: offline = not receiving jobs",
      });
    }

    if (!table.driver_available_for_rides) {
      await queryInterface.addColumn("users", "driver_available_for_rides", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment:
          "When online, true if driver can accept a new pending ride (false while on a job)",
      });
    }

    if (!table.current_latitude) {
      await queryInterface.addColumn("users", "current_latitude", {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
        comment: "Last known driver latitude (set while online)",
      });
    }

    if (!table.current_longitude) {
      await queryInterface.addColumn("users", "current_longitude", {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
        comment: "Last known driver longitude (set while online)",
      });
    }

    if (!table.driver_location_updated_at) {
      await queryInterface.addColumn("users", "driver_location_updated_at", {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "When current_latitude/current_longitude were last updated",
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("users");

    if (table.driver_location_updated_at) {
      await queryInterface.removeColumn("users", "driver_location_updated_at");
    }
    if (table.current_longitude) {
      await queryInterface.removeColumn("users", "current_longitude");
    }
    if (table.current_latitude) {
      await queryInterface.removeColumn("users", "current_latitude");
    }
    if (table.driver_available_for_rides) {
      await queryInterface.removeColumn("users", "driver_available_for_rides");
    }
    if (table.driver_mode) {
      await queryInterface.removeColumn("users", "driver_mode");
    }

    if (queryInterface.sequelize.getDialect() === "postgres") {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_users_driver_mode";',
      );
    }
  },
};
