const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    target: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'targetModel',
    },
    targetModel: {
      type: String,
      required: true,
      enum: ['Post', 'Comment'],
    },
    value: {
      type: Number,
      required: true,
      enum: [1, -1],
    },
  },
  { timestamps: true }
);

// One vote per user per target
voteSchema.index({ user: 1, target: 1 }, { unique: true });
voteSchema.index({ target: 1, targetModel: 1 });

module.exports = mongoose.model('Vote', voteSchema);
