const express = require('express');
const { body, query } = require('express-validator');
const { protect, isAdmin, ownerOrAdmin } = require('../middleware/auth');
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserPermissions,
  deleteUser,
  getUserStats,
  getAgentPerformance,
  updateAgentPerformance,
  getTopPerformers,
  getDailyTeamStats
} = require('../controllers/users');

const router = express.Router();

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private (Admin)
router.get('/stats', [
  protect,
  isAdmin
], getUserStats);

// @route   GET /api/users/top-performers
// @desc    Get top performing agents
// @access  Private (Admin)
router.get('/top-performers', [
  protect,
  isAdmin,
  query('period')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Period must be between 1 and 365 days'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
], getTopPerformers);

// @route   GET /api/users/team-stats
// @desc    Get daily team statistics
// @access  Private (Admin)
router.get('/team-stats', [
  protect,
  isAdmin,
  query('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO date')
], getDailyTeamStats);

// @route   GET /api/users
// @desc    Get all users with filtering
// @access  Private (Admin)
router.get('/', [
  protect,
  isAdmin,
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('role')
    .optional()
    .isIn(['admin', 'affiliate_manager', 'agent'])
    .withMessage('Role must be admin, affiliate_manager, or agent'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
], getUsers);

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private (Admin)
router.get('/:id', [
  protect,
  isAdmin
], getUserById);

// @route   POST /api/users
// @desc    Create new user
// @access  Private (Admin)
router.post('/', [
  protect,
  isAdmin,
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please include a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('fullName')
    .trim()
    .notEmpty()
    .isLength({ min: 2 })
    .withMessage('Full name is required and must be at least 2 characters'),
  body('role')
    .isIn(['admin', 'affiliate_manager', 'agent'])
    .withMessage('Role must be admin, affiliate_manager, or agent'),
  body('fourDigitCode')
    .if(body('role').equals('agent'))
    .isLength({ min: 4, max: 4 })
    .isNumeric()
    .withMessage('Agents must have a 4-digit numeric code')
], createUser);

// @route   PUT /api/users/:id
// @desc    Update user details
// @access  Private (Admin)
router.put('/:id', [
  protect,
  isAdmin,
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please include a valid email'),
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Full name must be at least 2 characters'),
  body('role')
    .optional()
    .isIn(['admin', 'affiliate_manager', 'agent'])
    .withMessage('Role must be admin, affiliate_manager, or agent'),
  body('fourDigitCode')
    .optional()
    .isLength({ min: 4, max: 4 })
    .isNumeric()
    .withMessage('Four digit code must be exactly 4 numeric characters'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
], updateUser);

// @route   PUT /api/users/:id/permissions
// @desc    Update user permissions
// @access  Private (Admin)
router.put('/:id/permissions', [
  protect,
  isAdmin,
  body('permissions.canCreateOrders')
    .optional()
    .isBoolean()
    .withMessage('canCreateOrders must be a boolean')
], updateUserPermissions);

// @route   DELETE /api/users/:id
// @desc    Delete user (soft delete - set inactive)
// @access  Private (Admin)
router.delete('/:id', [
  protect,
  isAdmin
], deleteUser);

// Performance-related routes

// @route   GET /api/users/agents/performance
// @desc    Get performance data for all agents
// @access  Private (Admin)
router.get('/agents/performance', [
  protect,
  isAdmin,
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO date'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
], getAgentPerformance);

// @route   GET /api/users/agents/:agentId/performance
// @desc    Get performance data for a specific agent
// @access  Private (Agent - own data only, Admin)
router.get('/agents/:agentId/performance', [
  protect,
  ownerOrAdmin,
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO date')
], getAgentPerformance);

// @route   POST /api/users/agents/:agentId/performance
// @desc    Update/create performance data for an agent
// @access  Private (Agent - own data only, Admin)
router.post('/agents/:agentId/performance', [
  protect,
  ownerOrAdmin,
  body('date')
    .isISO8601()
    .withMessage('Date must be a valid ISO date'),
  body('callTimeMinutes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Call time must be a non-negative integer'),
  body('earnings')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Earnings must be a non-negative number'),
  body('penalties')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Penalties must be a non-negative number'),
  body('leadsContacted')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Leads contacted must be a non-negative integer'),
  body('leadsConverted')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Leads converted must be a non-negative integer'),
  body('callsCompleted')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Calls completed must be a non-negative integer')
], updateAgentPerformance);

// @route   GET /api/users/agents/top-performers
// @desc    Get top performing agents
// @access  Private (Admin)
router.get('/agents/top-performers', [
  protect,
  isAdmin,
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO date'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
], getTopPerformers);

// @route   GET /api/users/agents/daily-stats
// @desc    Get daily team statistics
// @access  Private (Admin)
router.get('/agents/daily-stats', [
  protect,
  isAdmin,
  query('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO date')
], getDailyTeamStats);

module.exports = router; 