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

// Basic user routes
router.get('/', protect, getUsers);
router.get('/stats', [protect, isAdmin], getUserStats);
router.get('/team-stats', [protect, isAdmin], getDailyTeamStats);

// Performance routes
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

// Individual user routes
router.get('/:id', [protect, ownerOrAdmin], getUserById);
router.post('/', [protect, isAdmin], createUser);
router.put('/:id', [protect, ownerOrAdmin], updateUser);
router.put('/:id/permissions', [protect, isAdmin], updateUserPermissions);
router.delete('/:id', [protect, isAdmin], deleteUser);

// Agent performance routes
router.get('/:id/performance', [
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

router.put('/:id/performance', [
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

module.exports = router; 