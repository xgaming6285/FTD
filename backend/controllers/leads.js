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

    // Debug file information
    console.log("File details:", {
      name: file.name,
      size: file.size,
      mimetype: file.mimetype,
      encoding: file.encoding,
      data: file.data ? "Buffer present" : "No buffer",
      tempFilePath: file.tempFilePath,
      leadType: leadType,
    });

    // Check if file exists and has data
    if (!file || !file.data || file.data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No file data received",
        debug: {
          fileExists: !!file,
          hasData: file ? !!file.data : false,
          dataLength: file ? file.data.length : 0,
        },
      });
    }

    // Check if file is CSV
    if (!file.mimetype.includes("csv") && !file.name.endsWith(".csv")) {
      return res.status(400).json({
        success: false,
        message: "Please upload a valid CSV file",
      });
    }

    // Read and parse CSV file with explicit UTF-8 encoding
    let csvData;
    try {
      // Log raw buffer data
      console.log("Raw buffer (first 100 bytes):", file.data.slice(0, 100));
      console.log("Buffer length:", file.data.length);

      // Convert buffer to string and handle BOM if present
      csvData = file.data
        .toString("utf-8")
        .replace(/^\uFEFF/, "")
        .trim();

      // Log the raw string data
      console.log(
        "Raw CSV string (first 200 chars):",
        csvData.substring(0, 200)
      );
      console.log("Raw CSV string length:", csvData.length);
      console.log("Raw CSV string contains newlines:", csvData.includes("\n"));
      console.log(
        "Raw CSV string contains carriage returns:",
        csvData.includes("\r")
      );

      // Log character codes for debugging
      console.log(
        "First 10 character codes:",
        Array.from(csvData.substring(0, 10)).map((c) => c.charCodeAt(0))
      );
    } catch (error) {
      console.error("Error reading file:", error);
      return res.status(400).json({
        success: false,
        message: "Error reading CSV file",
        error: error.message,
      });
    }

    // Split by newlines and handle different line endings
    const rawRows = csvData.split(/\r?\n/);
    console.log("Raw rows before processing:", {
      count: rawRows.length,
      firstRow: rawRows[0],
      secondRow: rawRows[1],
    });

    const rows = rawRows
      .map((row) => row.trim())
      .filter((row) => row.length > 0) // Remove empty lines
      .map((row) => {
        // Improved CSV parsing with better quote handling
        const cells = [];
        let currentCell = "";
        let inQuotes = false;
        let i = 0;

        while (i < row.length) {
          const char = row[i];

          if (char === '"') {
            // Check for escaped quotes ("")
            if (inQuotes && i + 1 < row.length && row[i + 1] === '"') {
              currentCell += '"'; // Add literal quote
              i += 2; // Skip both quotes
              continue;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === "," && !inQuotes) {
            cells.push(currentCell.trim());
            currentCell = "";
          } else {
            // Only add non-quote characters or quotes that are inside quoted strings
            if (char !== '"' || inQuotes) {
              currentCell += char;
            }
          }
          i++;
        }

        // Add the last cell
        cells.push(currentCell.trim());
        return cells;
      });

    console.log("Processed rows:", {
      totalRows: rows.length,
      firstRow: rows[0],
      secondRow: rows[1],
      firstRowCellCount: rows[0]?.length,
      secondRowCellCount: rows[1]?.length,
    });

    // Add detailed debugging for the first few rows
    console.log("Detailed row analysis:");
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      console.log(`Row ${i}:`, rows[i]);
      console.log(`Row ${i} cell count:`, rows[i].length);
      console.log(`Row ${i} cells:`, rows[i].map((cell, idx) => `[${idx}]: "${cell}"`));
    }

    if (rows.length < 2) {
      return res.status(400).json({
        success: false,
        message: "CSV file must contain at least a header row and one data row",
        debug: {
          totalRows: rows.length,
          rawRowCount: rawRows.length,
          firstRawRow: rawRows[0],
          fileSize: file.size,
          fileType: file.mimetype,
          csvLength: csvData.length,
        },
      });
    }

    // Get headers from first row and normalize them
    const rawHeaders = rows[0];
    const dataRows = rows.slice(1);

    // Create a flexible header mapping function
    const normalizeHeader = (header) => {
      return header
        .toLowerCase()
        .replace(/[\s_-]+/g, "")
        .trim();
    };

    // Define header mappings for flexible matching
    const headerMappings = {
      // Core fields
      gender: ["gender"],
      firstname: ["firstname", "first_name", "fname", "first name"],
      lastname: ["lastname", "last_name", "lname", "last name"],
      oldemail: [
        "oldemail",
        "old_email",
        "email_old",
        "previousemail",
        "old email",
      ],
      newemail: [
        "newemail",
        "new_email",
        "email_new",
        "email",
        "new email",
      ],
      prefix: ["prefix"],
      oldphone: ["oldphone", "old_phone", "phone_old", "previousphone"],
      newphone: [
        "newphone",
        "new_phone",
        "phone_new",
        "phone",
        "phonenumber",
        "new phone",
      ],
      agent: ["agent"],
      extension: ["extension", "ext"],
      dateofbirth: ["dateofbirth", "date_of_birth", "dob", "birthday"],

      // Social media fields
      facebook: ["facebook", "fb"],
      twitter: ["twitter"],
      linkedin: ["linkedin"],
      instagram: ["instagram", "ig"],
      telegram: ["telegram"],

      // Document fields
      idfront: ["idfront", "id_front", "frontid"],
      idback: ["idback", "id_back", "backid"],
      selfieback: ["selfieback", "selfie_back", "backselfie"],
      selfiefront: ["selfiefront", "selfie_front", "frontselfie"],

      // Address field
      address: ["address", "full_address", "fulladdress", "street_address", "streetaddress", "location_address"],

      // Geographic field
      geo: ["geo", "country", "location", "region"],
    };

    // Create reverse mapping from CSV headers to field names
    const fieldMapping = {};
    rawHeaders.forEach((header, index) => {
      const normalizedHeader = normalizeHeader(header);
      console.log(`Processing header ${index}: "${header}" -> normalized: "${normalizedHeader}"`);

      // Find matching field - use exact match only to avoid confusion
      for (const [fieldName, variations] of Object.entries(headerMappings)) {
        // Try exact match only
        const matchFound = variations.some(variation => {
          const normalizedVariation = normalizeHeader(variation);
          const isMatch = normalizedHeader === normalizedVariation;
          if (isMatch) {
            console.log(`✅ EXACT MATCH: "${header}" (${normalizedHeader}) matches ${fieldName} variation "${variation}" (${normalizedVariation})`);
          }
          return isMatch;
        });
        
        if (matchFound) {
          // Check if this field is already mapped to prevent duplicates
          const alreadyMapped = Object.values(fieldMapping).includes(fieldName);
          if (alreadyMapped) {
            console.log(`⚠️  WARNING: Field "${fieldName}" is already mapped! Skipping duplicate mapping for "${header}"`);
            continue;
          }
          
          fieldMapping[index] = fieldName;
          console.log(`✅ MAPPED: Column ${index} ("${header}") -> ${fieldName}`);
          break;
        }
      }
      
      // If no exact match found, log it for debugging
      if (!fieldMapping[index]) {
        console.log(`❌ No exact match found for header: "${header}" (normalized: "${normalizedHeader}")`);
        // Show all possible matches for debugging
        for (const [fieldName, variations] of Object.entries(headerMappings)) {
          console.log(`  ${fieldName}: [${variations.map(v => `"${normalizeHeader(v)}"`).join(', ')}]`);
        }
      }
    });

    console.log("Header mapping:", {
      rawHeaders,
      fieldMapping,
      mappedFields: Object.values(fieldMapping),
    });

    // Validate that we have at least the required fields
    const requiredFields = ["firstname", "lastname"];
    const hasRequiredEmail =
      Object.values(fieldMapping).includes("newemail") ||
      Object.values(fieldMapping).includes("email");
    const hasRequiredPhone =
      Object.values(fieldMapping).includes("newphone") ||
      Object.values(fieldMapping).includes("phone");

    const missingRequired = requiredFields.filter(
      (field) => !Object.values(fieldMapping).includes(field)
    );

    if (missingRequired.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingRequired.join(
          ", "
        )}. Headers found: ${rawHeaders.join(", ")}`,
        debug: {
          receivedHeaders: rawHeaders,
          fieldMapping: fieldMapping,
          missingRequired: missingRequired,
        },
      });
    }

    if (!hasRequiredEmail) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required email field (newemail, new_email, email, etc.)",
        debug: {
          receivedHeaders: rawHeaders,
          fieldMapping: fieldMapping,
        },
      });
    }

    if (!hasRequiredPhone) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required phone field (newphone, new_phone, phone, etc.)",
        debug: {
          receivedHeaders: rawHeaders,
          fieldMapping: fieldMapping,
        },
      });
    }

    // Process each row and create leads
    const leads = [];
    const errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];

      // Skip empty rows
      if (row.every((cell) => !cell || cell.trim() === "")) {
        continue;
      }

      const leadData = {};

      // Map CSV columns to lead fields using our flexible mapping
      row.forEach((cellValue, cellIndex) => {
        const fieldName = fieldMapping[cellIndex];
        if (fieldName && cellValue && cellValue.trim()) {
          leadData[fieldName] = cellValue.trim();
        }
      });

      console.log(`Row ${i + 2} mapped data:`, leadData);

      try {
        // Validate required lead data
        if (!leadData.firstname || !leadData.lastname) {
          throw new Error(
            "Missing required fields (firstName and lastName are required)"
          );
        }

        // Get email - prioritize newemail, fall back to any email field
        const email = leadData.newemail || leadData.email;
        if (!email) {
          throw new Error("Email is required");
        }

        // Get phone - prioritize newphone, fall back to any phone field
        const phone = leadData.newphone || leadData.phone;
        if (!phone) {
          throw new Error("Phone is required");
        }

        // Validate and clean email format
        const cleanEmail = email.split(" ")[0].trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
          throw new Error("Invalid email format");
        }

        // Phone validation - ensure it exists and has reasonable length
        const cleanPhone = phone.replace(/\D/g, ""); // Remove non-digits
        if (cleanPhone.length < 5) {
          throw new Error("Phone number must be at least 5 digits");
        }

        // Create lead object with all available fields
        const leadObject = {
          firstName: leadData.firstname,
          lastName: leadData.lastname,
          newEmail: cleanEmail,
          oldEmail: leadData.oldemail || "",
          newPhone: cleanPhone,
          oldPhone: leadData.oldphone
            ? leadData.oldphone.replace(/\D/g, "")
            : "",
          country: leadData.geo || "Unknown",
          gender: leadData.gender
            ? leadData.gender.toLowerCase()
            : "not_defined",
          leadType: leadType,
          createdBy: req.user.id,
          isAssigned: false,
          status: "active",
        };

        // Validate gender value and set default if invalid
        const validGenders = ["male", "female", "not_defined"];
        if (!validGenders.includes(leadObject.gender)) {
          leadObject.gender = "not_defined";
        }

        // Handle date of birth conversion
        if (leadData.dateofbirth) {
          try {
            const dobString = leadData.dateofbirth;
            let dobDate;

            // Check if it's a number (Excel serial date)
            if (!isNaN(dobString) && dobString.length <= 5) {
              // Convert Excel serial date to JavaScript date
              const excelEpoch = new Date(1900, 0, 1);
              dobDate = new Date(
                excelEpoch.getTime() +
                (parseInt(dobString) - 2) * 24 * 60 * 60 * 1000
              );
            } else if (dobString.includes("/")) {
              // Handle DD/MM/YYYY format
              const parts = dobString.split("/");
              if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1; // Month is 0-indexed
                const year = parseInt(parts[2]);
                dobDate = new Date(year, month, day);
              }
            } else if (dobString.includes("-")) {
              // Handle YYYY-MM-DD format
              dobDate = new Date(dobString);
            }

            if (dobDate && !isNaN(dobDate.getTime())) {
              leadObject.dob = dobDate;
            }
          } catch (error) {
            console.log(
              `Warning: Could not parse date of birth "${leadData.dateofbirth
              }" for row ${i + 2}`
            );
          }
        }

        // Add optional fields if they exist in CSV
        if (leadData.prefix) leadObject.prefix = leadData.prefix;
        if (leadData.agent) leadObject.agent = leadData.agent;
        if (leadData.extension) leadObject.extension = leadData.extension;
        if (leadData.address) leadObject.address = leadData.address;

        // Handle social media fields
        const socialMedia = {};
        if (leadData.facebook) socialMedia.facebook = leadData.facebook;
        if (leadData.twitter) socialMedia.twitter = leadData.twitter;
        if (leadData.linkedin) socialMedia.linkedin = leadData.linkedin;
        if (leadData.instagram) socialMedia.instagram = leadData.instagram;
        if (leadData.telegram) socialMedia.telegram = leadData.telegram;

        if (Object.keys(socialMedia).length > 0) {
          leadObject.socialMedia = socialMedia;
        }

        // Handle document fields
        const documents = [];
        if (leadData.idfront) {
          documents.push({
            url: leadData.idfront,
            description: 'ID Front'
          });
        }
        if (leadData.idback) {
          documents.push({
            url: leadData.idback,
            description: 'ID Back'
          });
        }
        if (leadData.selfiefront) {
          documents.push({
            url: leadData.selfiefront,
            description: 'Selfie'
          });
        }
        if (leadData.residenceproof) {
          documents.push({
            url: leadData.residenceproof,
            description: 'Proof of Residence'
          });
        }

        if (documents.length > 0) {
          leadObject.documents = documents;
        }

        // Create and save lead
        const lead = new Lead(leadObject);
        await lead.save();
        leads.push(lead);
      } catch (error) {
        errors.push({
          row: i + 2, // +2 because of 0-based index and header row
          error: error.message,
          data: leadData,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully imported ${leads.length} leads${errors.length > 0 ? ` with ${errors.length} errors` : ""
        }`,
      data: {
        imported: leads.length,
        errors: errors,
        headerMapping: fieldMapping,
        detectedFields: Object.values(fieldMapping),
      },
    });
  } catch (error) {
    console.error("Import error:", error);
    next(error);
  }
};

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
