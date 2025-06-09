const { validationResult } = require("express-validator");
const User = require("../models/User");
const AgentPerformance = require("../models/AgentPerformance");

// @desc    Get all users with optional filtering
// @route   GET /api/users
// @access  Private (Admin only)
exports.getUsers = async (req, res, next) => {
  try {
    const { role, isActive, page = 1, limit = 10 } = req.query;


    // Build filter object
    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // Calculate pagination
    const skip = (page - 1) * limit;


    // Get users with pagination
    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));


    // Get total count for pagination
    const total = await User.countDocuments(filter);


    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private (Admin only)
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }


    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new user
// @route   POST /api/users
// @access  Private (Admin only)
exports.createUser = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { email, password, fullName, role, fourDigitCode, permissions } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }


    // Create user object
    const userData = {
      email,
      password,
      fullName,
      role,
      permissions: permissions || { canCreateOrders: true },
    };


    // Add fourDigitCode if provided (for agents)
    if (fourDigitCode) {
      // Check if fourDigitCode is already in use
      const existingCode = await User.findOne({ fourDigitCode });
      if (existingCode) {
        return res.status(400).json({
          success: false,
          message: "Four digit code already in use",
        });
      }
      userData.fourDigitCode = fourDigitCode;
    }


    const user = await User.create(userData);


    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin only)
exports.updateUser = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const { fullName, email, role, fourDigitCode, isActive } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }


    // Check if email is being changed and if it's already in use
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }
    }


    // Check if fourDigitCode is being changed and if it's already in use
    if (fourDigitCode && fourDigitCode !== user.fourDigitCode) {
      const existingCode = await User.findOne({ fourDigitCode });
      if (existingCode) {
        return res.status(400).json({
          success: false,
          message: "Four digit code already in use",
        });
      }
    }


    // Build update object
    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (fourDigitCode) updateData.fourDigitCode = fourDigitCode;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );


    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user permissions
// @route   PUT /api/users/:id/permissions
// @access  Private (Admin only)
exports.updateUserPermissions = async (req, res, next) => {
  try {
    const { permissions } = req.body;

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({
        success: false,
        message: "Valid permissions object is required",
      });
    }


    const user = await User.findByIdAndUpdate(
      req.params.id,
      { permissions },
      { new: true, runValidators: true }
    );


    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }


    res.status(200).json({
      success: true,
      message: "User permissions updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user (soft delete - deactivate)
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );


    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }


    res.status(200).json({
      success: true,
      message: "User deactivated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private (Admin only)
exports.getUserStats = async (req, res, next) => {
  try {
    // Get total user counts by role
    const userStats = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
          active: {
            $sum: {
              $cond: [{ $eq: ["$isActive", true] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Get total counts
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const newUsersThisMonth = await User.countDocuments({
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    });

    // Format the response
    const stats = {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      newThisMonth: newUsersThisMonth,
      byRole: {},
    };

    // Organize stats by role
    userStats.forEach((stat) => {
      stats.byRole[stat._id] = {
        total: stat.count,
        active: stat.active,
        inactive: stat.count - stat.active,
      };
    });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get agent performance
// @route   GET /api/users/:id/performance
// @access  Private (Admin/Agent themselves)
exports.getAgentPerformance = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    // Get the agent ID from req.params.id to match the route parameter
    const agentId = req.params.id;

    // This authorization check now works correctly
    if (req.user.role !== 'admin' && req.user.id !== agentId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this performance data",
      });
    }

    // Build date filter
    const dateFilter = { agent: agentId };
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = new Date(startDate);
      if (endDate) dateFilter.date.$lte = new Date(endDate);
    }


    const performance = await AgentPerformance.find(dateFilter)
      .populate("agent", "fullName fourDigitCode")
      .sort({ date: -1 });


    res.status(200).json({
      success: true,
      data: performance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update agent performance
// @route   PUT /api/users/:id/performance
// @access  Private (Admin only)
exports.updateAgentPerformance = async (req, res, next) => {
  try {
    const { date, metrics } = req.body;
    const agentId = req.params.id;


    if (!date || !metrics) {
      return res.status(400).json({
        success: false,
        message: "Date and metrics are required",
      });
    }


    // Check if agent exists
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== "agent") {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }


    // Upsert performance record
    const performance = await AgentPerformance.findOneAndUpdate(
      { agentId, date: new Date(date) },
      { ...metrics },
      { upsert: true, new: true, runValidators: true }
    ).populate('agentId', 'fullName fourDigitCode');

    res.status(200).json({
      success: true,
      message: "Agent performance updated successfully",
      data: performance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get top performers
// @route   GET /api/users/performance/top
// @access  Private (Admin only)
exports.getTopPerformers = async (req, res, next) => {
  try {
    const { period = '30', limit = 10 } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(period));


    const topPerformers = await AgentPerformance.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$agent",
          totalCalls: { $sum: "$callsCompleted" },
          totalEarnings: { $sum: "$earnings" },
          totalLeadsConverted: { $sum: "$leadsConverted" },
          totalLeadsContacted: { $sum: "$leadsContacted" },
          averageCallQuality: {
            $avg: { $divide: ["$leadsConverted", "$leadsContacted"] },
          },
          recordCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "agent",
        },
      },
      {
        $unwind: "$agent",
      },
      {
        $project: {
          agent: {
            id: "$agent._id",
            fullName: "$agent.fullName",
            fourDigitCode: "$agent.fourDigitCode",
          },
          totalCalls: 1,
          totalEarnings: 1,
          totalLeadsConverted: 1,
          totalLeadsContacted: 1,
          averageCallQuality: { $round: ["$averageCallQuality", 2] },
          recordCount: 1,
        },
      },
      {
        $sort: { totalEarnings: -1 },
      },
      {
        $limit: parseInt(limit),
      },
    ]);


    res.status(200).json({
      success: true,
      data: topPerformers,
      period: `Last ${period} days`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get daily team stats
// @route   GET /api/users/performance/team-stats
// @access  Private (Admin only)
exports.getDailyTeamStats = async (req, res, next) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;

    const targetDate = new Date(date);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);


    const teamStats = await AgentPerformance.aggregate([
      {
        $match: {
          date: { $gte: targetDate, $lt: nextDay },
        },
      },
      {
        $group: {
          _id: null,
          totalAgents: { $sum: 1 },
          totalCalls: { $sum: "$metrics.callsMade" },
          totalEarnings: { $sum: "$metrics.earnings" },
          totalFTDs: { $sum: "$metrics.ftdCount" },
          totalFillers: { $sum: "$metrics.fillerCount" },
          averageCallQuality: { $avg: "$metrics.averageCallQuality" },
        },
      },
      {
        $project: {
          _id: 0,
          totalAgents: 1,
          totalCalls: 1,
          totalEarnings: { $round: ["$totalEarnings", 2] },
          totalFTDs: 1,
          totalFillers: 1,
          averageCallQuality: { $round: ["$averageCallQuality", 2] },
        },
      },
    ]);


    const stats = teamStats[0] || {
      totalAgents: 0,
      totalCalls: 0,
      totalEarnings: 0,
      totalFTDs: 0,
      totalFillers: 0,
      averageCallQuality: 0,
    };


    res.status(200).json({
      success: true,
      data: stats,
      date: targetDate.toISOString().split("T")[0],
    });
  } catch (error) {
    next(error);
  }
};
