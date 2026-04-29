"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("food_carts", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      restaurant_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "restaurants", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("food_cart_items", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      cart_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "food_carts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      item_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "food_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("food_carts", ["user_id"], { unique: true });
    await queryInterface.addIndex("food_carts", ["restaurant_id"]);
    await queryInterface.addIndex("food_cart_items", ["cart_id"]);
    await queryInterface.addIndex("food_cart_items", ["item_id"]);
    await queryInterface.addIndex("food_cart_items", ["cart_id", "item_id"], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("food_cart_items");
    await queryInterface.dropTable("food_carts");
  },
};
