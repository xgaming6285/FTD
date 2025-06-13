const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
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
      gender,
      status,
      documentStatus,
      page = 1,
      limit = 10,
      search,
      includeConverted = "true", // New parameter to control visibility of converted leads
      order = "newest", // Add order parameter with default value
      orderId, // Add orderId parameter
    } = req.query;

    // Build filter object
    const filter = {};
    if (leadType) filter.leadType = leadType;
    if (isAssigned !== undefined && isAssigned !== "")
      filter.isAssigned = isAssigned === "true";
    if (country) filter.country = new RegExp(country, "i");
    if (gender) filter.gender = gender;
    if (orderId) filter.orderId = new mongoose.Types.ObjectId(orderId); // Convert to ObjectId

    // Determine sort order based on order parameter
    let sortOrder = { createdAt: -1 }; // Default sort
    switch (order) {
      case "oldest":
        sortOrder = { createdAt: 1 };
        break;
      case "name_asc":
        sortOrder = { firstName: 1, lastName: 1 };
        break;
      case "name_desc":
        sortOrder = { firstName: -1, lastName: -1 };
        break;
      default: // "newest" or any other value
        sortOrder = { createdAt: -1 };
    }

    // Role-based filtering
    if (req.user.role === "affiliate_manager") {
      // Affiliate managers can only see leads assigned to them
      filter.assignedTo = req.user.id;
      filter.isAssigned = true;
    } else if (req.user.role === "lead_manager") {
      // Lead managers can only see leads they added
      filter.createdBy = req.user.id;
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
        { client: new RegExp(search, "i") },
        { clientBroker: new RegExp(search, "i") },
        { clientNetwork: new RegExp(search, "i") },
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get leads with pagination
    console.log("MongoDB Query Filter:", JSON.stringify(filter, null, 2));
    const leads = await Lead.find(filter)
      .populate("assignedTo", "fullName fourDigitCode")
      .populate("comments.author", "fullName")
      .populate("orderId", "status priority createdAt") // Add order population
      .sort(sortOrder)
      .skip(skip)
      .limit(parseInt(limit));

    console.log("MongoDB Query Results:", JSON.stringify(leads, null, 2));

    // Debug: Check if assignedTo is properly populated
    leads.forEach((lead, index) => {
      if (lead.isAssigned && lead.assignedTo) {
        console.log(`Lead ${index} assignedTo:`, {
          id: lead.assignedTo._id,
          fullName: lead.assignedTo.fullName,
          fourDigitCode: lead.assignedTo.fourDigitCode,
          email: lead.assignedTo.email,
        });
      } else if (lead.isAssigned && !lead.assignedTo) {
        console.log(
          `Lead ${index} is assigned but assignedTo is null/undefined`
        );
      }
    });

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
    const { page = 1, limit = 10, status, orderId } = req.query;

    // Build filter object
    const filter = {
      assignedTo: req.user.id,
      isAssigned: true,
    };

    if (status) filter.status = status;
    if (orderId) filter.orderId = new mongoose.Types.ObjectId(orderId);

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get assigned leads
    const leads = await Lead.find(filter)
      .populate("assignedTo", "fullName fourDigitCode email")
      .populate("comments.author", "fullName")
      .populate("orderId", "status priority createdAt") // Add order population
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
      live: { assigned: 0, available: 0, total: 0 },
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

    // FIX: The check now ensures the agent is not only active but also approved
    if (
      !agent ||
      agent.role !== "agent" ||
      !agent.isActive ||
      agent.status !== "approved"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive/unapproved agent selected.",
      });
    }

    // Build the update condition based on role
    let updateCondition = {
      _id: { $in: leadIds },
    };

    // Role-based filtering for affiliate managers
    if (req.user.role === "affiliate_manager") {
      // Affiliate managers can only assign leads that are assigned to them
      updateCondition.assignedTo = req.user.id;
      updateCondition.isAssigned = true;
    } else if (req.user.role === "admin") {
      // Admins can assign any lead (both unassigned and reassign already assigned ones)
      // No additional filtering needed - they can assign any lead by ID
    }

    // Update leads
    console.log("Assigning leads with:", {
      updateCondition,
      agentId,
      agentName: agent.fullName,
      agentCode: agent.fourDigitCode,
    });

    const result = await Lead.updateMany(updateCondition, {
      $set: {
        isAssigned: true,
        assignedTo: agentId,
        assignedAt: new Date(),
      },
    });

    console.log("Assignment result:", result);

    // Verify the assignment worked by checking a few leads
    const verifyLeads = await Lead.find({ _id: { $in: leadIds } })
      .populate("assignedTo", "fullName fourDigitCode email")
      .limit(3);

    console.log(
      "Verification - First few assigned leads:",
      verifyLeads.map((lead) => ({
        id: lead._id,
        isAssigned: lead.isAssigned,
        assignedTo: lead.assignedTo
          ? {
            id: lead.assignedTo._id,
            fullName: lead.assignedTo.fullName,
            fourDigitCode: lead.assignedTo.fourDigitCode,
          }
          : null,
      }))
    );

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

// @desc    Update lead information
// @route   PUT /api/leads/:id
// @access  Private (Admin, Affiliate Manager)
exports.updateLead = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      newEmail,
      oldEmail,
      newPhone,
      oldPhone,
      country,
      status,
      documents,
      leadType,
      socialMedia,
      sin,
      gender,
    } = req.body;

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Check if lead manager is trying to update a lead they didn't create
    if (
      req.user.role === "lead_manager" &&
      lead.createdBy &&
      lead.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only edit leads that you created",
      });
    }

    // Update fields if provided
    if (firstName) lead.firstName = firstName;
    if (lastName) lead.lastName = lastName;
    if (newEmail) lead.newEmail = newEmail;
    if (oldEmail !== undefined) lead.oldEmail = oldEmail;
    if (newPhone) lead.newPhone = newPhone;
    if (oldPhone !== undefined) lead.oldPhone = oldPhone;
    if (country) lead.country = country;
    if (status) lead.status = status;
    if (leadType) lead.leadType = leadType;
    if (sin !== undefined && leadType === "ftd") lead.sin = sin;
    if (gender !== undefined) lead.gender = gender;

    // Update social media fields if provided
    if (socialMedia) {
      lead.socialMedia = {
        ...lead.socialMedia,
        ...socialMedia,
      };
    }

    // Update documents if provided
    if (documents) {
      lead.documents = documents;
    }

    await lead.save();

    // Populate for response
    await lead.populate("assignedTo", "fullName fourDigitCode");
    await lead.populate("comments.author", "fullName");

    res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new lead
// @route   POST /api/leads
// @access  Private (Admin, Affiliate Manager, Lead Manager)
exports.createLead = async (req, res, next) => {
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

    const {
      firstName,
      lastName,
      newEmail,
      oldEmail,
      newPhone,
      oldPhone,
      country,
      leadType,
      socialMedia,
      sin,
      client,
      clientBroker,
      clientNetwork,
      dob,
      address,
      gender,
      documents,
    } = req.body;

    // Check if a lead with this email already exists
    const existingLead = await Lead.findOne({
      newEmail: newEmail.toLowerCase(),
    });
    if (existingLead) {
      return res.status(400).json({
        success: false,
        message: "A lead with this email already exists",
        errors: [
          {
            type: "field",
            value: newEmail,
            msg: "This email is already registered in the system",
            path: "newEmail",
            location: "body",
          },
        ],
      });
    }

    // Create a new lead
    const lead = new Lead({
      firstName,
      lastName,
      newEmail,
      oldEmail,
      newPhone,
      oldPhone,
      country,
      leadType,
      socialMedia,
      sin,
      client,
      clientBroker,
      clientNetwork,
      dob,
      address,
      gender,
      documents,
      createdBy: req.user.id,
      isAssigned: false,
      status: "active",
    });

    // Set document status to pending for FTD leads
    if (leadType === "ftd") {
      lead.documents = {
        status: "good",
      };
    }

    await lead.save();

    res.status(201).json({
      success: true,
      message: "Lead created successfully",
      data: lead,
    });
  } catch (error) {
    // Handle other MongoDB errors
    if (error.code === 11000 && error.keyPattern?.newEmail) {
      return res.status(400).json({
        success: false,
        message: "A lead with this email already exists",
        errors: [
          {
            type: "field",
            value: error.keyValue.newEmail,
            msg: "This email is already registered in the system",
            path: "newEmail",
            location: "body",
          },
        ],
      });
    }
    next(error);
  }
};

// @desc    Import leads from CSV file
// @route   POST /api/leads/import
// @access  Private (Admin, Affiliate Manager, Lead Manager)
exports.importLeads = async (req, res, next) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV file",
      });
    }

    const file = req.files.file;
    const leadType = req.body.leadType;

    // Validate lead type
    if (!leadType || !["ftd", "filler", "cold", "live"].includes(leadType)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid lead type (ftd, filler, cold, or live)",
      });
    }

    // Validate file
    if (!file.data || file.data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No file data received",
      });
    }

    if (!file.mimetype.includes("csv") && !file.name.endsWith(".csv")) {
      return res.status(400).json({
        success: false,
        message: "Please upload a valid CSV file",
      });
    }

    // Parse CSV data
    const csvData = file.data.toString('utf8');
    const rows = csvData.split('\n').map(row => row.trim()).filter(row => row.length > 0);

    if (rows.length < 2) {
      return res.status(400).json({
        success: false,
        message: "CSV file must contain at least a header row and one data row",
      });
    }

    // Parse header row
    const headers = rows[0].split(',').map(header => header.trim().replace(/"/g, ''));
    const dataRows = rows.slice(1);

    // Create column mapping based on CSV headers
    const columnMap = createColumnMapping(headers);
    
    // Validate required columns
    const requiredColumns = ['firstName', 'lastName', 'newEmail', 'newPhone', 'country'];
    const missingColumns = requiredColumns.filter(col => columnMap[col] === -1);
    
    if (missingColumns.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required columns: ${missingColumns.join(', ')}. Please check your CSV format.`,
      });
    }

    const leads = [];
    const errors = [];
    const duplicateEmails = new Set();

    // Check for existing emails in database
    const existingEmails = await Lead.find({}, { newEmail: 1 }).lean();
    const existingEmailSet = new Set(existingEmails.map(lead => lead.newEmail));

    // Process each data row
    for (let i = 0; i < dataRows.length; i++) {
      try {
        const rowData = parseCSVRow(dataRows[i]);
        const leadData = mapRowToLead(rowData, columnMap, leadType, req.user.id);

        // Validate required fields
        const validation = validateLeadData(leadData);
        if (!validation.isValid) {
          errors.push({
            row: i + 2,
            error: `Validation failed: ${validation.errors.join(', ')}`,
            data: leadData
          });
          continue;
        }

        // Check for duplicate emails
        if (existingEmailSet.has(leadData.newEmail) || duplicateEmails.has(leadData.newEmail)) {
          errors.push({
            row: i + 2,
            error: `Email ${leadData.newEmail} already exists`,
            data: leadData
          });
          continue;
        }

        duplicateEmails.add(leadData.newEmail);
        leads.push(leadData);

      } catch (error) {
        errors.push({
          row: i + 2,
          error: `Processing error: ${error.message}`,
          data: null
        });
      }
    }

    // Save leads to database
    let savedLeads = [];
    if (leads.length > 0) {
      try {
        savedLeads = await Lead.insertMany(leads, { ordered: false });
      } catch (bulkError) {
        // Handle bulk insert errors
        if (bulkError.writeErrors) {
          bulkError.writeErrors.forEach((writeError, index) => {
            errors.push({
              row: index + 2,
              error: `Database error: ${writeError.errmsg}`,
              data: leads[index]
            });
          });
          savedLeads = bulkError.insertedDocs || [];
        } else {
          throw bulkError;
        }
      }
    }

    // Return results
    res.status(200).json({
      success: true,
      message: `Successfully processed ${dataRows.length} rows. Imported ${savedLeads.length} leads${errors.length > 0 ? ` with ${errors.length} errors` : ""}`,
      data: {
        imported: savedLeads.length,
        total: dataRows.length,
        errors: errors
      },
    });

  } catch (error) {
    console.error("Import error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to import leads",
      error: error.message,
    });
  }
};

// Helper function to create column mapping from headers
function createColumnMapping(headers) {
  const columnMap = {};
  
  // Define header mappings (case-insensitive)
  const headerMappings = {
    gender: ['gender'],
    firstName: ['first name', 'firstname', 'first_name', 'fname'],
    lastName: ['last name', 'lastname', 'last_name', 'lname'],
    oldEmail: ['old email', 'oldemail', 'old_email', 'email_old'],
    newEmail: ['new email', 'newemail', 'new_email', 'email'],
    prefix: ['prefix'],
    oldPhone: ['old phone', 'oldphone', 'old_phone', 'phone_old'],
    newPhone: ['new phone', 'newphone', 'new_phone', 'phone'],
    agent: ['agent'],
    extension: ['extension', 'ext', 'Extension'], // Added capital E variant
    dateOfBirth: ['date of birth', 'dateofbirth', 'date_of_birth', 'dob'],
    address: ['address'],
    facebook: ['facebook', 'fb', 'Facebook'], // Added capital variant
    twitter: ['twitter', 'Twitter'], // Added capital variant
    linkedin: ['linkedin', 'Linkedin'], // Added capital variant
    instagram: ['instagram', 'ig', 'Instagram'], // Added capital variant
    telegram: ['telegram', 'Telegram'], // Added capital variant
    idFront: ['id front', 'idfront', 'id_front', 'ID front'],
    idBack: ['id back', 'idback', 'id_back', 'ID back'],
    selfieFront: ['selfie front', 'selfiefront', 'selfie_front', 'Selfie front'],
    selfieBack: ['selfie back', 'selfieback', 'selfie_back', 'Selfie back'],
    idRemark: ['id remark', 'idremark', 'id_remark', 'ID remark'],
    geo: ['geo', 'GEO', 'country', 'location'] // Added capital GEO variant
  };

  // Initialize all columns to -1 (not found)
  Object.keys(headerMappings).forEach(key => {
    columnMap[key] = -1;
  });

  // Map headers to column indices
  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim();
    
    for (const [field, variations] of Object.entries(headerMappings)) {
      if (variations.some(variation => normalizedHeader === variation.toLowerCase())) {
        columnMap[field] = index;
        break;
      }
    }
  });

  // Log the mapping for debugging
  console.log('Column mapping created:', columnMap);
  console.log('Headers found:', headers);

  return columnMap;
}

// Helper function to parse CSV row handling quoted values
function parseCSVRow(row) {
  const result = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  // Handle empty row
  if (!row || row.trim().length === 0) {
    return [];
  }

  while (i < row.length) {
    const char = row[i];
    
    if (char === '"') {
      if (inQuotes && i + 1 < row.length && row[i + 1] === '"') {
        // Handle escaped quotes (double quotes)
        current += '"';
        i += 2;
        continue;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator found outside quotes
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
    i++;
  }
  
  // Add the last field
  result.push(current.trim());
  
  // Clean up any remaining quotes from field values
  return result.map(field => {
    // Remove surrounding quotes if present
    if (field.startsWith('"') && field.endsWith('"') && field.length > 1) {
      return field.slice(1, -1);
    }
    return field;
  });
}

// Helper function to map row data to lead object
function mapRowToLead(rowData, columnMap, leadType, userId) {
  const lead = {
    leadType,
    createdBy: userId,
    socialMedia: {},
    documents: []
  };

  // Helper function to get value from row data
  const getValue = (field) => {
    if (columnMap[field] !== -1 && columnMap[field] < rowData.length) {
      const value = rowData[columnMap[field]];
      return value && value.trim() !== '' ? value.trim() : '';
    }
    return '';
  };

  // Map basic fields
  const genderValue = getValue('gender');
  if (genderValue) {
    const gender = genderValue.toLowerCase();
    if (['male', 'female', 'not_defined'].includes(gender)) {
      lead.gender = gender;
    } else {
      lead.gender = 'not_defined'; // Default for invalid values
    }
  } else {
    lead.gender = 'not_defined'; // Default when no gender provided
  }

  lead.firstName = getValue('firstName');
  lead.lastName = getValue('lastName');
  lead.newEmail = getValue('newEmail').toLowerCase();
  
  const oldEmailValue = getValue('oldEmail');
  if (oldEmailValue) {
    lead.oldEmail = oldEmailValue.toLowerCase();
  }

  lead.newPhone = getValue('newPhone');
  
  const oldPhoneValue = getValue('oldPhone');
  if (oldPhoneValue) {
    lead.oldPhone = oldPhoneValue;
  }

  const prefixValue = getValue('prefix');
  if (prefixValue) {
    lead.prefix = prefixValue;
  }

  const agentValue = getValue('agent');
  if (agentValue) {
    lead.agent = agentValue;
  }

  const extensionValue = getValue('extension');
  if (extensionValue) {
    lead.extension = extensionValue;
  }

  const addressValue = getValue('address');
  if (addressValue) {
    lead.address = addressValue;
  }

  // Map country (try geo column first)
  const geoValue = getValue('geo');
  if (geoValue) {
    lead.country = geoValue;
  } else {
    lead.country = 'Unknown'; // Default fallback
  }

  // Parse date of birth
  const dobValue = getValue('dateOfBirth');
  if (dobValue) {
    const parsedDob = parseDateOfBirth(dobValue);
    if (parsedDob) {
      lead.dob = parsedDob;
    }
  }

  // Map social media (only if values exist)
  const facebookValue = getValue('facebook');
  if (facebookValue) {
    lead.socialMedia.facebook = facebookValue;
  }

  const twitterValue = getValue('twitter');
  if (twitterValue) {
    lead.socialMedia.twitter = twitterValue;
  }

  const linkedinValue = getValue('linkedin');
  if (linkedinValue) {
    lead.socialMedia.linkedin = linkedinValue;
  }

  const instagramValue = getValue('instagram');
  if (instagramValue) {
    lead.socialMedia.instagram = instagramValue;
  }

  const telegramValue = getValue('telegram');
  if (telegramValue) {
    lead.socialMedia.telegram = telegramValue;
  }

  // Map document URLs for FTD leads
  if (leadType === 'ftd') {
    const idFrontValue = getValue('idFront');
    if (idFrontValue) {
      lead.documents.push({
        url: idFrontValue,
        description: 'ID Front'
      });
    }

    const idBackValue = getValue('idBack');
    if (idBackValue) {
      lead.documents.push({
        url: idBackValue,
        description: 'ID Back'
      });
    }

    const selfieFrontValue = getValue('selfieFront');
    if (selfieFrontValue) {
      lead.documents.push({
        url: selfieFrontValue,
        description: 'Selfie Front'
      });
    }

    const selfieBackValue = getValue('selfieBack');
    if (selfieBackValue) {
      lead.documents.push({
        url: selfieBackValue,
        description: 'Selfie Back'
      });
    }

    // Add ID remark as a comment if it exists
    const idRemarkValue = getValue('idRemark');
    if (idRemarkValue) {
      lead.comments = [{
        text: `ID Remark: ${idRemarkValue}`,
        author: userId,
        createdAt: new Date()
      }];
    }
  }

  return lead;
}

// Helper function to parse date of birth
function parseDateOfBirth(dobString) {
  if (!dobString) return null;

  try {
    // Handle different date formats
    if (dobString.includes('/')) {
      // Handle DD/MM/YYYY format
      const parts = dobString.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Month is 0-indexed
        const year = parseInt(parts[2]);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
      }
    } else if (dobString.includes('-')) {
      // Handle YYYY-MM-DD format
      const date = new Date(dobString);
      if (!isNaN(date.getTime())) return date;
    } else if (!isNaN(dobString) && dobString.length <= 5) {
      // Handle Excel serial number
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (parseInt(dobString) - 2) * 24 * 60 * 60 * 1000);
      if (!isNaN(date.getTime())) return date;
    }
  } catch (error) {
    console.log(`Warning: Could not parse date of birth "${dobString}"`);
  }

  return null;
}

// Helper function to validate lead data
function validateLeadData(leadData) {
  const errors = [];

  if (!leadData.firstName || leadData.firstName.trim().length === 0) {
    errors.push('First name is required');
  }
  if (!leadData.lastName || leadData.lastName.trim().length === 0) {
    errors.push('Last name is required');
  }
  if (!leadData.newEmail || leadData.newEmail.trim().length === 0) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadData.newEmail)) {
    errors.push('Invalid email format');
  }
  if (!leadData.newPhone || leadData.newPhone.trim().length === 0) {
    errors.push('Phone number is required');
  }
  if (!leadData.country || leadData.country.trim().length === 0) {
    errors.push('Country is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// @desc    Delete a lead
// @route   DELETE /api/leads/:id
// @access  Private (Admin only)
exports.deleteLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Only admin can delete leads
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete leads",
      });
    }

    await lead.deleteOne();

    res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
