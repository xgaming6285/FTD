const { validationResult } = require("express-validator");
const Lead = require("../models/Lead");
const User = require("../models/User");

// @desc    Get all leads with filtering and pagination
// @route   GET /api/leads
// @access  Private (Admin, Affiliate Manager)
exports.getLeads = async (req, res, next) => {
  try {
    const {
      leadType,
      isAssigned,
      country,
      status,
      documentStatus,
      page = 1,
      limit = 10,
      search,
      includeConverted = "true", // New parameter to control visibility of converted leads
    } = req.query;

    // Build filter object
    const filter = {};
    if (leadType) filter.leadType = leadType;
    if (isAssigned !== undefined) filter.isAssigned = isAssigned === "true";
    if (country) filter.country = new RegExp(country, "i");

    // Role-based filtering
    if (req.user.role === "affiliate_manager") {
      // Affiliate managers can only see leads assigned to them
      filter.assignedTo = req.user.id;
      filter.isAssigned = true;
    }

    // Only apply status filter if includeConverted is false or if status is specifically requested
    if (status) {
      filter.status = status;
    } else if (includeConverted !== "true") {
      filter.status = { $ne: "converted" }; // Exclude converted leads if not explicitly requested
    }

    if (documentStatus) filter["documents.status"] = documentStatus;

    // Add search functionality
    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { phone: new RegExp(search, "i") },
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get leads with pagination
    console.log("MongoDB Query Filter:", JSON.stringify(filter, null, 2));
    const leads = await Lead.find(filter)
      .populate("assignedTo", "fullName fourDigitCode")
      .populate("comments.author", "fullName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    console.log("MongoDB Query Results:", JSON.stringify(leads, null, 2));

    // Get total count for pagination
    const total = await Lead.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: leads,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalLeads: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get assigned leads for agent
// @route   GET /api/leads/assigned
// @access  Private (Agent)
exports.getAssignedLeads = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    // Build filter object
    const filter = {
      assignedTo: req.user.id,
      isAssigned: true,
    };

    if (status) filter.status = status;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get assigned leads
    const leads = await Lead.find(filter)
      .populate("comments.author", "fullName")
      .sort({ assignedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Lead.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: leads,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalLeads: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get lead by ID
// @route   GET /api/leads/:id
// @access  Private (Admin or assigned agent)
exports.getLeadById = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate("assignedTo", "fullName fourDigitCode email")
      .populate("comments.author", "fullName fourDigitCode");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if user has access to this lead
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      if (!lead.isAssigned || lead.assignedTo._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to access this lead",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add comment to lead
// @route   PUT /api/leads/:id/comment
// @access  Private (Admin, Affiliate Manager, or assigned agent)
exports.addComment = async (req, res, next) => {
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

    const { text } = req.body;

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if user has access to this lead
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      if (!lead.isAssigned || lead.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to comment on this lead",
        });
      }
    }

    // Add comment
    const comment = {
      text,
      author: req.user.id,
      createdAt: new Date(),
    };

    lead.comments.push(comment);
    await lead.save();

    // Populate the newly added comment
    await lead.populate("comments.author", "fullName fourDigitCode");

    res.status(200).json({
      success: true,
      message: "Comment added successfully",
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update lead status
// @route   PUT /api/leads/:id/status
// @access  Private (Admin, Affiliate Manager, or assigned agent)
exports.updateLeadStatus = async (req, res, next) => {
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

    const { status, documentStatus } = req.body;

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if user has access to this lead
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      if (!lead.isAssigned || lead.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to update this lead",
        });
      }
    }

    // Update fields
    if (status) lead.status = status;
    if (documentStatus && lead.documents) {
      lead.documents.status = documentStatus;
    }

    await lead.save();

    // Populate for response
    await lead.populate("assignedTo", "fullName fourDigitCode");

    res.status(200).json({
      success: true,
      message: "Lead status updated successfully",
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get lead statistics
// @route   GET /api/leads/stats
// @access  Private (Admin, Affiliate Manager)
exports.getLeadStats = async (req, res, next) => {
  try {
    let matchCondition = {};

    // Role-based filtering for stats
    if (req.user.role === "affiliate_manager") {
      // Affiliate managers can only see stats for leads assigned to them
      matchCondition = {
        assignedTo: req.user._id,
        isAssigned: true,
      };
    }

    // Build aggregation pipeline with role-based match condition
    const pipeline = [];
    if (Object.keys(matchCondition).length > 0) {
      pipeline.push({ $match: matchCondition });
    }

    pipeline.push({
      $group: {
        _id: {
          leadType: "$leadType",
          isAssigned: "$isAssigned",
        },
        count: { $sum: 1 },
      },
    });

    const stats = await Lead.aggregate(pipeline);

    // Transform aggregation result into a more readable format
    const formattedStats = {
      ftd: { assigned: 0, available: 0, total: 0 },
      filler: { assigned: 0, available: 0, total: 0 },
      cold: { assigned: 0, available: 0, total: 0 },
      overall: { assigned: 0, available: 0, total: 0 },
    };

    stats.forEach((stat) => {
      const { leadType, isAssigned } = stat._id;
      const count = stat.count;

      if (formattedStats[leadType]) {
        if (isAssigned) {
          formattedStats[leadType].assigned = count;
        } else {
          formattedStats[leadType].available = count;
        }
        formattedStats[leadType].total += count;

        // Update overall stats
        if (isAssigned) {
          formattedStats.overall.assigned += count;
        } else {
          formattedStats.overall.available += count;
        }
        formattedStats.overall.total += count;
      }
    });

    // Get document status stats for FTD leads with role-based filtering
    const documentStatsPipeline = [
      {
        $match: {
          leadType: "ftd",
          ...matchCondition,
        },
      },
      {
        $group: {
          _id: "$documents.status",
          count: { $sum: 1 },
        },
      },
    ];

    const documentStats = await Lead.aggregate(documentStatsPipeline);

    const formattedDocumentStats = {
      good: 0,
      ok: 0,
      pending: 0,
    };

    documentStats.forEach((stat) => {
      if (formattedDocumentStats.hasOwnProperty(stat._id)) {
        formattedDocumentStats[stat._id] = stat.count;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        leads: formattedStats,
        documents: formattedDocumentStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign leads to agent
// @route   PUT /api/leads/assign
// @access  Private (Admin/Affiliate Manager only)
exports.assignLeads = async (req, res, next) => {
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

    const { leadIds, agentId } = req.body;

    // Validate agent exists and is active
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== "agent" || !agent.isActive) {
      return res.status(400).json({
        success: false,
        message: "Invalid agent selected",
      });
    }

    // Build the update condition based on role
    let updateCondition = {
      _id: { $in: leadIds },
      isAssigned: false,
    };

    // Role-based filtering for affiliate managers
    if (req.user.role === "affiliate_manager") {
      // Affiliate managers can only assign leads that are assigned to them
      updateCondition.assignedTo = req.user.id;
      updateCondition.isAssigned = true; // Override the isAssigned condition for affiliate managers
    }

    // Update leads
    const result = await Lead.updateMany(updateCondition, {
      $set: {
        isAssigned: true,
        assignedTo: agentId,
        assignedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} leads assigned successfully`,
      data: {
        assignedCount: result.modifiedCount,
        agentName: agent.fullName,
        agentCode: agent.fourDigitCode,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unassign leads from agent
// @route   PUT /api/leads/unassign
// @access  Private (Admin/Affiliate Manager only)
exports.unassignLeads = async (req, res, next) => {
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

    const { leadIds } = req.body;

    // Build the update condition based on role
    let updateCondition = {
      _id: { $in: leadIds },
      isAssigned: true,
    };

    // Role-based filtering for affiliate managers
    if (req.user.role === "affiliate_manager") {
      // Affiliate managers can only unassign leads that are assigned to them
      updateCondition.assignedTo = req.user.id;
    }

    // Update leads
    const result = await Lead.updateMany(updateCondition, {
      $set: {
        isAssigned: false,
      },
      $unset: {
        assignedTo: 1,
        assignedAt: 1,
      },
    });

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} leads unassigned successfully`,
      data: {
        unassignedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
