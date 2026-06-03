const mongoose = require('mongoose');

const searchClusterSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    queryCount: {
      type: Number,
      default: 0,
    },
    firstSeen: {
      type: Date,
      default: Date.now,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['unresolved', 'in_progress', 'resolved'],
      default: 'unresolved',
      index: true,
    },
    faqEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    trend: {
      type: String,
      enum: ['up', 'flat', 'down'],
      default: 'flat',
    },
    lastClusteredAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

searchClusterSchema.index({ status: 1, lastClusteredAt: -1 });

module.exports = mongoose.model('SearchCluster', searchClusterSchema);
