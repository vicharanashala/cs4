const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const mentionSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/users/search?q=prefix  — for @mention autocomplete
// Empty q returns top users by postCount (for the initial @ popup)
router.get('/search', verifyToken, mentionSearchLimiter, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();

    let users;
    if (!q) {
      // No query — return top 8 users by postCount (excluding self)
      users = await User.find({ _id: { $ne: req.user._id } })
        .sort({ postCount: -1 })
        .limit(8)
        .select('username publicId role')
        .lean();
    } else {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 30);
      users = await User.find({
        username: { $regex: `^${escaped}`, $options: 'i' },
        _id: { $ne: req.user._id },
      })
        .select('username publicId role')
        .limit(8)
        .lean();
    }

    res.json({ users });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
