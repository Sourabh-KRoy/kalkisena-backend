const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const FoodOrder = sequelize.define(
    "FoodOrder",
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
      restaurant_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "restaurants",
          key: "id",
        },
      },
      order_number: {
        type: DataTypes.STRING(40),
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM("placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"),
        allowNull: false,
        defaultValue: "placed",
      },
      payment_status: {
        type: DataTypes.ENUM("pending", "paid", "failed"),
        allowNull: false,
        defaultValue: "pending",
      },
      payment_method: {
        type: DataTypes.ENUM("cash", "upi", "card", "wallet"),
        allowNull: true,
      },
      delivery_address: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      tax_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      delivery_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      ordered_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
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
      tableName: "food_orders",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { fields: ["user_id"] },
        { fields: ["restaurant_id"] },
        { fields: ["order_number"], unique: true },
        { fields: ["status"] },
      ],
    },
  );

  FoodOrder.associate = function (models) {
    FoodOrder.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
    });
    FoodOrder.belongsTo(models.Restaurant, {
      foreignKey: "restaurant_id",
      as: "restaurant",
    });
    FoodOrder.hasMany(models.FoodOrderItem, {
      foreignKey: "order_id",
      as: "items",
    });
  };

  return FoodOrder;
};
