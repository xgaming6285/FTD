const express = require("express");
const { body, query } = require("express-validator");
const { protect, isManager, hasPermission } = require("../middleware/auth");
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  cancelOrder,
  getOrderStats,
} = require("../controllers/orders");

const router = express.Router();

// @route   POST /api/orders
// @desc    Create a new order and pull leads
// @access  Private (Admin, Manager with canCreateOrders permission)
router.post(
  "/",
  [
    protect,
    isManager,
    hasPermission("canCreateOrders"),
    body("requests.ftd")
      .optional()
      .isInt({ min: 0 })
      .withMessage("FTD request must be a non-negative integer"),
    body("requests.filler")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Filler request must be a non-negative integer"),
    body("requests.cold")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Cold request must be a non-negative integer"),
    body("priority")
      .optional()
      .isIn(["low", "medium", "high"])
      .withMessage("Priority must be low, medium, or high"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Notes must be less than 500 characters"),
    body("country")
      .optional({ nullable: true })
      .trim()
      .custom((value) => {
        if (value === null || value === "") {
          return true;
        }
        if (value.length < 2) {
          throw new Error("Country must be at least 2 characters");
        }
        return true;
      }),
    body("gender")
      .optional({ nullable: true })
      .custom((value) => {
        if (value === null || value === "") {
          return true;
        }
        if (!["male", "female", "not_defined"].includes(value)) {
          throw new Error("Gender must be male, female, or not_defined");
        }
        return true;
      }),
  ],
  createOrder
);

// @route   GET /api/orders
// @desc    Get orders (Admin sees all, Manager sees own)
// @access  Private (Admin, Manager)
router.get(
  "/",
  [
    protect,
    isManager,
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("status")
      .optional()
      .isIn(["fulfilled", "partial", "pending", "cancelled"])
      .withMessage("Status must be fulfilled, partial, pending, or cancelled"),
    query("priority")
      .optional()
      .isIn(["low", "medium", "high"])
      .withMessage("Priority must be low, medium, or high"),
  ],
  getOrders
);

// @route   GET /api/orders/stats
// @desc    Get order statistics
// @access  Private (Admin, Manager)
router.get(
  "/stats",
  [
    protect,
    isManager,
    query("startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid ISO date"),
    query("endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid ISO date"),
  ],
  getOrderStats
);

// @route   GET /api/orders/:id
// @desc    Get order by ID with populated lead info
// @access  Private (Admin, Manager - own orders only)
router.get("/:id", [protect, isManager], getOrderById);

// @route   PUT /api/orders/:id
// @desc    Update order details
// @access  Private (Admin, Manager - own orders only)
router.put(
  "/:id",
  [
    protect,
    isManager,
    body("priority")
      .optional()
      .isIn(["low", "medium", "high"])
      .withMessage("Priority must be low, medium, or high"),
    body("notes")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Notes must be less than 500 characters"),
  ],
  updateOrder
);

// @route   DELETE /api/orders/:id
// @desc    Cancel order
// @access  Private (Admin, Manager - own orders only)
router.delete(
  "/:id",
  [
    protect,
    isManager,
    body("reason")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Cancellation reason must be less than 200 characters"),
  ],
  cancelOrder
);

module.exports = router;
