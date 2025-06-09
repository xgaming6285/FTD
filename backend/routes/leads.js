const express = require('express');
const { body, query } = require('express-validator');
const { protect, isAdmin, isAgent, authorize } = require('../middleware/auth');
const {
  getLeads,
  getAssignedLeads,
  getLeadById,
  addComment,
  updateLeadStatus,
  getLeadStats,
  assignLeads,
  unassignLeads
} = require('../controllers/leads');

const router = express.Router();

// @route   GET /api/leads
// @desc    Get leads with advanced filtering (Admin only)
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
  query('leadType')
    .optional()
    .isIn(['ftd', 'filler', 'cold'])
    .withMessage('Lead type must be ftd, filler, or cold'),
  query('country')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Country must be at least 2 characters'),
  query('isAssigned')
    .optional()
    .isBoolean()
    .withMessage('isAssigned must be a boolean'),
  query('documentStatus')
    .optional()
    .isIn(['good', 'ok', 'pending'])
    .withMessage('Document status must be good, ok, or pending'),
  query('status')
    .optional()
    .isIn(['active', 'contacted', 'converted', 'inactive'])
    .withMessage('Status must be active, contacted, converted, or inactive')
], getLeads);

// @route   GET /api/leads/assigned
// @desc    Get leads assigned to the logged-in agent
// @access  Private (Agent)
router.get('/assigned', [
  protect,
  isAgent,
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('leadType')
    .optional()
    .isIn(['ftd', 'filler', 'cold'])
    .withMessage('Lead type must be ftd, filler, or cold'),
  query('status')
    .optional()
    .isIn(['active', 'contacted', 'converted', 'inactive'])
    .withMessage('Status must be active, contacted, converted, or inactive')
], getAssignedLeads);

// @route   GET /api/leads/stats
// @desc    Get lead statistics
// @access  Private (Admin)
router.get('/stats', [
  protect,
  isAdmin
], getLeadStats);

// @route   GET /api/leads/:id
// @desc    Get lead by ID
// @access  Private (Admin or assigned agent)
router.get('/:id', [
  protect,
  authorize('admin', 'affiliate_manager', 'agent')
], getLeadById);

// @route   PUT /api/leads/:id/comment
// @desc    Add a comment to a specific lead
// @access  Private (All roles)
router.put('/:id/comment', [
  protect,
  body('text')
    .trim()
    .notEmpty()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment text is required and must be less than 1000 characters')
], addComment);

// @route   PUT /api/leads/:id/status
// @desc    Update lead status
// @access  Private (Admin or assigned agent)
router.put('/:id/status', [
  protect,
  authorize('admin', 'affiliate_manager', 'agent'),
  body('status')
    .isIn(['active', 'contacted', 'converted', 'inactive'])
    .withMessage('Status must be active, contacted, converted, or inactive')
], updateLeadStatus);

// @route   POST /api/leads/assign
// @desc    Manually assign leads to agents
// @access  Private (Admin, Manager)
router.post('/assign', [
  protect,
  authorize('admin', 'affiliate_manager'),
  body('leadIds')
    .isArray({ min: 1 })
    .withMessage('leadIds must be a non-empty array'),
  body('leadIds.*')
    .isMongoId()
    .withMessage('Each leadId must be a valid MongoDB ObjectId'),
  body('agentId')
    .isMongoId()
    .withMessage('agentId must be a valid MongoDB ObjectId')
], assignLeads);

// @route   POST /api/leads/unassign
// @desc    Unassign leads from agents
// @access  Private (Admin, Manager)
router.post('/unassign', [
  protect,
  authorize('admin', 'affiliate_manager'),
  body('leadIds')
    .isArray({ min: 1 })
    .withMessage('leadIds must be a non-empty array'),
  body('leadIds.*')
    .isMongoId()
    .withMessage('Each leadId must be a valid MongoDB ObjectId')
], unassignLeads);

module.exports = router; 