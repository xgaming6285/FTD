const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    // Common Fields
    leadType: {
      type: String,
      enum: ["ftd", "filler", "cold", "live"],
      required: [true, "Lead type is required"],
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    newEmail: {
      type: String,
      required: [true, "New email is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    oldEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    newPhone: {
      type: String,
      trim: true,
      required: [true, "New phone is required"],
    },
    oldPhone: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
    },
    isAssigned: {
      type: Boolean,
      default: false,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assignedAt: {
      type: Date,
    },
    client: {
      type: String,
      trim: true,
    },
    clientBroker: {
      type: String,
      trim: true,
    },
    clientNetwork: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "not_defined"],
      default: "not_defined",
      index: true, // Add index for better query performance
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      index: true, // Add index for better query performance
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true, // Add index for better query performance
    },

    // Social Media Fields
    socialMedia: {
      facebook: { type: String, trim: true },
      twitter: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      instagram: { type: String, trim: true },
      telegram: { type: String, trim: true },
      whatsapp: { type: String, trim: true },
    },

    comments: [
      {
        text: {
          type: String,
          required: true,
        },
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // FTD & Filler Specific Fields
    dob: { type: Date },
    address: {
      street: String,
      city: String,
      postalCode: String,
    },

    // FTD Only Fields
    documents: {
      idFrontUrl: String,
      idBackUrl: String,
      selfieUrl: String,
      residenceProofUrl: String,
      status: {
        type: String,
        enum: ["good", "ok", "pending"],
        default: "pending",
      },
    },
    sin: {
      type: String,
      trim: true,
      sparse: true,
      validate: {
        validator: function (v) {
          // Only validate if the lead type is ftd
          if (this.leadType === "ftd") {
            return v && v.length > 0;
          }
          return true;
        },
        message: "SIN is required for FTD leads",
      },
    },

    // Additional tracking fields
    source: String, // Where the lead came from
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["active", "contacted", "converted", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create indexes for performance
leadSchema.index({ isAssigned: 1, leadType: 1, "documents.status": 1 });
leadSchema.index({ leadType: 1 });
leadSchema.index({ country: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ client: 1 }, { sparse: true });
leadSchema.index({ clientBroker: 1 }, { sparse: true });
leadSchema.index({ clientNetwork: 1 }, { sparse: true });

// Virtual for full name
leadSchema.virtual("fullName").get(function () {
  return this.lastName ? `${this.firstName} ${this.lastName}` : this.firstName;
});

// Pre-save middleware
leadSchema.pre("save", function (next) {
  // Set assignedAt when lead is assigned
  if (this.isModified("isAssigned") && this.isAssigned && !this.assignedAt) {
    this.assignedAt = new Date();
  }

  // Clear assignedAt when lead is unassigned
  if (this.isModified("isAssigned") && !this.isAssigned) {
    this.assignedAt = undefined;
    this.assignedTo = undefined;
  }

  next();
});

// Static methods for lead queries
leadSchema.statics.findAvailableLeads = function (
  leadType,
  count,
  documentStatus = ["good", "ok", "pending"]
) {
  const query = {
    leadType,
    isAssigned: false,
  };

  // Add document status filter for FTD leads
  if (leadType === "ftd") {
    query["documents.status"] = { $in: documentStatus };
  }

  return this.find(query).limit(count);
};

leadSchema.statics.getLeadStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: {
          leadType: "$leadType",
          isAssigned: "$isAssigned",
        },
        count: { $sum: 1 },
      },
    },
  ]);
};

module.exports = mongoose.model("Lead", leadSchema);
