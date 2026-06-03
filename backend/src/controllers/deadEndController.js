const DeadEndSearch = require('../models/DeadEndSearch');

function normalizeQuery(q) {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

// POST /api/forum/dead-end
exports.logDeadEnd = async (req, res, next) => {
  try {
    const { query, normalizedQuery, outcomeType, sessionId } = req.body;

    // Validate session ID
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 64) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    // Normalize server-side (don't trust client normalization)
    const norm = normalizeQuery(normalizedQuery || query || '');

    if (norm.length < 3) return res.json({ logged: false });
    if (norm.length > 200) return res.status(400).json({ error: 'Query too long' });

    // Reject queries that are purely numeric or single punctuation
    if (/^\d+$/.test(norm) || /^[^a-z0-9]+$/i.test(norm)) {
      return res.json({ logged: false });
    }

    if (!['zero_results', 'no_click', 'converted_to_request'].includes(outcomeType)) {
      return res.status(400).json({ error: 'Invalid outcome type' });
    }

    // Server-side dedup: one log per session + normalizedQuery
    const exists = await DeadEndSearch.exists({ sessionId, normalizedQuery: norm });
    if (exists) return res.json({ logged: false, duplicate: true });

    await DeadEndSearch.create({
      rawQuery: String(query || norm).slice(0, 200),
      normalizedQuery: norm,
      outcomeType,
      sessionId,
      cohortId: null,
    });

    res.json({ logged: true });
  } catch (err) {
    next(err);
  }
};
