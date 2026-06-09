const mongoose = require('mongoose');

const POST_TAGS = [
  'About VINS', 'Timing & Dates', 'NOC', 'Selection & Offer',
  'Work & Mentorship', 'Code of Conduct', 'Interviews', 'Certificate',
  'Rosetta', 'Phase 1 & ViBe', 'Yaksha Chat', 'ViBe Platform',
  'Team Formation', 'General', 'Technical', 'Help Needed', 'Announcements', 'Off-topic',
  'Ignored Similar Post',
];

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    imageUrl: {
      type: String,
      default: null,
      validate: {
        validator: (v) => !v || /^https?:\/\/.+/.test(v),
        message: 'Image URL must be a valid URL',
      },
    },
    tags: {
      type: [String],
      validate: {
        validator: (v) => v.length <= 6,
        message: 'Maximum 5 tags allowed',
      },
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    voteScore: { type: Number, default: 0, index: true },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    isHidden: { type: Boolean, default: false, index: true },
    hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    hiddenAt: { type: Date, default: null },
    hideReason: { type: String, default: null },
    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    archiveReason: { type: String, default: null },
    isPinned: { type: Boolean, default: false, index: true },
    pinnedAt: { type: Date, default: null },
    pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastCommentAt: { type: Date, default: null, index: true },
    // Populated asynchronously by the sentiment analysis job (Feature 2)
    sentiment: {
      score: { type: Number, default: null },       // raw float -1.0 to 1.0
      label: { type: String, default: null },       // positive/neutral/negative/anxious/frustrated
      analyzedAt: { type: Date, default: null },
      source: { type: String, default: null },      // api/library/pending/unanalyzed
      _id: false,
    },
  },
  { timestamps: true }
);

postSchema.index({ title: 'text', description: 'text', tags: 'text' });
postSchema.index({ createdAt: -1 });
postSchema.index({ voteScore: -1 });

module.exports = mongoose.model('Post', postSchema);
module.exports.POST_TAGS = POST_TAGS;
