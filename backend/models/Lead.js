const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  // Common Fields
  leadType: { 
    type: String, 
    enum: ['ftd', 'filler', 'cold'], 
    required: true 
  },
  firstName: { 
    type: String, 
    required: true,
    trim: true
  },
  lastName: { 
    type: String,
    trim: true
  },
  email: { 
    type: String,
    lowercase: true,
    trim: true
  },
  phone: { 
    type: String,
    trim: true
  },
  country: { 
    type: String,
    trim: true
  },
  isAssigned: { 
    type: Boolean, 
    default: false 
  },
  assignedTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  assignedAt: {
    type: Date
  },

  // Social Media Fields
  socialMedia: {
    facebook: { type: String, trim: true },
    twitter: { type: String, trim: true },
    linkedin: { type: String, trim: true },
    instagram: { type: String, trim: true },
    telegram: { type: String, trim: true },
    whatsapp: { type: String, trim: true }
  },

  comments: [{
    text: {
      type: String,
      required: true
    },
    author: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      required: true
    },
    createdAt: { 
      type: Date, 
      default: Date.now 
    }
  }],

  // FTD & Filler Specific Fields
  dob: { type: Date },
  address: { 
    street: String, 
    city: String, 
    postalCode: String 
  },
  client: { 
    type: String,
    validate: {
      validator: function(v) {
        // Client should be unique for FTDs if provided
        if (this.leadType === 'ftd' && v) {
          return true; // Will be handled by unique index
        }
        return true;
      }
    }
  },
  clientBroker: { 
    type: String,
    validate: {
      validator: function(v) {
        // ClientBroker should be unique for FTDs if provided
        if (this.leadType === 'ftd' && v) {
          return true; // Will be handled by unique index
        }
        return true;
      }
    }
  },
  clientNetwork: { 
    type: String,
    validate: {
      validator: function(v) {
        // ClientNetwork should be unique for FTDs if provided
        if (this.leadType === 'ftd' && v) {
          return true; // Will be handled by unique index
        }
        return true;
      }
    }
  },

  // FTD Only Fields
  documents: {
    idFrontUrl: String,
    idBackUrl: String,
    selfieUrl: String,
    residenceProofUrl: String,
    status: { 
      type: String, 
      enum: ['good', 'ok', 'pending'],
      default: 'pending'
    }
  },

  // Additional tracking fields
  source: String, // Where the lead came from
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['active', 'contacted', 'converted', 'inactive'],
    default: 'active'
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create indexes for performance
leadSchema.index({ isAssigned: 1, leadType: 1, 'documents.status': 1 });
leadSchema.index({ leadType: 1 });
leadSchema.index({ country: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ client: 1 }, { sparse: true });
leadSchema.index({ clientBroker: 1 }, { sparse: true });
leadSchema.index({ clientNetwork: 1 }, { sparse: true });

// Virtual for full name
leadSchema.virtual('fullName').get(function() {
  return this.lastName ? `${this.firstName} ${this.lastName}` : this.firstName;
});

// Pre-save middleware
leadSchema.pre('save', function(next) {
  // Set assignedAt when lead is assigned
  if (this.isModified('isAssigned') && this.isAssigned && !this.assignedAt) {
    this.assignedAt = new Date();
  }
  
  // Clear assignedAt when lead is unassigned
  if (this.isModified('isAssigned') && !this.isAssigned) {
    this.assignedAt = undefined;
    this.assignedTo = undefined;
  }
  
  next();
});

// Static methods for lead queries
leadSchema.statics.findAvailableLeads = function(leadType, count, documentStatus = ['good', 'ok']) {
  const query = { 
    leadType, 
    isAssigned: false 
  };
  
  // Add document status filter for FTD leads
  if (leadType === 'ftd') {
    query['documents.status'] = { $in: documentStatus };
  }
  
  return this.find(query).limit(count);
};

leadSchema.statics.getLeadStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: {
          leadType: '$leadType',
          isAssigned: '$isAssigned'
        },
        count: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('Lead', leadSchema); 