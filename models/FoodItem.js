const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const FoodItem = sequelize.define(
    "FoodItem",
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
      category_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "food_categories",
          key: "id",
        },
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      image_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      is_veg: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_available: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      prep_time_minutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
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
      tableName: "food_items",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { fields: ["restaurant_id"] },
        { fields: ["category_id"] },
        { fields: ["is_available"] },
      ],
    },
  );

  FoodItem.associate = function (models) {
    FoodItem.belongsTo(models.Restaurant, {
      foreignKey: "restaurant_id",
      as: "restaurant",
    });
    FoodItem.belongsTo(models.FoodCategory, {
      foreignKey: "category_id",
      as: "category",
    });
    FoodItem.hasMany(models.FoodOrderItem, {
      foreignKey: "item_id",
      as: "orderItems",
    });
  };

  return FoodItem;
};
