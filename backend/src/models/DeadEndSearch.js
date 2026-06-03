const mongoose = require('mongoose');

const deadEndSearchSchema = new mongoose.Schema(
  {
    rawQuery: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true,
    },
    normalizedQuery: {
      type: String,
      required: true,
      maxlength: 200,
      index: true,
    },
    outcomeType: {
      type: String,
      enum: ['zero_results', 'no_click', 'converted_to_request'],
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      maxlength: 64,
      index: true,
    },
    cohortId: {
      type: String,
      default: null,
    },
    // Set by clustering job (Feature 3)
    clusterId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    convertedToRequest: {
      type: Boolean,
      default: false,
      index: true,
    },
    // FK to future Request model (Feature 1)
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index for server-side deduplication
deadEndSearchSchema.index({ sessionId: 1, normalizedQuery: 1 });
deadEndSearchSchema.index({ createdAt: -1 });

module.exports = mongoose.model('DeadEndSearch', deadEndSearchSchema);
