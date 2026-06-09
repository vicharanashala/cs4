const User = require('../models/User');

const MENTION_REGEX = /@([a-zA-Z0-9_]{3,30})/g;

const parseMentions = async (content) => {
  const matches = [...content.matchAll(MENTION_REGEX)];
  if (!matches.length) return [];

  const rawUsernames = [...new Set(matches.map((m) => m[1]))];
  const usernames = rawUsernames.slice(0, 10); // cap at 10 mentions per comment

  // Case-insensitive lookup; use exact-match anchored regex to avoid partial matches
  const regexes = usernames.map((u) => new RegExp(`^${u}$`, 'i'));
  const users = await User.find({ username: { $in: regexes } })
    .select('_id username publicId')
    .lean();

  return users.map((u) => ({ userId: u._id, username: u.username, publicId: u.publicId }));
};

module.exports = { parseMentions, MENTION_REGEX };
