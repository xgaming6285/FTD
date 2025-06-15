const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Lead = require("../models/Lead");

// @desc    Create a new order and pull leads
// @route   POST /api/orders
// @access  Private (Admin, Manager with canCreateOrders permission)
exports.createOrder = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const {
      requests,
      priority,
      notes,
      country,
      gender,
      excludeClients = [],
      excludeBrokers = [],
      excludeNetworks = [],
    } = req.body;

    const { ftd = 0, filler = 0, cold = 0, live = 0 } = requests || {};

    if (ftd + filler + cold + live === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one lead type must be requested",
      });
    }

    const pulledLeads = [];
    const fulfilled = { ftd: 0, filler: 0, cold: 0, live: 0 };

    // Base query filters for country and gender if specified
    const countryFilter = country ? { country: new RegExp(country, "i") } : {};
    const genderFilter = gender ? { gender } : {};

    // Build exclusion filters
    const exclusionFilters = {};

    if (excludeClients.length > 0) {
      exclusionFilters.client = { $nin: excludeClients };
    }

    if (excludeBrokers.length > 0) {
      exclusionFilters.clientBroker = { $nin: excludeBrokers };
    }

    if (excludeNetworks.length > 0) {
      exclusionFilters.clientNetwork = { $nin: excludeNetworks };
    }

    // Pull FTD leads
    if (ftd > 0) {
      const ftdLeads = await Lead.find({
        leadType: "ftd",
        ...countryFilter,
        ...genderFilter,
        ...exclusionFilters,
      }).limit(ftd);

      if (ftdLeads.length > 0) {
        pulledLeads.push(...ftdLeads);
        fulfilled.ftd = ftdLeads.length;
      }
    }

    // Pull Filler leads
    if (filler > 0) {
      const fillerLeads = await Lead.find({
        leadType: "filler",
        ...countryFilter,
        ...genderFilter,
        ...exclusionFilters,
      }).limit(filler);

      if (fillerLeads.length > 0) {
        pulledLeads.push(...fillerLeads);
        fulfilled.filler = fillerLeads.length;
      }
    }

    // Pull Cold leads
    if (cold > 0) {
      const coldLeads = await Lead.find({
        leadType: "cold",
        ...countryFilter,
        ...genderFilter,
        ...exclusionFilters,
      }).limit(cold);

      if (coldLeads.length > 0) {
        pulledLeads.push(...coldLeads);
        fulfilled.cold = coldLeads.length;
      }
    }

    // Pull Live leads
    if (live > 0) {
      const liveLeads = await Lead.find({
        leadType: "live",
        ...countryFilter,
        ...genderFilter,
        ...exclusionFilters,
      }).limit(live);

      if (liveLeads.length > 0) {
        pulledLeads.push(...liveLeads);
        fulfilled.live = liveLeads.length;
      }
    }

    // Determine order status based on fulfillment
    const totalRequested = ftd + filler + cold + live;
    const totalFulfilled =
      fulfilled.ftd + fulfilled.filler + fulfilled.cold + fulfilled.live;

    let orderStatus;
    if (totalFulfilled === 0) {
      orderStatus = "cancelled";
    } else if (
      totalFulfilled === totalRequested &&
      fulfilled.ftd === ftd &&
      fulfilled.filler === filler &&
      fulfilled.cold === cold &&
      fulfilled.live === live
    ) {
      orderStatus = "fulfilled";
    } else {
      orderStatus = "partial";
    }

    // Create the order first
    const order = new Order({
      requester: req.user._id,
      requests: { ftd, filler, cold, live },
      fulfilled,
      leads: pulledLeads.map((l) => l._id),
      priority: priority || "medium",
      notes,
      status: orderStatus,
      countryFilter: country || null,
      genderFilter: gender || null,
      excludeClients: excludeClients.length > 0 ? excludeClients : undefined,
      excludeBrokers: excludeBrokers.length > 0 ? excludeBrokers : undefined,
      excludeNetworks: excludeNetworks.length > 0 ? excludeNetworks : undefined,
      // Set cancellation details if no leads available
      ...(orderStatus === "cancelled" && {
        cancelledAt: new Date(),
        cancellationReason:
          "No leads available matching the requested criteria and exclusion filters",
      }),
    });

    await order.save();

    // Then update leads with the order ID
    if (pulledLeads.length > 0) {
      await Lead.updateMany(
        { _id: { $in: pulledLeads.map((l) => l._id) } },
        {
          $set: {
            // Keep assignment tracking for audit purposes, but don't block reuse
            assignedTo: req.user._id,
            assignedAt: new Date(),
            orderId: order._id,
          },
        }
      );

      // Verify the update was successful
      const updatedLeads = await Lead.find({
        _id: { $in: pulledLeads.map((l) => l._id) },
      });

      // Check if any leads weren't properly updated
      const notUpdated = updatedLeads.filter(
        (lead) =>
          !lead.orderId || lead.orderId.toString() !== order._id.toString()
      );

      if (notUpdated.length > 0) {
        // If any leads weren't updated, delete the order and throw an error
        await Order.findByIdAndDelete(order._id);
        throw new Error(
          `Failed to update orderId for ${notUpdated.length} leads`
        );
      }
    }

    // Populate the order for response
    await order.populate([
      { path: "requester", select: "fullName email role" },
      {
        path: "leads",
        select: "leadType firstName lastName country email phone orderId",
      },
    ]);

    // Enhanced success message with exclusion details
    let exclusionMessage = "";
    if (excludeClients.length > 0) {
      exclusionMessage += ` (excluded clients: ${excludeClients.join(", ")})`;
    }
    if (excludeBrokers.length > 0) {
      exclusionMessage += ` (excluded brokers: ${excludeBrokers.join(", ")})`;
    }
    if (excludeNetworks.length > 0) {
      exclusionMessage += ` (excluded networks: ${excludeNetworks.join(", ")})`;
    }

    res.status(201).json({
      success: true,
      message: (() => {
        let msg = `Order created with ${pulledLeads.length} leads`;
        if (orderStatus === "fulfilled") {
          msg += " - fully fulfilled";
        } else if (orderStatus === "partial") {
          msg += ` - partially fulfilled (${totalFulfilled}/${totalRequested} leads)`;
        } else {
          msg += " - cancelled (no leads available)";
        }
        if (country) msg += ` from ${country}`;
        if (gender) msg += ` with gender: ${gender}`;
        msg += exclusionMessage;
        return msg;
      })(),
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get orders (Admin sees all, Manager sees own)
// @route   GET /api/orders
// @access  Private (Admin, Manager)
exports.getOrders = async (req, res, next) => {
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
      page = 1,
      limit = 10,
      status,
      priority,
      startDate,
      endDate,
    } = req.query;

    // Build query
    let query = {};

    // Role-based filtering
    if (req.user.role !== "admin") {
      query.requester = req.user._id;
    }

    // Apply filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get orders with pagination
    const orders = await Order.find(query)
      .populate("requester", "fullName email role")
      .populate({
        path: "leads",
        select:
          "leadType firstName lastName country newEmail newPhone oldEmail oldPhone gender dob address sin client clientBroker clientNetwork socialMedia status priority source assignedTo assignedAt createdAt documents comments",
        populate: [
          {
            path: "assignedTo",
            select: "fullName email",
          },
          {
            path: "comments.author",
            select: "fullName",
          },
        ],
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private (Admin, Manager - own orders only)
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("requester", "fullName email role")
      .populate({
        path: "leads",
        populate: [
          {
            path: "assignedTo",
            select: "fullName email",
          },
          {
            path: "comments.author",
            select: "fullName",
          },
        ],
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check permission (non-admin can only see their own orders)
    if (
      req.user.role !== "admin" &&
      order.requester._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order details
// @route   PUT /api/orders/:id
// @access  Private (Admin, Manager - own orders only)
exports.updateOrder = async (req, res, next) => {
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

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check permission
    if (
      req.user.role !== "admin" &&
      order.requester.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this order",
      });
    }

    const { priority, notes } = req.body;

    if (priority) order.priority = priority;
    if (notes !== undefined) order.notes = notes;

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel order
// @route   DELETE /api/orders/:id
// @access  Private (Admin, Manager - own orders only)
exports.cancelOrder = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { reason } = req.body;

    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Check permission
      if (
        req.user.role !== "admin" &&
        order.requester.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to cancel this order",
        });
      }

      if (order.status === "cancelled") {
        return res.status(400).json({
          success: false,
          message: "Order is already cancelled",
        });
      }

      // Unassign leads
      await Lead.updateMany(
        { _id: { $in: order.leads } },
        {
          $set: {
            isAssigned: false,
            assignedTo: null,
            assignedAt: null,
          },
        },
        { session }
      );

      // Update order
      order.status = "cancelled";
      order.cancelledAt = new Date();
      order.cancellationReason = reason;

      await order.save({ session });

      res.status(200).json({
        success: true,
        message: "Order cancelled successfully",
        data: order,
      });
    });
  } catch (error) {
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc    Get order statistics
// @route   GET /api/orders/stats
// @access  Private (Admin, Manager)
exports.getOrderStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Build match stage for aggregation
    let matchStage = {};

    // Role-based filtering
    if (req.user.role !== "admin") {
      matchStage.requester = new mongoose.Types.ObjectId(req.user._id);
    }

    // Date filtering
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const stats = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalRequested: {
            $sum: {
              $add: [
                "$requests.ftd",
                "$requests.filler",
                "$requests.cold",
                "$requests.live",
              ],
            },
          },
          totalFulfilled: {
            $sum: {
              $add: [
                "$fulfilled.ftd",
                "$fulfilled.filler",
                "$fulfilled.cold",
                "$fulfilled.live",
              ],
            },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export leads from order as CSV
// @route   GET /api/orders/:id/export
// @access  Private (Admin, Manager - own orders only)
exports.exportOrderLeads = async (req, res, next) => {
  try {
    const orderId = req.params.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // Get order and check ownership
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user can access this order (Admin or owns the order)
    if (
      req.user.role !== "admin" &&
      order.requester.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Get all leads for this order
    const leads = await Lead.find({ orderId: orderId })
      .populate("assignedTo", "fullName")
      .populate("createdBy", "fullName")
      .sort({ createdAt: -1 });

    if (leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No leads found for this order",
      });
    }

    // Generate CSV content
    const csvHeaders = [
      "Lead Type",
      "First Name",
      "Last Name",
      "Email",
      "Prefix",
      "Phone",
      "Country",
      "Gender",
      "Status",
      "DOB",
      "Address",
      "Old Email",
      "Old Phone",
      "Client",
      "Client Broker",
      "Client Network",
      "Facebook",
      "Twitter",
      "LinkedIn",
      "Instagram",
      "Telegram",
      "WhatsApp",
      "ID front",
      "ID back",
      "Selfie front",
      "Selfie back",
      "Assigned To",
      "Created By",
      "Created At",
      "Assigned At",
    ];

    // Helper function to format dates for Excel compatibility
    const formatDateForExcel = (date) => {
      if (!date) return "";
      const d = new Date(date);
      if (isNaN(d.getTime())) return "";

      // Format as DD/MM/YYYY which is more Excel-friendly
      const day = d.getDate().toString().padStart(2, "0");
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      const year = d.getFullYear();

      return `${day}/${month}/${year}`;
    };

    // Helper function to extract document URL by description
    const getDocumentUrl = (documents, description) => {
      if (!documents || !Array.isArray(documents)) return "";
      const doc = documents.find(
        (d) =>
          d.description &&
          d.description.toLowerCase().includes(description.toLowerCase())
      );
      return doc ? doc.url || "" : "";
    };

    // Convert leads to CSV rows
    const csvRows = leads.map((lead) => [
      lead.leadType || "",
      lead.firstName || "",
      lead.lastName || "",
      lead.newEmail || "",
      lead.prefix || "",
      lead.newPhone || "",
      lead.country || "",
      lead.gender || "",
      lead.status || "",
      formatDateForExcel(lead.dob),
      lead.address || "",
      lead.oldEmail || "",
      lead.oldPhone || "",
      lead.client || "",
      lead.clientBroker || "",
      lead.clientNetwork || "",
      lead.socialMedia?.facebook || "",
      lead.socialMedia?.twitter || "",
      lead.socialMedia?.linkedin || "",
      lead.socialMedia?.instagram || "",
      lead.socialMedia?.telegram || "",
      lead.socialMedia?.whatsapp || "",
      getDocumentUrl(lead.documents, "ID Front"),
      getDocumentUrl(lead.documents, "ID Back"),
      getDocumentUrl(lead.documents, "Selfie with ID Front"),
      getDocumentUrl(lead.documents, "Selfie with ID Back"),
      lead.assignedTo?.fullName || "",
      lead.createdBy?.fullName || "",
      formatDateForExcel(lead.createdAt),
      formatDateForExcel(lead.assignedAt),
    ]);

    // Helper function to escape CSV values
    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) return "";
      const stringValue = String(value);
      // If the value contains comma, double quote, or newline, wrap in quotes and escape quotes
      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Build CSV content
    const csvContent = [
      csvHeaders.map(escapeCsvValue).join(","),
      ...csvRows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    // Set response headers for file download
    const filename = `order_${orderId}_leads_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");

    // Send CSV content
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("Export error:", error);
    next(error);
  }
};

// @desc    Assign client, broker, and network info to all leads in order
// @route   PUT /api/orders/:id/assign-client-info
// @access  Private (Admin, Manager - own orders only)
exports.assignClientInfoToOrderLeads = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const orderId = req.params.id;
    const { client, clientBroker, clientNetwork } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // Get order and check ownership
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user can access this order (Admin or owns the order)
    if (
      req.user.role !== "admin" &&
      order.requester.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Build update object with only provided fields
    const updateData = {};
    if (client !== undefined) updateData.client = client;
    if (clientBroker !== undefined) updateData.clientBroker = clientBroker;
    if (clientNetwork !== undefined) updateData.clientNetwork = clientNetwork;

    // Update all leads in the order
    const updateResult = await Lead.updateMany(
      { orderId: orderId },
      { $set: updateData }
    );

    // Get updated leads count
    const updatedLeadsCount = updateResult.modifiedCount;

    res.status(200).json({
      success: true,
      message: `Successfully updated client information for ${updatedLeadsCount} leads in the order`,
      data: {
        orderId: orderId,
        updatedLeadsCount: updatedLeadsCount,
        clientInfo: updateData,
      },
    });
  } catch (error) {
    console.error("Assign client info error:", error);
    next(error);
  }
};

// @desc    Get unique client, broker, and network values for exclusion filters
// @route   GET /api/orders/exclusion-options
// @access  Private (Admin, Manager with canCreateOrders permission)
exports.getExclusionOptions = async (req, res, next) => {
  try {
    // Get unique client values
    const clients = await Lead.distinct("client", {
      client: { $ne: null, $ne: "" },
    });

    // Get unique broker values
    const brokers = await Lead.distinct("clientBroker", {
      clientBroker: { $ne: null, $ne: "" },
    });

    // Get unique network values
    const networks = await Lead.distinct("clientNetwork", {
      clientNetwork: { $ne: null, $ne: "" },
    });

    res.status(200).json({
      success: true,
      data: {
        clients: clients.sort(),
        brokers: brokers.sort(),
        networks: networks.sort(),
      },
    });
  } catch (error) {
    next(error);
  }
};
