const Notification = require('../models/Notification');
const { emitToUser } = require('../lib/socketServer');

// Creates a notification and emits it via Socket.io
const createNotification = async ({ recipient, type, actor, post, comment, message }) => {
  if (!recipient) return;
  // Don't notify yourself
  if (actor && actor.toString() === recipient.toString()) return;

  try {
    const doc = await Notification.create({ recipient, type, actor, post, comment, message });
    const populated = await Notification.findById(doc._id)
      .populate('actor', 'username publicId')
      .populate('post', 'title')
      .lean();
    emitToUser(recipient, 'notification', populated);
    return populated;
  } catch (err) {
    // Non-fatal — notifications should never block the main flow
    console.error('[notification] Failed to create:', err.message);
  }
};

// GET /api/notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user._id })
        .sort({ createdAt: -1 })
        .limit(30)
        .populate('actor', 'username publicId')
        .populate('post', 'title')
        .lean(),
      Notification.countDocuments({ recipient: req.user._id, read: false }),
    ]);
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
};

// PUT /api/notifications/read-all
exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/notifications/:id/read
exports.markOneRead = async (req, res, next) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, recipient: req.user._id },
      { read: true }
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
};

module.exports = { ...module.exports, createNotification };
