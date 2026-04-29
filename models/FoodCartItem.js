const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const FoodCartItem = sequelize.define(
    "FoodCartItem",
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      cart_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "food_carts",
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
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
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
      tableName: "food_cart_items",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [{ fields: ["cart_id"] }, { fields: ["item_id"] }],
    },
  );

  FoodCartItem.associate = function (models) {
    FoodCartItem.belongsTo(models.FoodCart, { foreignKey: "cart_id", as: "cart" });
    FoodCartItem.belongsTo(models.FoodItem, { foreignKey: "item_id", as: "item" });
  };

  return FoodCartItem;
};
