const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Vote = require('../models/Vote');
const Log = require('../models/Log');
const UndoToken = require('../models/UndoToken');
const SearchCluster = require('../models/SearchCluster');
const DeadEndSearch = require('../models/DeadEndSearch');
const SentimentAlert = require('../models/SentimentAlert');
const { logEvent, getRequestMeta } = require('../middleware/logger');
const { runClusteringJob } = require('../utils/clusteringJob');
const { analyzeSentiment } = require('../utils/sentimentJob');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { createNotification } = require('./notificationController');

const makeUndoToken = async (adminId, action, targetType, targetId, snapshot) => {
  const token = uuidv4();
  await UndoToken.create({
    token,
    adminId,
    action,
    targetType,
    targetId,
    snapshot,
    expiresAt: new Date(Date.now() + 10_000),
  });
  return token;
};

// GET /api/admin/stats
exports.getStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalPosts,
      totalComments,
      totalVotes,
      bannedUsers,
      hiddenPosts,
      recentLogs,
      dailyPosts,
      dailyRegistrations,
    ] = await Promise.all([
      User.countDocuments(),
      Post.countDocuments({ isHidden: false }),
      Comment.countDocuments({ isHidden: false }),
      Vote.countDocuments(),
      User.countDocuments({ isBanned: true }),
      Post.countDocuments({ isHidden: true }),
      Log.find().sort({ createdAt: -1 }).limit(10).lean(),
      Post.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, isHidden: false }),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    ]);

    // Top active users by post count
    const topUsers = await User.find()
      .sort({ postCount: -1 })
      .limit(5)
      .select('username email postCount commentCount createdAt');

    // Posts per day (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const postsOverTime = await Post.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, isHidden: false } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      stats: {
        totalUsers,
        totalPosts,
        totalComments,
        totalVotes,
        bannedUsers,
        hiddenPosts,
        dailyPosts,
        dailyRegistrations,
      },
      topUsers,
      postsOverTime,
      recentActivity: recentLogs,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/users
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', role = '' } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const filter = {};
    if (search) {
      const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const esc = reEscape(search.slice(0, 50));
      filter.$or = [
        { username: { $regex: esc, $options: 'i' } },
        { email:    { $regex: esc, $options: 'i' } },
        { publicId: { $regex: esc, $options: 'i' } },
      ];
    }
    if (role) filter.role = role;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -refreshToken')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      User.countDocuments(filter),
    ]);

    res.json({ users, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/users
exports.createUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { username, email, password, role } = req.body;
    const user = await User.create({ username, email, password, role: role || 'user' });

    await logEvent({
      category: 'admin',
      action: 'user_created',
      severity: 'info',
      targetType: 'User',
      targetId: user._id,
      targetSnapshot: { username: user.username, role: user.role, publicId: user.publicId },
      ...getRequestMeta(req),
      details: { targetUserId: user._id, targetEmail: email, role },
    });

    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/users/:id
exports.updateUser = async (req, res, next) => {
  try {
    const { role, isBanned, banReason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot modify your own account this way' });
    }
    if (user.role === 'admin' && typeof isBanned === 'boolean' && isBanned) {
      return res.status(403).json({ error: 'Cannot ban another admin' });
    }

    const updates = {};
    if (role && ['user', 'admin'].includes(role)) updates.role = role;

    if (typeof isBanned === 'boolean') {
      updates.isBanned = isBanned;
      if (isBanned) {
        updates.bannedAt = new Date();
        updates.bannedBy = req.user._id;
        updates.banReason = banReason || 'Policy violation';
      } else {
        updates.$unset = { bannedAt: 1, bannedBy: 1, banReason: 1 };
      }
    }

    const updated = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password -refreshToken');

    const banAction = typeof isBanned === 'boolean' ? (isBanned ? 'user_banned' : 'user_unbanned') : 'user_updated';
    await logEvent({
      category: 'admin',
      action: banAction,
      severity: isBanned ? 'warn' : 'info',
      targetType: 'User',
      targetId: updated._id,
      targetSnapshot: typeof isBanned === 'boolean'
        ? { username: updated.username, email: updated.email, role: updated.role, isBanned: !!isBanned, banReason: banReason || null }
        : { username: updated.username, role: updated.role, publicId: updated.publicId },
      ...getRequestMeta(req),
      details: { targetUserId: req.params.id, changes: updates },
    });

    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await User.findByIdAndDelete(req.params.id);

    await logEvent({
      category: 'admin',
      action: 'user_deleted',
      severity: 'warn',
      targetType: 'User',
      targetId: user._id,
      targetSnapshot: { username: user.username, email: user.email, role: user.role, publicId: user.publicId },
      ...getRequestMeta(req),
      details: { targetUserId: req.params.id, targetEmail: user.email },
    });

    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/posts
exports.getPosts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, showHidden = 'false', search = '' } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));

    const filter = {};
    if (showHidden !== 'true') filter.isHidden = false;
    if (search) {
      const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const esc = reEscape(search.slice(0, 100));
      filter.$or = [
        { title:       { $regex: esc, $options: 'i' } },
        { description: { $regex: esc, $options: 'i' } },
      ];
    }

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('author', 'username email')
        .populate('hiddenBy', 'username'),
      Post.countDocuments(filter),
    ]);

    res.json({ posts, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/posts/:id/hide
exports.toggleHidePost = async (req, res, next) => {
  try {
    const { hide, reason } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const snapshot = { isHidden: post.isHidden, hiddenBy: post.hiddenBy, hiddenAt: post.hiddenAt, hideReason: post.hideReason };

    const updates = {
      isHidden: !!hide,
      hiddenBy: hide ? req.user._id : null,
      hiddenAt: hide ? new Date() : null,
      hideReason: hide ? (reason || 'Moderation action') : null,
    };

    await Post.findByIdAndUpdate(req.params.id, updates);

    await logEvent({
      category: 'admin',
      action: hide ? 'post_hidden' : 'post_restored',
      severity: hide ? 'warn' : 'info',
      targetType: 'Post',
      targetId: post._id,
      targetSnapshot: { title: post.title, isHidden: !!hide, hiddenBy: hide ? req.user._id : null, hiddenAt: hide ? new Date() : null, hideReason: hide ? (reason || 'Moderation action') : null, authorId: post.author },
      ...getRequestMeta(req),
      details: { postId: req.params.id, reason, title: post.title },
    });

    const undoToken = hide ? await makeUndoToken(req.user._id, 'unhide_post', 'Post', req.params.id, snapshot) : null;

    res.json({ message: hide ? 'Post hidden' : 'Post restored', undoToken });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/posts/:id/archive
exports.archivePost = async (req, res, next) => {
  try {
    const { archive, reason } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const snapshot = { isArchived: post.isArchived, archivedBy: post.archivedBy, archivedAt: post.archivedAt, archiveReason: post.archiveReason };

    const updates = archive
      ? { isArchived: true, archivedBy: req.user._id, archivedAt: new Date(), archiveReason: reason || 'Archived by admin' }
      : { isArchived: false, archivedBy: null, archivedAt: null, archiveReason: null };

    await Post.findByIdAndUpdate(req.params.id, updates);

    await logEvent({
      category: 'admin',
      action: archive ? 'post_archived' : 'post_unarchived',
      severity: archive ? 'warn' : 'info',
      targetType: 'Post',
      targetId: post._id,
      targetSnapshot: { title: post.title, isArchived: !!archive, archivedBy: archive ? req.user._id : null, archivedAt: archive ? new Date() : null, archiveReason: archive ? (reason || 'Archived by admin') : null, authorId: post.author },
      ...getRequestMeta(req),
      details: { postId: req.params.id, reason, title: post.title },
    });

    const undoToken = archive ? await makeUndoToken(req.user._id, 'unarchive_post', 'Post', req.params.id, snapshot) : null;

    res.json({ message: archive ? 'Post archived' : 'Post unarchived', undoToken });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/users/:id/timeout
exports.timeoutUser = async (req, res, next) => {
  try {
    const { durationMinutes, reason } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot timeout yourself' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot timeout another admin' });
    }

    const mins = parseInt(durationMinutes);
    if (!mins || mins < 1 || mins > 43200) {
      return res.status(400).json({ error: 'Duration must be 1–43200 minutes' });
    }

    const snapshot = { timeoutUntil: user.timeoutUntil, timeoutBy: user.timeoutBy, timeoutReason: user.timeoutReason };

    const timeoutUntil = new Date(Date.now() + mins * 60 * 1000);
    await User.findByIdAndUpdate(req.params.id, {
      timeoutUntil,
      timeoutBy: req.user._id,
      timeoutReason: reason || 'Moderation action',
    });

    await logEvent({
      category: 'admin',
      action: 'user_timed_out',
      severity: 'warn',
      targetType: 'User',
      targetId: user._id,
      targetSnapshot: { username: user.username, publicId: user.publicId, durationMinutes: mins, reason, timeoutUntil },
      ...getRequestMeta(req),
      details: { targetUserId: req.params.id, targetUsername: user.username, durationMinutes: mins, reason, until: timeoutUntil },
    });

    // Notify the user
    await createNotification({
      recipient: user._id,
      type: 'admin_message',
      message: `You have been timed out for ${mins} minute${mins !== 1 ? 's' : ''}. Reason: ${reason || 'Moderation action'}`,
    });

    const undoToken = await makeUndoToken(req.user._id, 'remove_timeout', 'User', req.params.id, snapshot);

    res.json({ message: `User timed out for ${mins} minutes`, timeoutUntil, undoToken });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/users/:id/timeout
exports.removeTimeout = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await User.findByIdAndUpdate(req.params.id, {
      timeoutUntil: null,
      timeoutBy: null,
      timeoutReason: null,
    });

    await logEvent({
      category: 'admin',
      action: 'user_timeout_removed',
      severity: 'info',
      targetType: 'User',
      targetId: user._id,
      targetSnapshot: { username: user.username, publicId: user.publicId },
      ...getRequestMeta(req),
      details: { targetUserId: req.params.id, targetUsername: user.username },
    });

    res.json({ message: 'Timeout removed' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/posts/:id/hard
exports.hardDeletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    await Promise.all([
      Post.findByIdAndDelete(req.params.id),
      Comment.deleteMany({ post: req.params.id }),
      Vote.deleteMany({ target: req.params.id, targetModel: 'Post' }),
    ]);

    await logEvent({
      category: 'admin',
      action: 'post_hard_deleted',
      level: 'warn',
      severity: 'warn',
      targetType: 'Post',
      targetId: post._id,
      targetSnapshot: { title: post.title, authorId: post.author, commentCount: post.commentCount, voteScore: post.voteScore },
      ...getRequestMeta(req),
      details: { postId: req.params.id, title: post.title, authorId: post.author },
    });

    res.json({ message: 'Post permanently deleted' });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/undo
exports.executeUndo = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Undo token required' });

    const undoToken = await UndoToken.findOne({ token });
    if (!undoToken) return res.status(404).json({ error: 'Invalid or expired undo token' });
    if (undoToken.used) return res.status(410).json({ error: 'Undo token already used' });
    if (undoToken.expiresAt < new Date()) return res.status(410).json({ error: 'Undo token has expired' });
    if (undoToken.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'This undo token belongs to a different admin' });
    }

    await UndoToken.findByIdAndUpdate(undoToken._id, { used: true });

    const { action, targetType, targetId, snapshot } = undoToken;

    if (targetType === 'Post') {
      await Post.findByIdAndUpdate(targetId, snapshot);
    } else if (targetType === 'User') {
      await User.findByIdAndUpdate(targetId, snapshot);
    }

    await logEvent({
      category: 'admin',
      action: `undo_${action}`,
      severity: 'info',
      tags: ['undo'],
      targetType,
      targetId,
      targetSnapshot: snapshot,
      ...getRequestMeta(req),
      details: { action, targetType, targetId, snapshot },
    });

    res.json({ message: `Action undone: ${action}` });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/posts/:id/pin
exports.pinPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const newPinned = !post.isPinned;
    await Post.findByIdAndUpdate(req.params.id, {
      isPinned: newPinned,
      pinnedAt: newPinned ? new Date() : null,
      pinnedBy: newPinned ? req.user._id : null,
    });

    await logEvent({
      category: 'admin',
      action: newPinned ? 'post_pinned' : 'post_unpinned',
      severity: 'info',
      targetType: 'Post',
      targetId: post._id,
      targetSnapshot: { title: post.title, isPinned: newPinned },
      ...getRequestMeta(req),
      details: { postId: req.params.id, title: post.title },
    });

    res.json({ message: newPinned ? 'Post pinned' : 'Post unpinned', isPinned: newPinned });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/logs
exports.getLogs = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 50,
      // dropdown filters
      category = '', level = '', severity = '', targetType = '', method = '',
      // broad search (OR across all text fields)
      search = '',
      // specific field filters (AND'd)
      username = '', userEmail = '', ip = '', action = '',
      userPublicId = '', deviceBrand = '', deviceFingerprint = '',
      // date range
      dateFrom = '', dateTo = '',
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const escape   = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re       = (s) => ({ $regex: escape(s.trim().slice(0, 100)), $options: 'i' });

    const filter = {};

    // ── Dropdown exact filters ────────────────────────────────────────────────
    if (category)   filter.category   = category;
    if (level)      filter.level      = level;
    if (severity)   filter.severity   = severity;
    if (targetType) filter.targetType = targetType;
    if (method)     filter.method     = method.toUpperCase();

    // ── Specific field filters (AND) ──────────────────────────────────────────
    if (username)          filter.username          = re(username);
    if (userEmail)         filter.userEmail         = re(userEmail);
    if (ip)                filter.ip                = re(ip);
    if (action)            filter.action            = re(action);
    if (userPublicId)      filter.userPublicId      = re(userPublicId);
    if (deviceBrand)       filter.deviceBrand       = re(deviceBrand);
    if (deviceFingerprint) filter.deviceFingerprint = escape(deviceFingerprint.trim());

    // ── Date range ────────────────────────────────────────────────────────────
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) { const d = new Date(dateFrom); if (!isNaN(d)) filter.createdAt.$gte = d; }
      if (dateTo)   { const d = new Date(dateTo);   if (!isNaN(d)) { d.setHours(23,59,59,999); filter.createdAt.$lte = d; } }
      if (!Object.keys(filter.createdAt).length) delete filter.createdAt;
    }

    // ── Broad search across all text fields (OR) ──────────────────────────────
    if (search) {
      const esc = escape(search.trim().slice(0, 100));
      const r   = { $regex: esc, $options: 'i' };
      filter.$or = [
        { action: r }, { userEmail: r }, { username: r }, { ip: r },
        { path: r }, { userPublicId: r }, { userRole: r },
        { deviceBrand: r }, { deviceModel: r }, { deviceOs: r },
        { deviceFingerprint: r }, { userAgent: r }, { sessionHint: r },
      ];
    }

    const [logs, total] = await Promise.all([
      Log.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      Log.countDocuments(filter),
    ]);

    res.json({ logs, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
  } catch (err) {
    next(err);
  }
};

// ── Search Gap Tracker ──────────────────────────────────────────────────────

// GET /api/admin/search-gaps
exports.getSearchGaps = async (req, res, next) => {
  try {
    const { status, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const clusterFilter = {};
    if (status && ['unresolved', 'in_progress', 'resolved'].includes(status)) {
      clusterFilter.status = status;
    }
    if (dateFrom || dateTo) {
      clusterFilter.lastSeen = {};
      if (dateFrom) clusterFilter.lastSeen.$gte = new Date(dateFrom);
      if (dateTo)   clusterFilter.lastSeen.$lte = new Date(dateTo);
    }

    const now    = new Date();
    const weekAgo = new Date(now - 7  * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [
      totalDeadEndsThisWeek,
      totalClusters,
      unresolvedClusters,
      resolvedThisMonth,
      clusters,
      total,
    ] = await Promise.all([
      DeadEndSearch.countDocuments({ createdAt: { $gte: weekAgo } }),
      SearchCluster.countDocuments(),
      SearchCluster.countDocuments({ status: 'unresolved' }),
      SearchCluster.countDocuments({ status: 'resolved', updatedAt: { $gte: monthAgo } }),
      SearchCluster.find(clusterFilter)
        .sort({ queryCount: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      SearchCluster.countDocuments(clusterFilter),
    ]);

    // Enrich each cluster with sample queries and trend
    const enriched = await Promise.all(
      clusters.map(async (cluster) => {
        const samples = await DeadEndSearch.find({ clusterId: cluster._id })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('normalizedQuery')
          .lean();

        // Compute trendIndicator: compare last 7 days count vs prior 7 days
        const [recentCount, priorCount] = await Promise.all([
          DeadEndSearch.countDocuments({ clusterId: cluster._id, createdAt: { $gte: weekAgo } }),
          DeadEndSearch.countDocuments({
            clusterId: cluster._id,
            createdAt: { $gte: new Date(now - 14 * 24 * 60 * 60 * 1000), $lt: weekAgo },
          }),
        ]);

        let trendIndicator = 'flat';
        if (recentCount > priorCount * 1.1)      trendIndicator = 'up';
        else if (recentCount < priorCount * 0.9)  trendIndicator = 'down';

        return {
          ...cluster,
          sampleQueries: samples.map((s) => s.normalizedQuery),
          trendIndicator: cluster.trend || trendIndicator,
        };
      })
    );

    res.json({
      summary: {
        totalDeadEnds: totalDeadEndsThisWeek,
        distinctClusters: totalClusters,
        unresolvedClusters,
        resolvedThisMonth,
      },
      clusters: enriched,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/search-gaps/:clusterId/status
exports.updateClusterStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['unresolved', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Use: unresolved, in_progress, resolved' });
    }

    const cluster = await SearchCluster.findByIdAndUpdate(
      req.params.clusterId,
      { status },
      { new: true }
    );
    if (!cluster) return res.status(404).json({ error: 'Cluster not found' });

    res.json({ cluster });
  } catch (err) {
    next(err);
  }
};

// ── Sentiment Pulse ─────────────────────────────────────────────────────────

const WINDOW_MAP = {
  '5min':  5  * 60 * 1000,
  '15min': 15 * 60 * 1000,
  '1h':    60 * 60 * 1000,
  '6h':    6  * 60 * 60 * 1000,
  '24h':   24 * 60 * 60 * 1000,
  '3d':    3  * 24 * 60 * 60 * 1000,
  '7d':    7  * 24 * 60 * 60 * 1000,
  '30d':   30 * 24 * 60 * 60 * 1000,
};

const BUCKET_MAP = {
  '5min':  5  * 60 * 1000,       // 1-min buckets
  '15min': 5  * 60 * 1000,       // 3-min buckets
  '1h':    10 * 60 * 1000,       // 10-min buckets
  '6h':    60 * 60 * 1000,       // 1-hour buckets
  '24h':   2  * 60 * 60 * 1000,  // 2-hour buckets
  '3d':    12 * 60 * 60 * 1000,  // 12-hour buckets
  '7d':    24 * 60 * 60 * 1000,  // 1-day buckets
  '30d':   24 * 60 * 60 * 1000,  // 1-day buckets
};

const sentimentLabel = (score) => {
  if (score >= 80) return 'Thriving';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Neutral';
  if (score >= 20) return 'Stressed';
  return 'Distressed';
};

// GET /api/admin/sentiment
exports.getSentiment = async (req, res, next) => {
  try {
    const { window: win = '7d', dateFrom, dateTo } = req.query;

    let startDate;
    if (dateFrom) {
      startDate = new Date(dateFrom);
    } else {
      const windowMs = WINDOW_MAP[win] || WINDOW_MAP['7d'];
      startDate = new Date(Date.now() - windowMs);
    }
    const endDate = dateTo ? new Date(dateTo) : new Date();

    const sentimentFilter = {
      'sentiment.score': { $ne: null },
      'sentiment.analyzedAt': { $gte: startDate, $lte: endDate },
    };

    const [posts, comments] = await Promise.all([
      Post.find(sentimentFilter).select('sentiment createdAt').lean(),
      Comment.find(sentimentFilter).select('sentiment createdAt').lean(),
    ]);

    const docs = [...posts, ...comments];

    if (docs.length < 3) {
      return res.json({ insufficientData: true });
    }

    const now = Date.now();
    let weightedSum = 0;
    let totalWeight = 0;
    const labelCounts = { positive: 0, neutral: 0, negative: 0, anxious: 0, frustrated: 0 };

    for (const doc of docs) {
      const hoursSince = (now - new Date(doc.createdAt).getTime()) / (1000 * 60 * 60);
      const weight = 1 / (1 + hoursSince * 0.1);
      weightedSum += doc.sentiment.score * weight;
      totalWeight += weight;

      const lbl = doc.sentiment.label;
      if (lbl && labelCounts.hasOwnProperty(lbl)) {
        labelCounts[lbl]++;
      }
    }

    const rawAvg = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const overallScore = Math.round((rawAvg + 1) * 50);

    const total = docs.length;
    const emotionBreakdown = {};
    for (const [key, count] of Object.entries(labelCounts)) {
      emotionBreakdown[key] = Math.round((count / total) * 100);
    }

    // Build time series
    const bucketMs = BUCKET_MAP[win] || BUCKET_MAP['7d'];
    const bucketMap = new Map();

    for (const doc of docs) {
      const t = new Date(doc.sentiment.analyzedAt).getTime();
      const bucket = Math.floor(t / bucketMs) * bucketMs;
      if (!bucketMap.has(bucket)) bucketMap.set(bucket, { scores: [], count: 0 });
      bucketMap.get(bucket).scores.push(doc.sentiment.score);
      bucketMap.get(bucket).count++;
    }

    const timeSeriesData = Array.from(bucketMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([ts, { scores, count }]) => {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return {
          timestamp: new Date(ts).toISOString(),
          score: Math.round((avg + 1) * 50),
          count,
        };
      });

    res.json({
      overallScore,
      label: sentimentLabel(overallScore),
      postCount: total,
      postBreakdown: { posts: posts.length, comments: comments.length },
      emotionBreakdown,
      timeSeriesData,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/sentiment/alerts
exports.getSentimentAlerts = async (req, res, next) => {
  try {
    const alerts = await SentimentAlert.find()
      .sort({ triggeredAt: -1 })
      .limit(50)
      .populate('acknowledgedBy', 'username')
      .lean();

    res.json({ alerts });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/sentiment/alerts/:alertId/acknowledge
exports.triggerClustering = async (req, res, next) => {
  try {
    const before = await DeadEndSearch.countDocuments({ clusterId: null });
    await runClusteringJob();
    const after = await DeadEndSearch.countDocuments({ clusterId: null });
    const assigned = before - after;
    const clusterCount = await SearchCluster.countDocuments();
    res.json({ success: true, assigned, clusterCount });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/sentiment/run-analysis
exports.runSentimentAnalysis = async (req, res, next) => {
  try {
    const [unanalyzedPosts, unanalyzedComments] = await Promise.all([
      Post.find({ 'sentiment.score': null, isHidden: false }).select('_id').lean(),
      Comment.find({ 'sentiment.score': null, isHidden: false }).select('_id').lean(),
    ]);

    const queued = unanalyzedPosts.length + unanalyzedComments.length;
    res.json({ success: true, queued });

    // Run in background sequentially to avoid hammering the API
    (async () => {
      for (const { _id } of unanalyzedPosts) {
        await analyzeSentiment(_id, 'Post');
      }
      for (const { _id } of unanalyzedComments) {
        await analyzeSentiment(_id, 'Comment');
      }
    })().catch(() => {});
  } catch (err) {
    next(err);
  }
};

exports.acknowledgeSentimentAlert = async (req, res, next) => {
  try {
    const { adminNote } = req.body;

    const alert = await SentimentAlert.findByIdAndUpdate(
      req.params.alertId,
      {
        acknowledgedBy: req.user._id,
        acknowledgedAt: new Date(),
        adminNote: adminNote || null,
      },
      { new: true }
    ).populate('acknowledgedBy', 'username');

    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    res.json({ alert });
  } catch (err) {
    next(err);
  }
};
