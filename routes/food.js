const express = require("express");
const { body, param, query } = require("express-validator");
const foodController = require("../controllers/foodController");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

const addToCartValidation = [
  body("item_id")
    .notEmpty()
    .withMessage("item_id is required")
    .isInt({ min: 1 })
    .withMessage("item_id must be a valid integer"),
  body("quantity")
    .notEmpty()
    .withMessage("quantity is required")
    .isInt({ min: 1, max: 50 })
    .withMessage("quantity must be between 1 and 50"),
];

const updateCartItemValidation = [
  param("cart_item_id")
    .notEmpty()
    .withMessage("cart_item_id is required")
    .isInt({ min: 1 })
    .withMessage("cart_item_id must be a valid integer"),
  body("quantity")
    .notEmpty()
    .withMessage("quantity is required")
    .isInt({ min: 1, max: 50 })
    .withMessage("quantity must be between 1 and 50"),
];

const checkoutValidation = [
  body("address_id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("address_id must be a valid integer")
    .custom((value, { req }) => {
      if (value && req.body.delivery_address) {
        throw new Error("Provide either address_id or delivery_address, not both");
      }
      return true;
    }),
  body("delivery_address")
    .optional()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage("delivery_address must be between 5 and 500 characters")
    .custom((value, { req }) => {
      if (!req.body.address_id && !value) {
        throw new Error("Either address_id or delivery_address is required");
      }
      return true;
    }),
  body("payment_method")
    .notEmpty()
    .withMessage("payment_method is required")
    .isIn(["cash", "upi", "card", "wallet"])
    .withMessage("payment_method must be cash, upi, card, or wallet"),
];

const payNowValidation = [
  ...checkoutValidation,
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("notes must be less than 1000 characters"),
];

const addAddressValidation = [
  body("address")
    .trim()
    .notEmpty()
    .withMessage("address is required")
    .isLength({ min: 5, max: 500 })
    .withMessage("address must be between 5 and 500 characters"),
  body("city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("city must be less than 100 characters"),
  body("state")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("state must be less than 100 characters"),
  body("postal_code")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("postal_code must be less than 20 characters"),
  body("country")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("country must be less than 100 characters"),
  body("phone_number")
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage("Please provide a valid phone number"),
  body("is_default")
    .optional()
    .isBoolean()
    .withMessage("is_default must be a boolean"),
  body("label")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("label must be less than 50 characters"),
];

const addCategoryValidation = [
  param("restaurant_id")
    .notEmpty()
    .withMessage("restaurant_id is required")
    .isInt({ min: 1 })
    .withMessage("restaurant_id must be a valid integer"),
  body("name")
    .trim()
    .notEmpty()
    .withMessage("name is required")
    .isLength({ min: 2, max: 150 })
    .withMessage("name must be between 2 and 150 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("description must be less than 1000 characters"),
  body("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active must be a boolean"),
];

const addRestaurantItemValidation = [
  param("restaurant_id")
    .notEmpty()
    .withMessage("restaurant_id is required")
    .isInt({ min: 1 })
    .withMessage("restaurant_id must be a valid integer"),
  body("category_id")
    .notEmpty()
    .withMessage("category_id is required")
    .isInt({ min: 1 })
    .withMessage("category_id must be a valid integer"),
  body("name")
    .trim()
    .notEmpty()
    .withMessage("name is required")
    .isLength({ min: 2, max: 255 })
    .withMessage("name must be between 2 and 255 characters"),
  body("price")
    .notEmpty()
    .withMessage("price is required")
    .isFloat({ min: 1 })
    .withMessage("price must be greater than 0"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("description must be less than 2000 characters"),
  body("image_url")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("image_url must be less than 500 characters"),
  body("is_veg")
    .optional()
    .isBoolean()
    .withMessage("is_veg must be a boolean"),
  body("is_available")
    .optional()
    .isBoolean()
    .withMessage("is_available must be a boolean"),
  body("prep_time_minutes")
    .optional()
    .isInt({ min: 1, max: 180 })
    .withMessage("prep_time_minutes must be between 1 and 180"),
];

const getMyOrdersValidation = [
  query("restaurant_id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("restaurant_id must be a valid integer"),
  query("status")
    .optional()
    .isIn(["placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"])
    .withMessage("status is invalid"),
];

router.get("/restaurants", foodController.listRestaurants);
router.get(
  "/restaurants/:restaurant_id/menu",
  [
    param("restaurant_id")
      .notEmpty()
      .withMessage("restaurant_id is required")
      .isInt({ min: 1 })
      .withMessage("restaurant_id must be a valid integer"),
  ],
  foodController.getRestaurantMenu,
);
router.post(
  "/restaurants/:restaurant_id/categories",
  authenticateToken,
  addCategoryValidation,
  foodController.addRestaurantCategory,
);
router.post(
  "/restaurants/:restaurant_id/items",
  authenticateToken,
  addRestaurantItemValidation,
  foodController.addRestaurantItem,
);
router.post("/cart/items", authenticateToken, addToCartValidation, foodController.addItemToCart);
router.get("/cart", authenticateToken, foodController.getMyCart);
router.patch(
  "/cart/items/:cart_item_id",
  authenticateToken,
  updateCartItemValidation,
  foodController.updateCartItemQuantity,
);
router.delete(
  "/cart/items/:cart_item_id",
  authenticateToken,
  [param("cart_item_id").isInt({ min: 1 }).withMessage("cart_item_id must be a valid integer")],
  foodController.removeCartItem,
);
router.delete("/cart", authenticateToken, foodController.clearCart);
router.get("/addresses", authenticateToken, foodController.getAddressListForFood);
router.post("/addresses", authenticateToken, addAddressValidation, foodController.addAddressForFood);
router.post("/checkout/proceed", authenticateToken, checkoutValidation, foodController.proceedToPay);
router.post("/checkout/pay", authenticateToken, payNowValidation, foodController.payAndPlaceOrder);
router.get("/orders/my", authenticateToken, getMyOrdersValidation, foodController.getMyOrders);
router.get("/orders/all", authenticateToken, foodController.getAllOrders);

module.exports = router;
