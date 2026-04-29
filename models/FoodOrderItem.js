const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const FoodOrderItem = sequelize.define(
    "FoodOrderItem",
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      order_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "food_orders",
          key: "id",
        },
      },
      item_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "food_items",
          key: "id",
        },
      },
      item_name_snapshot: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      unit_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      total_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
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
      tableName: "food_order_items",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { fields: ["order_id"] },
        { fields: ["item_id"] },
      ],
    },
  );

  FoodOrderItem.associate = function (models) {
    FoodOrderItem.belongsTo(models.FoodOrder, {
      foreignKey: "order_id",
      as: "order",
    });
    FoodOrderItem.belongsTo(models.FoodItem, {
      foreignKey: "item_id",
      as: "item",
    });
  };

  return FoodOrderItem;
};
