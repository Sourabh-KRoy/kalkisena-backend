const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const FoodCart = sequelize.define(
    "FoodCart",
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
      tableName: "food_carts",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [{ fields: ["user_id"] }, { fields: ["restaurant_id"] }],
    },
  );

  FoodCart.associate = function (models) {
    FoodCart.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
    FoodCart.belongsTo(models.Restaurant, { foreignKey: "restaurant_id", as: "restaurant" });
    FoodCart.hasMany(models.FoodCartItem, { foreignKey: "cart_id", as: "items" });
  };

  return FoodCart;
};
