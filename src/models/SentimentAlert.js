const mongoose = require('mongoose');

const sentimentAlertSchema = new mongoose.Schema(
  {
    cohortId: {
      type: String,
      default: null,
    },
    triggerType: {
      type: String,
      required: true,
    },
    currentScore: {
      type: Number,
      required: true,
    },
    previousScore: {
      type: Number,
      required: true,
    },
    delta: {
      type: Number,
      required: true,
    },
    postCount: {
      type: Number,
      required: true,
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    adminNote: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SentimentAlert', sentimentAlertSchema);
