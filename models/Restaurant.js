const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Restaurant = sequelize.define(
    "Restaurant",
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      city: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      state: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      pincode: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING(20),
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
      tableName: "restaurants",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { fields: ["name"] },
        { fields: ["city"] },
        { fields: ["is_active"] },
      ],
    },
  );

  Restaurant.associate = function (models) {
    Restaurant.hasMany(models.FoodCategory, {
      foreignKey: "restaurant_id",
      as: "categories",
    });
    Restaurant.hasMany(models.FoodItem, {
      foreignKey: "restaurant_id",
      as: "items",
    });
    Restaurant.hasMany(models.FoodOrder, {
      foreignKey: "restaurant_id",
      as: "orders",
    });
  };

  return Restaurant;
};
