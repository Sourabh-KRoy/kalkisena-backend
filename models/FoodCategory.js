const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const FoodCategory = sequelize.define(
    "FoodCategory",
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      restaurant_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "restaurants",
          key: "id",
        },
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
      tableName: "food_categories",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { fields: ["restaurant_id"] },
        { fields: ["name"] },
        { fields: ["is_active"] },
      ],
    },
  );

  FoodCategory.associate = function (models) {
    FoodCategory.belongsTo(models.Restaurant, {
      foreignKey: "restaurant_id",
      as: "restaurant",
    });
    FoodCategory.hasMany(models.FoodItem, {
      foreignKey: "category_id",
      as: "items",
    });
  };

  return FoodCategory;
};
