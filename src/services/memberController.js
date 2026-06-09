const User = require('../models/User');
const { onlineUsers } = require('../lib/socketServer');
const { logEvent, getRequestMeta } = require('../middleware/logger');

const ESCAPE_REGEX = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/admin/members
exports.getMembers = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search = '', role = '', status = '' } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const filter = {};
    if (search) {
      const escaped = ESCAPE_REGEX(search.slice(0, 50));
      filter.username = { $regex: escaped, $options: 'i' };
    }
    if (role && ['user', 'admin'].includes(role)) filter.role = role;
    if (status === 'banned') filter.isBanned = true;
    if (status === 'timedout') filter.timeoutUntil = { $gt: new Date() };

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('username publicId role isBanned timeoutUntil postCount commentCount createdAt')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    const onlineSet = new Set(onlineUsers.keys());
    const enriched = users.map((u) => ({
      ...u,
      isOnline: onlineSet.has(u._id.toString()),
      isTimedOut: !!(u.timeoutUntil && u.timeoutUntil > new Date()),
    }));

    await logEvent({
      category: 'admin',
      action: 'member_list_viewed',
      ...getRequestMeta(req),
      details: { search: search.slice(0, 50), page: pageNum },
    });

    res.json({ users: enriched, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/members/online
exports.getOnlineMembers = async (req, res, next) => {
  try {
    const onlineIds = [...onlineUsers.keys()];
    if (!onlineIds.length) return res.json({ users: [], count: 0 });

    const users = await User.find({ _id: { $in: onlineIds } })
      .select('username publicId role')
      .lean();

    res.json({ users, count: users.length });
  } catch (err) {
    next(err);
  }
};
