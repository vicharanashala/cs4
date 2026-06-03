const mongoose = require('mongoose');

const sentimentAlertRuleSchema = new mongoose.Schema(
  {
    cohortId: {
      type: String,
      default: null,
    },
    thresholdType: {
      type: String,
      enum: ['absolute', 'relative'],
      default: 'relative',
    },
    thresholdValue: {
      type: Number,
      default: 25,
    },
    comparisonWindowDays: {
      type: Number,
      default: 7,
    },
    minPostVolume: {
      type: Number,
      default: 5,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SentimentAlertRule', sentimentAlertRuleSchema);
