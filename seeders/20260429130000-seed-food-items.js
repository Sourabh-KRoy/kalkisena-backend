"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert("restaurants", [
      {
        id: 1001,
        name: "Bridge Lunch House",
        description: "Fresh meals, burgers, pizza and quick bites.",
        address: "Civil Lines, Prayagraj",
        city: "Prayagraj",
        state: "Uttar Pradesh",
        pincode: "211001",
        phone: "9876543210",
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 1002,
        name: "Green Bowl Kitchen",
        description: "Healthy bowls, wraps and low-oil meals.",
        address: "Tagore Town, Prayagraj",
        city: "Prayagraj",
        state: "Uttar Pradesh",
        pincode: "211002",
        phone: "9876500001",
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert("food_categories", [
      { id: 2001, restaurant_id: 1001, name: "Burgers", description: "Loaded and crispy burgers", is_active: true, created_at: now, updated_at: now },
      { id: 2002, restaurant_id: 1001, name: "Pizza", description: "Cheese loaded pizzas", is_active: true, created_at: now, updated_at: now },
      { id: 2003, restaurant_id: 1001, name: "Beverages", description: "Drinks and shakes", is_active: true, created_at: now, updated_at: now },
      { id: 2004, restaurant_id: 1002, name: "Healthy Bowls", description: "Balanced nutrition bowls", is_active: true, created_at: now, updated_at: now },
      { id: 2005, restaurant_id: 1002, name: "Wraps", description: "Quick and filling wraps", is_active: true, created_at: now, updated_at: now },
    ]);

    await queryInterface.bulkInsert("food_items", [
      {
        restaurant_id: 1001,
        category_id: 2001,
        name: "Chicken Burger",
        description: "Juicy grilled chicken patty with fresh lettuce.",
        price: 149.0,
        image_url: null,
        is_veg: false,
        is_available: true,
        prep_time_minutes: 18,
        created_at: now,
        updated_at: now,
      },
      {
        restaurant_id: 1001,
        category_id: 2001,
        name: "Veg Crunch Burger",
        description: "Crispy veg patty with tangy sauce.",
        price: 119.0,
        image_url: null,
        is_veg: true,
        is_available: true,
        prep_time_minutes: 15,
        created_at: now,
        updated_at: now,
      },
      {
        restaurant_id: 1001,
        category_id: 2002,
        name: "Farmhouse Pizza",
        description: "Onion, capsicum, sweet corn and mozzarella.",
        price: 259.0,
        image_url: null,
        is_veg: true,
        is_available: true,
        prep_time_minutes: 22,
        created_at: now,
        updated_at: now,
      },
      {
        restaurant_id: 1001,
        category_id: 2002,
        name: "Chicken Tikka Pizza",
        description: "Smoky chicken tikka with onions and cheese.",
        price: 299.0,
        image_url: null,
        is_veg: false,
        is_available: true,
        prep_time_minutes: 24,
        created_at: now,
        updated_at: now,
      },
      {
        restaurant_id: 1001,
        category_id: 2003,
        name: "Cold Coffee",
        description: "Chilled creamy coffee.",
        price: 99.0,
        image_url: null,
        is_veg: true,
        is_available: true,
        prep_time_minutes: 7,
        created_at: now,
        updated_at: now,
      },
      {
        restaurant_id: 1002,
        category_id: 2004,
        name: "Paneer Protein Bowl",
        description: "Paneer, quinoa, veggies and mint yogurt dip.",
        price: 219.0,
        image_url: null,
        is_veg: true,
        is_available: true,
        prep_time_minutes: 17,
        created_at: now,
        updated_at: now,
      },
      {
        restaurant_id: 1002,
        category_id: 2004,
        name: "Chicken Brown Rice Bowl",
        description: "Grilled chicken, brown rice and sauteed veggies.",
        price: 249.0,
        image_url: null,
        is_veg: false,
        is_available: true,
        prep_time_minutes: 19,
        created_at: now,
        updated_at: now,
      },
      {
        restaurant_id: 1002,
        category_id: 2005,
        name: "Peri Peri Paneer Wrap",
        description: "Soft wrap loaded with paneer and fresh salad.",
        price: 169.0,
        image_url: null,
        is_veg: true,
        is_available: true,
        prep_time_minutes: 14,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "DELETE FROM food_items WHERE restaurant_id IN (1001, 1002);",
    );
    await queryInterface.sequelize.query(
      "DELETE FROM food_categories WHERE id IN (2001, 2002, 2003, 2004, 2005);",
    );
    await queryInterface.sequelize.query(
      "DELETE FROM restaurants WHERE id IN (1001, 1002);",
    );
  },
};
