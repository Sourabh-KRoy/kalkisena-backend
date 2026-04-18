const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Ride = sequelize.define(
    "Ride",
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      driver_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      vehicle_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: {
          model: "vehicles",
          key: "id",
        },
      },
      vehicle_type: {
        type: DataTypes.ENUM("scooty", "bike", "car"),
        allowNull: false,
      },
      car_variety: {
        type: DataTypes.ENUM("car_plus", "car_lite", "taxi"),
        allowNull: true,
      },
      from_latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: false,
      },
      from_longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: false,
      },
      from_address: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      to_latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: false,
      },
      to_longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: false,
      },
      to_address: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      distance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: "Distance in kilometers",
      },
      estimated_duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "Estimated duration in minutes",
      },
      base_fare: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      distance_fare: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      time_fare: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      surge_multiplier: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 1.0,
      },
      total_fare: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      actual_distance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: "Actual distance traveled in kilometers",
      },
      actual_duration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "Actual duration in minutes",
      },
      actual_base_fare: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      actual_distance_fare: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      actual_time_fare: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      actual_total_fare: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
      },
      fare_adjustment: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: "Difference between actual and estimated fare",
      },
      status: {
        type: DataTypes.ENUM(
          "pending",
          "accepted",
          "in_progress",
          "completed",
          "cancelled",
        ),
        allowNull: false,
        defaultValue: "pending",
      },
      ride_otp: {
        type: DataTypes.STRING(4),
        allowNull: true,
        comment:
          "4-digit OTP for driver to verify rider at pickup (Ola/Uber style)",
      },
      otp_verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "When driver successfully verified the rider OTP",
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cancelled_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cancellation_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      payment_status: {
        type: DataTypes.ENUM("pending", "paid", "failed", "refunded"),
        allowNull: false,
        defaultValue: "pending",
      },
      payment_method: {
        type: DataTypes.ENUM("cash", "card", "wallet", "upi"),
        allowNull: true,
      },
      rejected_driver_ids: {
        type: DataTypes.JSON, // or TEXT if needed
        allowNull: true,
        defaultValue: [],
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "rides",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          fields: ["user_id"],
        },
        {
          fields: ["driver_id"],
        },
        {
          fields: ["vehicle_id"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["vehicle_type"],
        },
        {
          fields: ["created_at"],
        },
      ],
    },
  );

  Ride.associate = function (models) {
    Ride.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
    });
    Ride.belongsTo(models.User, {
      foreignKey: "driver_id",
      as: "driver",
    });
    Ride.belongsTo(models.Vehicle, {
      foreignKey: "vehicle_id",
      as: "vehicle",
    });
    Ride.hasMany(models.RideMessage, {
      foreignKey: "ride_id",
      as: "messages",
    });
  };

  return Ride;
};
