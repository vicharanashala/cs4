const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      minlength: [1, 'Comment cannot be empty'],
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    voteScore: { type: Number, default: 0 },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    depth: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    isHidden: { type: Boolean, default: false },
    mentions: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      username: String,
      publicId: String,
    }],
    // Populated asynchronously by the sentiment analysis job (Feature 2)
    sentiment: {
      score: { type: Number, default: null },
      label: { type: String, default: null },
      analyzedAt: { type: Date, default: null },
      source: { type: String, default: null },
      _id: false,
    },
  },
  { timestamps: true }
);

commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ post: 1, parent: 1 });

module.exports = mongoose.model('Comment', commentSchema);
