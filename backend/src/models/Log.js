const mongoose = require('mongoose');
const { Schema } = mongoose;

const logSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ['info', 'warn', 'error'],
      default: 'info',
      index: true,
    },
    category: {
      type: String,
      enum: ['auth', 'post', 'comment', 'vote', 'admin', 'system', 'security'],
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    userEmail:  { type: String, default: null },
    username:   { type: String, default: null },
    ip:         { type: String, default: null },
    userAgent:  { type: String, default: null },
    details:    { type: Schema.Types.Mixed, default: {} },

    // Target
    targetType:     { type: String, default: null },
    targetId:       { type: Schema.Types.ObjectId, default: null },
    targetSnapshot: { type: Schema.Types.Mixed, default: {} },

    // Request context
    method:     { type: String, default: null },
    path:       { type: String, default: null },
    statusCode: { type: Number, default: null },
    durationMs: { type: Number, default: null },
    query:      { type: Schema.Types.Mixed, default: {} },
    body:       { type: Schema.Types.Mixed, default: {} },

    // Network
    referer: { type: String, default: null },
    origin:  { type: String, default: null },

    // Extended user context
    userRole:     { type: String, default: null },
    userPublicId: { type: String, default: null },

    // Event metadata
    tags:        { type: [String], default: [] },
    severity:    { type: String, enum: ['debug', 'info', 'warn', 'error', 'critical'], default: 'info' },
    sessionHint: { type: String, default: null },

    // Device identity
    deviceFingerprint: { type: String, default: null },
    deviceBrand:       { type: String, default: null },
    deviceModel:       { type: String, default: null },
    deviceOs:          { type: String, default: null },
  },
  { timestamps: true }
);

logSchema.index({ createdAt: -1 });
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Log', logSchema);
