"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("restaurants", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      address: { type: Sequelize.TEXT, allowNull: false },
      city: { type: Sequelize.STRING(120), allowNull: false },
      state: { type: Sequelize.STRING(120), allowNull: true },
      pincode: { type: Sequelize.STRING(20), allowNull: true },
      phone: { type: Sequelize.STRING(20), allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("food_categories", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      restaurant_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "restaurants", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      name: { type: Sequelize.STRING(150), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("food_items", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      restaurant_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "restaurants", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      category_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "food_categories", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      name: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      image_url: { type: Sequelize.STRING(500), allowNull: true },
      is_veg: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_available: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      prep_time_minutes: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("food_orders", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      restaurant_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "restaurants", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      order_number: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      status: {
        type: Sequelize.ENUM("placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"),
        allowNull: false,
        defaultValue: "placed",
      },
      payment_status: {
        type: Sequelize.ENUM("pending", "paid", "failed"),
        allowNull: false,
        defaultValue: "pending",
      },
      payment_method: { type: Sequelize.ENUM("cash", "upi", "card", "wallet"), allowNull: true },
      delivery_address: { type: Sequelize.TEXT, allowNull: false },
      subtotal: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      tax_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      delivery_fee: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      total_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      notes: { type: Sequelize.TEXT, allowNull: true },
      ordered_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("food_order_items", {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      order_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "food_orders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      item_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: "food_items", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      item_name_snapshot: { type: Sequelize.STRING(255), allowNull: false },
      quantity: { type: Sequelize.INTEGER, allowNull: false },
      unit_price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      total_price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("restaurants", ["name"]);
    await queryInterface.addIndex("restaurants", ["city"]);
    await queryInterface.addIndex("food_categories", ["restaurant_id"]);
    await queryInterface.addIndex("food_items", ["restaurant_id"]);
    await queryInterface.addIndex("food_items", ["category_id"]);
    await queryInterface.addIndex("food_orders", ["user_id"]);
    await queryInterface.addIndex("food_orders", ["restaurant_id"]);
    await queryInterface.addIndex("food_orders", ["status"]);
    await queryInterface.addIndex("food_order_items", ["order_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("food_order_items");
    await queryInterface.dropTable("food_orders");
    await queryInterface.dropTable("food_items");
    await queryInterface.dropTable("food_categories");
    await queryInterface.dropTable("restaurants");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_food_orders_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_food_orders_payment_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_food_orders_payment_method";');
  },
};
