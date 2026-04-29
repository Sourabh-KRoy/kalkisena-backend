const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const {
  sequelize,
  Restaurant,
  FoodCategory,
  FoodItem,
  FoodCart,
  FoodCartItem,
  FoodOrder,
  FoodOrderItem,
  User,
  UserAddress,
} = require("../models");

const TAX_PERCENTAGE = 5;

const generateOrderNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `FO-${timestamp}-${random}`;
};

const buildDeliveryAddressString = (addressRow) => {
  const parts = [
    addressRow.address,
    addressRow.city,
    addressRow.state,
    addressRow.postal_code,
    addressRow.country,
  ].filter(Boolean);
  return parts.join(", ");
};

const calculateOrderTotals = (cartItems) => {
  const normalizedItems = cartItems.map((cartItem) => {
    const quantity = Number(cartItem.quantity);
    const unitPrice = Number(cartItem.item.price);
    const totalPrice = Number((quantity * unitPrice).toFixed(2));
    return {
      cart_item_id: cartItem.id,
      item_id: cartItem.item.id,
      item_name_snapshot: cartItem.item.name,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
    };
  });

  const subtotal = Number(
    normalizedItems.reduce((sum, item) => sum + Number(item.total_price), 0).toFixed(2),
  );
  const taxAmount = Number(((subtotal * TAX_PERCENTAGE) / 100).toFixed(2));
  const deliveryFee = subtotal >= 299 ? 0 : 30;
  const totalAmount = Number((subtotal + taxAmount + deliveryFee).toFixed(2));

  return { normalizedItems, subtotal, taxAmount, deliveryFee, totalAmount };
};

const resolveDeliveryAddress = async ({ addressId, deliveryAddress, userId, transaction }) => {
  if (addressId) {
    const savedAddress = await UserAddress.findOne({
      where: { id: addressId, user_id: userId },
      transaction,
    });
    if (!savedAddress) {
      return { error: "Selected address not found" };
    }
    return {
      addressText: buildDeliveryAddressString(savedAddress),
      selectedAddress: savedAddress,
    };
  }

  return {
    addressText: String(deliveryAddress || "").trim(),
    selectedAddress: null,
  };
};

const fetchCartByUser = async (userId, transaction = null) => {
  return FoodCart.findOne({
    where: { user_id: userId },
    include: [
      { model: Restaurant, as: "restaurant", attributes: ["id", "name", "address", "city"] },
      {
        model: FoodCartItem,
        as: "items",
        include: [
          {
            model: FoodItem,
            as: "item",
            attributes: ["id", "name", "price", "image_url", "is_veg", "is_available"],
          },
        ],
      },
    ],
    order: [[{ model: FoodCartItem, as: "items" }, "created_at", "ASC"]],
    transaction,
  });
};

const listRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.findAll({
      where: { is_active: true },
      attributes: ["id", "name", "description", "address", "city", "state", "pincode", "phone"],
      order: [["created_at", "DESC"]],
    });

    return res.json({
      success: true,
      message: "Restaurants fetched successfully",
      data: restaurants,
    });
  } catch (error) {
    console.error("List restaurants error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch restaurants",
      error: error.message,
    });
  }
};

const getRestaurantMenu = async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.restaurant_id, 10);
    if (Number.isNaN(restaurantId)) {
      return res.status(400).json({ success: false, message: "Invalid restaurant id" });
    }

    const restaurant = await Restaurant.findOne({
      where: { id: restaurantId, is_active: true },
      include: [
        {
          model: FoodCategory,
          as: "categories",
          where: { is_active: true },
          required: false,
          attributes: ["id", "name", "description"],
          include: [
            {
              model: FoodItem,
              as: "items",
              where: { is_available: true },
              required: false,
              attributes: ["id", "name", "description", "price", "image_url", "is_veg", "prep_time_minutes"],
              order: [["name", "ASC"]],
            },
          ],
        },
      ],
    });

    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    return res.json({
      success: true,
      message: "Restaurant menu fetched successfully",
      data: restaurant,
    });
  } catch (error) {
    console.error("Get restaurant menu error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch restaurant menu",
      error: error.message,
    });
  }
};

const addRestaurantCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    if (!["admin", "hotel"].includes(req.user.users_type)) {
      return res.status(403).json({
        success: false,
        message: "Only admin or hotel can add food category",
      });
    }

    const restaurantId = Number(req.params.restaurant_id);
    const { name, description, is_active } = req.body;

    const restaurant = await Restaurant.findOne({ where: { id: restaurantId, is_active: true } });
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    const category = await FoodCategory.create({
      restaurant_id: restaurantId,
      name: String(name).trim(),
      description: description || null,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
    });

    return res.status(201).json({
      success: true,
      message: "Category added successfully",
      data: category,
    });
  } catch (error) {
    console.error("Add restaurant category error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add category",
      error: error.message,
    });
  }
};

const addRestaurantItem = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    if (!["admin", "hotel"].includes(req.user.users_type)) {
      return res.status(403).json({
        success: false,
        message: "Only admin or hotel can add food item",
      });
    }

    const restaurantId = Number(req.params.restaurant_id);
    const {
      category_id,
      name,
      description,
      price,
      image_url,
      is_veg,
      is_available,
      prep_time_minutes,
    } = req.body;

    const restaurant = await Restaurant.findOne({ where: { id: restaurantId, is_active: true } });
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    const category = await FoodCategory.findOne({
      where: { id: category_id, restaurant_id: restaurantId, is_active: true },
    });
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found for this restaurant",
      });
    }

    const item = await FoodItem.create({
      restaurant_id: restaurantId,
      category_id: category.id,
      name: String(name).trim(),
      description: description || null,
      price: Number(price),
      image_url: image_url || null,
      is_veg: is_veg !== undefined ? Boolean(is_veg) : false,
      is_available: is_available !== undefined ? Boolean(is_available) : true,
      prep_time_minutes: prep_time_minutes || null,
    });

    return res.status(201).json({
      success: true,
      message: "Food item added successfully",
      data: item,
    });
  } catch (error) {
    console.error("Add restaurant item error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add food item",
      error: error.message,
    });
  }
};

const addItemToCart = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const userId = req.user.id;
    const { item_id, quantity } = req.body;

    const foodItem = await FoodItem.findOne({
      where: { id: item_id, is_available: true },
      include: [{ model: Restaurant, as: "restaurant", attributes: ["id", "name", "is_active"] }],
    });

    if (!foodItem || !foodItem.restaurant || !foodItem.restaurant.is_active) {
      return res.status(404).json({
        success: false,
        message: "Selected food item is not available",
      });
    }

    let cart = await FoodCart.findOne({ where: { user_id: userId } });
    if (!cart) {
      cart = await FoodCart.create({
        user_id: userId,
        restaurant_id: foodItem.restaurant_id,
      });
    }

    if (Number(cart.restaurant_id) !== Number(foodItem.restaurant_id)) {
      return res.status(400).json({
        success: false,
        message: "Cart contains items from another restaurant. Please clear cart first.",
      });
    }

    const existingCartItem = await FoodCartItem.findOne({
      where: { cart_id: cart.id, item_id: foodItem.id },
    });

    if (existingCartItem) {
      existingCartItem.quantity = existingCartItem.quantity + Number(quantity);
      await existingCartItem.save();
    } else {
      await FoodCartItem.create({
        cart_id: cart.id,
        item_id: foodItem.id,
        quantity: Number(quantity),
      });
    }

    const updatedCart = await fetchCartByUser(userId);
    const totals = calculateOrderTotals(updatedCart.items);

    return res.status(201).json({
      success: true,
      message: "Item added to cart",
      data: {
        cart: updatedCart,
        billing: {
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          delivery_fee: totals.deliveryFee,
          total_amount: totals.totalAmount,
        },
      },
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add item to cart",
      error: error.message,
    });
  }
};

const getMyCart = async (req, res) => {
  try {
    const cart = await fetchCartByUser(req.user.id);
    if (!cart || !cart.items.length) {
      return res.json({
        success: true,
        message: "Cart is empty",
        data: { cart: null, billing: null },
      });
    }

    const totals = calculateOrderTotals(cart.items);
    return res.json({
      success: true,
      message: "Cart fetched successfully",
      data: {
        cart,
        billing: {
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          delivery_fee: totals.deliveryFee,
          total_amount: totals.totalAmount,
        },
      },
    });
  } catch (error) {
    console.error("Get cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch cart",
      error: error.message,
    });
  }
};

const updateCartItemQuantity = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const cartItemId = Number(req.params.cart_item_id);
    const { quantity } = req.body;

    const cart = await FoodCart.findOne({ where: { user_id: req.user.id } });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const cartItem = await FoodCartItem.findOne({
      where: { id: cartItemId, cart_id: cart.id },
    });
    if (!cartItem) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }

    cartItem.quantity = Number(quantity);
    await cartItem.save();

    const updatedCart = await fetchCartByUser(req.user.id);
    const totals = calculateOrderTotals(updatedCart.items);
    return res.json({
      success: true,
      message: "Cart quantity updated",
      data: {
        cart: updatedCart,
        billing: {
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          delivery_fee: totals.deliveryFee,
          total_amount: totals.totalAmount,
        },
      },
    });
  } catch (error) {
    console.error("Update cart quantity error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update cart item",
      error: error.message,
    });
  }
};

const removeCartItem = async (req, res) => {
  try {
    const cartItemId = Number(req.params.cart_item_id);
    const cart = await FoodCart.findOne({ where: { user_id: req.user.id } });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const deletedCount = await FoodCartItem.destroy({
      where: { id: cartItemId, cart_id: cart.id },
    });
    if (!deletedCount) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }

    const remainingItems = await FoodCartItem.count({ where: { cart_id: cart.id } });
    if (remainingItems === 0) {
      await cart.destroy();
      return res.json({
        success: true,
        message: "Item removed. Cart is now empty",
        data: { cart: null, billing: null },
      });
    }

    const updatedCart = await fetchCartByUser(req.user.id);
    const totals = calculateOrderTotals(updatedCart.items);
    return res.json({
      success: true,
      message: "Item removed from cart",
      data: {
        cart: updatedCart,
        billing: {
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          delivery_fee: totals.deliveryFee,
          total_amount: totals.totalAmount,
        },
      },
    });
  } catch (error) {
    console.error("Remove cart item error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove cart item",
      error: error.message,
    });
  }
};

const clearCart = async (req, res) => {
  try {
    const cart = await FoodCart.findOne({ where: { user_id: req.user.id } });
    if (!cart) {
      return res.json({ success: true, message: "Cart already empty" });
    }
    await FoodCartItem.destroy({ where: { cart_id: cart.id } });
    await cart.destroy();
    return res.json({ success: true, message: "Cart cleared successfully" });
  } catch (error) {
    console.error("Clear cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear cart",
      error: error.message,
    });
  }
};

const proceedToPay = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { address_id, delivery_address, payment_method } = req.body;
    const cart = await fetchCartByUser(req.user.id);
    if (!cart || !cart.items.length) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const unavailableItem = cart.items.find((entry) => !entry.item || !entry.item.is_available);
    if (unavailableItem) {
      return res.status(400).json({
        success: false,
        message: "One or more cart items are unavailable. Please refresh cart.",
      });
    }

    const addressResult = await resolveDeliveryAddress({
      addressId: address_id,
      deliveryAddress: delivery_address,
      userId: req.user.id,
      transaction: null,
    });
    if (addressResult.error) {
      return res.status(404).json({ success: false, message: addressResult.error });
    }

    const totals = calculateOrderTotals(cart.items);
    return res.json({
      success: true,
      message: "Proceed to pay summary",
      data: {
        cart,
        billing: {
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          delivery_fee: totals.deliveryFee,
          total_amount: totals.totalAmount,
        },
        checkout: {
          payment_method,
          delivery_address: addressResult.addressText,
          selected_address: addressResult.selectedAddress
            ? {
                id: addressResult.selectedAddress.id,
                label: addressResult.selectedAddress.label,
                phone_number: addressResult.selectedAddress.phone_number,
                full_address: addressResult.addressText,
              }
            : null,
        },
      },
    });
  } catch (error) {
    console.error("Proceed to pay error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to proceed to pay",
      error: error.message,
    });
  }
};

const payAndPlaceOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { address_id, delivery_address, payment_method, notes } = req.body;
    const cart = await fetchCartByUser(req.user.id, transaction);
    if (!cart || !cart.items.length) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const addressResult = await resolveDeliveryAddress({
      addressId: address_id,
      deliveryAddress: delivery_address,
      userId: req.user.id,
      transaction,
    });
    if (addressResult.error) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: addressResult.error });
    }

    const unavailableItem = cart.items.find((entry) => !entry.item || !entry.item.is_available);
    if (unavailableItem) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "One or more cart items are unavailable. Please refresh cart.",
      });
    }

    const totals = calculateOrderTotals(cart.items);
    const paymentStatus = payment_method === "cash" ? "pending" : "paid";

    const order = await FoodOrder.create(
      {
        user_id: req.user.id,
        restaurant_id: cart.restaurant_id,
        order_number: generateOrderNumber(),
        status: "placed",
        payment_status: paymentStatus,
        payment_method,
        delivery_address: addressResult.addressText,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        delivery_fee: totals.deliveryFee,
        total_amount: totals.totalAmount,
        notes: notes || null,
        ordered_at: new Date(),
      },
      { transaction },
    );

    await FoodOrderItem.bulkCreate(
      totals.normalizedItems.map((item) => ({
        order_id: order.id,
        item_id: item.item_id,
        item_name_snapshot: item.item_name_snapshot,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      })),
      { transaction },
    );

    await FoodCartItem.destroy({ where: { cart_id: cart.id }, transaction });
    await FoodCart.destroy({ where: { id: cart.id }, transaction });
    await transaction.commit();

    const createdOrder = await FoodOrder.findByPk(order.id, {
      include: [
        { model: Restaurant, as: "restaurant", attributes: ["id", "name", "address", "city"] },
        {
          model: FoodOrderItem,
          as: "items",
          attributes: ["item_id", "item_name_snapshot", "quantity", "unit_price", "total_price"],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Payment received and order placed successfully",
      data: createdOrder,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Pay and place order error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to place order",
      error: error.message,
    });
  }
};

const addAddressForFood = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const userId = req.user.id;
    const { address, city, state, postal_code, country, phone_number, is_default, label } = req.body;

    if (is_default) {
      await UserAddress.update(
        { is_default: false },
        { where: { user_id: userId } },
      );
    }

    const newAddress = await UserAddress.create({
      user_id: userId,
      address,
      city,
      state,
      postal_code,
      country: country || "Nepal",
      phone_number: phone_number || req.user.phone || null,
      is_default: is_default || false,
      label: label || null,
    });

    return res.status(201).json({
      success: true,
      message: "Address added successfully",
      data: {
        ...newAddress.toJSON(),
        full_address: buildDeliveryAddressString(newAddress),
      },
    });
  } catch (error) {
    console.error("Add food address error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add address",
      error: error.message,
    });
  }
};

const getAddressListForFood = async (req, res) => {
  try {
    const addresses = await UserAddress.findAll({
      where: { user_id: req.user.id },
      order: [
        ["is_default", "DESC"],
        ["created_at", "DESC"],
      ],
      attributes: [
        "id",
        "label",
        "address",
        "city",
        "state",
        "postal_code",
        "country",
        "phone_number",
        "is_default",
      ],
    });

    return res.json({
      success: true,
      message: "Address list fetched successfully",
      data: addresses.map((address) => ({
        ...address.toJSON(),
        full_address: buildDeliveryAddressString(address),
      })),
    });
  } catch (error) {
    console.error("Get food address list error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch addresses",
      error: error.message,
    });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const restaurantId = req.query.restaurant_id ? Number(req.query.restaurant_id) : null;
    const status = req.query.status ? String(req.query.status).trim() : null;

    const whereClause = { user_id: req.user.id };
    if (restaurantId && !Number.isNaN(restaurantId)) {
      whereClause.restaurant_id = restaurantId;
    }
    if (status) {
      whereClause.status = { [Op.eq]: status };
    }

    const orders = await FoodOrder.findAll({
      where: whereClause,
      include: [
        { model: Restaurant, as: "restaurant", attributes: ["id", "name", "address", "city"] },
        { model: FoodOrderItem, as: "items", attributes: ["item_id", "item_name_snapshot", "quantity", "unit_price", "total_price"] },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.json({
      success: true,
      message: "Your orders fetched successfully",
      data: {
        total_orders: orders.length,
        orders,
      },
    });
  } catch (error) {
    console.error("Get my food orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch your orders",
      error: error.message,
    });
  }
};

const getAllOrders = async (req, res) => {
  try {
    if (req.user.users_type !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can view all orders",
      });
    }

    const orders = await FoodOrder.findAll({
      include: [
        { model: User, as: "user", attributes: ["id", "name", "email", "phone"] },
        { model: Restaurant, as: "restaurant", attributes: ["id", "name", "address", "city"] },
        { model: FoodOrderItem, as: "items", attributes: ["item_id", "item_name_snapshot", "quantity", "unit_price", "total_price"] },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.json({
      success: true,
      message: "All orders fetched successfully",
      data: {
        total_orders: orders.length,
        orders,
      },
    });
  } catch (error) {
    console.error("Get all food orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch all orders",
      error: error.message,
    });
  }
};

module.exports = {
  listRestaurants,
  getRestaurantMenu,
  addRestaurantCategory,
  addRestaurantItem,
  addItemToCart,
  getMyCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  addAddressForFood,
  getAddressListForFood,
  proceedToPay,
  payAndPlaceOrder,
  getMyOrders,
  getAllOrders,
};
