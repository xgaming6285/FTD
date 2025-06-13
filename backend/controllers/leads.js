const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const User = require("../models/User");
const csvParser = require('csv-parser');
const { Readable } = require('stream');

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

    // Create a readable stream from the file buffer
    const csvData = file.data.toString('utf8');
    const stream = Readable.from([csvData]);

    const leads = [];
    let rowNumber = 1;

    // Parse CSV using csv-parser
    const parsePromise = new Promise((resolve, reject) => {
      stream
        .pipe(csvParser({
          mapHeaders: ({ header, index }) => {
            // Custom header mapping to avoid conflicts
            const normalized = header.trim().toLowerCase();
            console.log(`Mapping header "${header}" (index ${index}) -> normalized: "${normalized}"`);

            // Explicit mapping for known headers
            switch (normalized) {
              case 'new email':
              case 'email':
                console.log(`  -> mapping to: newemail`);
                return 'newemail';
              case 'old email':
                console.log(`  -> mapping to: oldemail`);
                return 'oldemail';
              case 'first name':
                console.log(`  -> mapping to: firstname`);
                return 'firstname';
              case 'last name':
                console.log(`  -> mapping to: lastname`);
                return 'lastname';
              case 'new phone':
              case 'phone':
                console.log(`  -> mapping to: newphone`);
                return 'newphone';
              case 'old phone':
                console.log(`  -> mapping to: oldphone`);
                return 'oldphone';
              case 'date of birth':
              case 'dob':
                console.log(`  -> mapping to: dateofbirth`);
                return 'dateofbirth';
              case 'id front':
                console.log(`  -> mapping to: idfront`);
                return 'idfront';
              case 'id back':
                console.log(`  -> mapping to: idback`);
                return 'idback';
              case 'selfie front':
                console.log(`  -> mapping to: selfiefront`);
                return 'selfiefront';
              case 'selfie back':
                console.log(`  -> mapping to: selfieback`);
                return 'selfieback';
              case 'id remark':
                console.log(`  -> mapping to: idremark`);
                return 'idremark';
              case 'address':
                console.log(`  -> mapping to: address`);
                return 'address';
              case 'geo':
              case 'country':
                console.log(`  -> mapping to: geo`);
                return 'geo';
              case 'extension':
                console.log(`  -> mapping to: extension`);
                return 'extension';
              case 'gender':
                console.log(`  -> mapping to: gender`);
                return 'gender';
              case 'prefix':
                console.log(`  -> mapping to: prefix`);
                return 'prefix';
              case 'agent':
                console.log(`  -> mapping to: agent`);
                return 'agent';
              case 'facebook':
                console.log(`  -> mapping to: facebook`);
                return 'facebook';
              case 'twitter':
                console.log(`  -> mapping to: twitter`);
                return 'twitter';
              case 'linkedin':
                console.log(`  -> mapping to: linkedin`);
                return 'linkedin';
              case 'instagram':
                console.log(`  -> mapping to: instagram`);
                return 'instagram';
              case 'telegram':
                console.log(`  -> mapping to: telegram`);
                return 'telegram';
              default:
                // Remove spaces and convert to lowercase for other fields
                const result = normalized.replace(/\s+/g, '');
                console.log(`  -> default mapping to: ${result}`);
                return result;
            }
          },
          skipEmptyLines: true
        }))
        .on('data', (row) => {
          rowNumber++;

          // Debug: log the first row to see all available columns
          if (rowNumber === 2) {
            console.log('Available CSV columns:', Object.keys(row));
            console.log('First row data:', row);
          }

          // More flexible field detection using the correctly mapped headers
          const findField = (possibleNames) => {
            for (const name of possibleNames) {
              if (row[name] && row[name].toString().trim()) {
                return row[name].toString().trim();
              }
            }
            return '';
          };

          // Get email and address from the correctly mapped fields
          const emailValue = (row['newemail'] || '').toLowerCase();
          const addressValue = row['address'] || '';

          // Debug: Show what we found
          if (rowNumber <= 3) {
            console.log(`Row ${rowNumber} - Email: "${emailValue}", Address: "${addressValue}"`);
          }

          // If no email found, try to use old email as new email
          let finalEmailValue = emailValue;
          if (!finalEmailValue || !finalEmailValue.includes('@')) {
            const oldEmailValue = (row['oldemail'] || '').toLowerCase();
            if (oldEmailValue && oldEmailValue.includes('@')) {
              finalEmailValue = oldEmailValue;
              console.log(`Using old email as new email for row ${rowNumber}:`, finalEmailValue);
            }
          }

          // Handle multiple email addresses
          if (finalEmailValue.includes(' ')) {
            finalEmailValue = finalEmailValue.split(' ')[0]; // Take the first email if multiple
          }

          // If still no email found, skip this row
          if (!finalEmailValue || !finalEmailValue.includes('@')) {
            console.log(`Skipping row ${rowNumber} - no valid email found. Available data:`, Object.keys(row));
            return;
          }

          const lead = {
            leadType,
            createdBy: req.user.id,
            firstName: findField(['firstname']),
            lastName: findField(['lastname']),
            newEmail: finalEmailValue,
            newPhone: findField(['newphone']),
            country: findField(['geo']) || 'Unknown',
            gender: (findField(['gender']) || 'not_defined').toLowerCase(),
            oldEmail: (findField(['oldemail']) || '').toLowerCase(),
            oldPhone: findField(['oldphone']),
            prefix: findField(['prefix']),
            agent: findField(['agent']),
            extension: findField(['extension']),
            address: addressValue,
            socialMedia: {
              facebook: findField(['facebook']),
              twitter: findField(['twitter']),
              linkedin: findField(['linkedin']),
              instagram: findField(['instagram']),
              telegram: findField(['telegram'])
            },
            documents: [],
            dob: (() => {
              const dobValue = findField(['dateofbirth']);
              if (!dobValue) return null;
              try {
                // Handle DD/MM/YYYY format common in the CSV
                const dateParts = dobValue.split('/');
                if (dateParts.length === 3) {
                  const [day, month, year] = dateParts;
                  return new Date(year, month - 1, day); // Month is 0-indexed
                }
                return new Date(dobValue);
              } catch (error) {
                console.log(`Invalid date format for row ${rowNumber}: ${dobValue}`);
                return null;
              }
            })()
          };

          // Handle documents
          const documentFields = {
            idfront: { description: 'ID Front' },
            idback: { description: 'ID Back' },
            selfiefront: { description: 'Selfie Front' },
            selfieback: { description: 'Selfie Back' }
          };

          // Add documents that have URLs
          Object.entries(documentFields).forEach(([field, metadata]) => {
            const url = findField([field]);
            if (url) {
              lead.documents.push({
                url: url,
                description: metadata.description
              });
            }
          });

          // Clean up social media fields - handle both URL and non-URL formats
          Object.keys(lead.socialMedia).forEach(platform => {
            const value = lead.socialMedia[platform];
            if (!value) {
              delete lead.socialMedia[platform]; // Remove empty fields
            } else if (!value.startsWith('http')) {
              // If it's not a URL, store as is
              lead.socialMedia[platform] = value;
            }
          });

          // Debug: log the first few mapped leads
          if (rowNumber <= 3) {
            console.log(`Row ${rowNumber} mapped lead:`, {
              firstName: lead.firstName,
              lastName: lead.lastName,
              newEmail: lead.newEmail,
              address: lead.address,
              country: lead.country
            });
          }

          // Only add if we have minimum required data
          if (lead.firstName && lead.lastName && lead.newEmail) {
            leads.push(lead);
          } else {
            console.log(`Skipping row ${rowNumber} - missing required data:`, {
              firstName: !!lead.firstName,
              lastName: !!lead.lastName,
              newEmail: !!lead.newEmail
            });
          }
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });

    await parsePromise;

    // Save leads to database
    let savedLeads = [];
    if (leads.length > 0) {
      try {
        savedLeads = await Lead.insertMany(leads, { ordered: false });
      } catch (bulkError) {
        // If there are duplicate errors, just get what was saved
        savedLeads = bulkError.insertedDocs || [];
      }
    }

    // Return results
    res.status(200).json({
      success: true,
      message: `Successfully imported ${savedLeads.length} out of ${leads.length} leads`,
      data: {
        imported: savedLeads.length,
        total: leads.length
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
