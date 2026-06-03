const xss = require('xss');
const { validationResult } = require('express-validator');
const Post = require('../models/Post');
const { POST_TAGS } = require('../models/Post');
const Comment = require('../models/Comment');
const Vote = require('../models/Vote');
const User = require('../models/User');
const { containsProfanity } = require('../utils/profanity');
const { openrouterRequest } = require('../utils/openrouter');
const { logEvent, getRequestMeta } = require('../middleware/logger');
const { parseMentions } = require('../utils/parseMentions');
const { createNotification } = require('./notificationController');
const { analyzeSentiment } = require('../utils/sentimentJob');
const { getIo } = require('../utils/socketServer');

const sanitize = (text) => xss(text, { whiteList: {}, stripIgnoreTag: true });

// GET /api/forum/posts
exports.getPosts = async (req, res, next) => {
  try {
    const {
      sort = 'top',
      period = 'all',
      page = 1,
      limit = 20,
      search = '',
      tags = '',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = { isHidden: false };

    if (search.trim()) {
      const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const esc = reEscape(search.trim().slice(0, 100));
      filter.$or = [
        { title:       { $regex: esc, $options: 'i' } },
        { description: { $regex: esc, $options: 'i' } },
      ];
    }

    // Tag filter
    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) filter.tags = { $in: tagList };
    }

    // Time-based filter for period
    if (period !== 'all') {
      const periodMap = { day: 1, week: 7, month: 30 };
      const days = periodMap[period] || 7;
      filter.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }

    // Sort options — pinned posts always float to the top
    const sortMap = {
      top: { voteScore: -1 },
      new: { createdAt: -1 },
      old: { createdAt: 1 },
      active: { lastCommentAt: -1, createdAt: -1 },
      controversial: { downvotes: -1 },
    };
    const sortQuery = { isPinned: -1, ...(sortMap[sort] || sortMap.top) };

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort(sortQuery)
        .skip(skip)
        .limit(limitNum)
        .populate('author', 'username avatar role'),
      Post.countDocuments(filter),
    ]);

    // Attach user's vote if authenticated
    let userVotes = {};
    if (req.user) {
      const postIds = posts.map((p) => p._id);
      const votes = await Vote.find({
        user: req.user._id,
        target: { $in: postIds },
        targetModel: 'Post',
      });
      votes.forEach((v) => {
        userVotes[v.target.toString()] = v.value;
      });
    }

    const enriched = posts.map((p) => ({
      ...p.toJSON(),
      userVote: userVotes[p._id.toString()] || 0,
    }));

    res.json({
      posts: enriched,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/forum/posts/:id
exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, isHidden: false })
      .populate('author', 'username avatar role createdAt');

    if (!post) return res.status(404).json({ error: 'Post not found' });

    let userVote = 0;
    if (req.user) {
      const vote = await Vote.findOne({ user: req.user._id, target: post._id, targetModel: 'Post' });
      userVote = vote?.value || 0;
    }

    res.json({ post: { ...post.toJSON(), userVote } });
  } catch (err) {
    next(err);
  }
};

// POST /api/forum/posts
exports.createPost = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { title, description, imageUrl, tags, ignoredSimilar } = req.body;

    const titleClean = sanitize(title);
    const descClean = sanitize(description);

    if (containsProfanity(titleClean) || containsProfanity(descClean)) {
      await logEvent({
        category: 'security',
        action: 'profanity_attempt',
        severity: 'warn',
        targetType: 'Post',
        tags: ['profanity', 'moderation'],
        ...getRequestMeta(req),
        targetSnapshot: { attemptedTitle: titleClean.slice(0, 150) },
        details: {
          contentType: 'post',
          location: 'Post',
          attemptedTitle: titleClean.slice(0, 150),
          attemptedContentPreview: descClean.slice(0, 300),
        },
      });
      return res.status(400).json({
        error: 'Your content contains language that violates the VINS Community Forum policy.',
        code: 'PROFANITY_DETECTED',
      });
    }

    // Auto-suggest tags via LLM (non-fatal — post is created even if this fails)
    let autoTags = [];
    try {
      const tagList = POST_TAGS.filter(t => t !== 'Ignored Similar Post').join(', ');
      const tagPrompt = `You are a tag classifier for a VINS internship community forum.\n\nPOST TITLE: ${titleClean}\nPOST DESCRIPTION: ${descClean.slice(0, 400)}\n\nAVAILABLE TAGS: ${tagList}\n\nPick 1-3 of the most relevant tags. Use exact tag names from the list only.\nReply in this exact JSON format: {"tags":["Tag1","Tag2"]}\nIf nothing fits, reply: {"tags":[]}`;
      const tagResponse = await openrouterRequest(
        [{ role: 'user', content: tagPrompt }],
        'anthropic/claude-3-haiku',
        { maxTokens: 100, temperature: 0.1 }
      );
      const jsonMatch = tagResponse.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.tags)) {
          autoTags = parsed.tags.filter(t => POST_TAGS.includes(t) && t !== 'Ignored Similar Post');
        }
      }
    } catch {
      // Non-fatal
    }

    // User tags take priority; auto tags fill remaining slots up to 5
    const userTagsSliced = Array.isArray(tags) ? tags.slice(0, 5) : [];
    const finalTags = [...userTagsSliced];
    for (const t of autoTags) {
      if (finalTags.length >= 5) break;
      if (!finalTags.includes(t)) finalTags.push(t);
    }
    if (ignoredSimilar === true) finalTags.push('Ignored Similar Post');

    const post = await Post.create({
      title: titleClean,
      description: descClean,
      imageUrl: imageUrl || null,
      tags: finalTags,
      author: req.user._id,
    });

    await User.findByIdAndUpdate(req.user._id, { $inc: { postCount: 1 } });

    await post.populate('author', 'username avatar role');

    await logEvent({
      category: 'post',
      action: 'post_created',
      severity: 'info',
      targetType: 'Post',
      targetId: post._id,
      targetSnapshot: { title: titleClean, tags, authorId: post.author },
      ...getRequestMeta(req),
      details: { postId: post._id, title: titleClean, tags },
    });

    res.status(201).json({ post });
    analyzeSentiment(post._id, 'Post'); // fire-and-forget
  } catch (err) {
    next(err);
  }
};

// POST /api/forum/posts/check-duplicate
exports.checkDuplicate = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.json({ duplicates: [], similarityScore: 0 });

    const recent = await Post.find({ isHidden: false })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('title description tags _id')
      .lean();

    if (recent.length === 0) return res.json({ duplicates: [], similarityScore: 0 });

    const postsText = recent
      .map((p, i) => `[${i + 1}] ID:${p._id} TITLE: ${p.title}\nDESC: ${p.description.slice(0, 200)}`)
      .join('\n\n');

    const prompt = `You are a duplicate post detector for a community forum.

NEW POST:
Title: ${title}
Description: ${description?.slice(0, 300)}

EXISTING POSTS:
${postsText}

Task: Find the top 3 most similar existing posts (if any). For each, provide:
- The post number from the list
- A similarity score from 0 to 100 (100 = identical, 0 = completely different)
- One line reason

Reply in this exact JSON format only:
{"results":[{"index":1,"score":85,"reason":"Asks the same thing about NOC deadlines"},{"index":5,"score":40,"reason":"Related topic but different question"}]}

If no similar posts (all scores < 30), reply: {"results":[]}`;

    let duplicates = [];
    let maxScore = 0;

    try {
      const llmResponse = await openrouterRequest(
        [{ role: 'user', content: prompt }],
        'anthropic/claude-3-haiku',
        { maxTokens: 300, temperature: 0.1 }
      );

      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const results = parsed.results || [];

        duplicates = results
          .filter((r) => r.score >= 40)
          .map((r) => ({
            post: recent[r.index - 1],
            score: r.score,
            reason: r.reason,
          }))
          .filter((r) => r.post);

        maxScore = duplicates.length > 0 ? Math.max(...duplicates.map((d) => d.score)) : 0;
      }
    } catch (llmErr) {
      // LLM failed — return empty, don't block the user
    }

    res.json({ duplicates, similarityScore: maxScore });
  } catch (err) {
    next(err);
  }
};

// POST /api/forum/posts/:id/vote
exports.votePost = async (req, res, next) => {
  try {
    const { value } = req.body;
    const numValue = parseInt(value);
    if (![1, -1, 0].includes(numValue)) return res.status(400).json({ error: 'Invalid vote value' });

    const post = await Post.findOne({ _id: req.params.id, isHidden: false });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const existingVote = await Vote.findOne({ user: req.user._id, target: post._id, targetModel: 'Post' });

    if (numValue === 0) {
      // Remove vote
      if (existingVote) {
        const delta = existingVote.value === 1 ? { upvotes: -1 } : { downvotes: -1 };
        await existingVote.deleteOne();
        await post.updateOne({ $inc: { ...delta, voteScore: -existingVote.value } });
      }
    } else if (existingVote) {
      if (existingVote.value === numValue) {
        return res.json({ voteScore: post.voteScore, userVote: numValue });
      }
      // Flip vote
      const upDelta = numValue === 1 ? 1 : -1;
      const downDelta = numValue === -1 ? 1 : -1;
      await Vote.findByIdAndUpdate(existingVote._id, { value: numValue });
      await post.updateOne({
        $inc: { upvotes: upDelta, downvotes: downDelta, voteScore: numValue * 2 },
      });
    } else {
      await Vote.create({ user: req.user._id, target: post._id, targetModel: 'Post', value: numValue });
      const inc = numValue === 1 ? { upvotes: 1, voteScore: 1 } : { downvotes: 1, voteScore: -1 };
      await post.updateOne({ $inc: inc });
    }

    const updated = await Post.findById(post._id).select('voteScore upvotes downvotes');

    await logEvent({
      category: 'vote',
      action: 'vote_post',
      severity: 'info',
      targetType: 'Vote',
      targetSnapshot: { target: post._id, targetModel: 'Post', value: numValue },
      ...getRequestMeta(req),
      details: { postId: post._id, value: numValue },
    });

    res.json({ voteScore: updated.voteScore, upvotes: updated.upvotes, downvotes: updated.downvotes, userVote: numValue });
  } catch (err) {
    next(err);
  }
};

// GET /api/forum/posts/:id/comments
exports.getComments = async (req, res, next) => {
  try {
    const all = await Comment.find({ post: req.params.id, isHidden: false })
      .sort({ voteScore: -1, createdAt: 1 })
      .populate('author', 'username avatar role publicId')
      .lean();

    let userVotes = {};
    if (req.user) {
      const ids = all.map((c) => c._id);
      const votes = await Vote.find({ user: req.user._id, target: { $in: ids }, targetModel: 'Comment' });
      votes.forEach((v) => { userVotes[v.target.toString()] = v.value; });
    }

    // Build N-level tree
    const map = {};
    all.forEach((c) => { map[c._id.toString()] = { ...c, userVote: userVotes[c._id.toString()] || 0, replies: [] }; });
    const roots = [];
    all.forEach((c) => {
      if (c.parent) {
        const parent = map[c.parent.toString()];
        if (parent) parent.replies.push(map[c._id.toString()]);
      } else {
        roots.push(map[c._id.toString()]);
      }
    });

    res.json({ comments: roots });
  } catch (err) {
    next(err);
  }
};

// POST /api/forum/posts/:id/comments
exports.createComment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { content, parentId } = req.body;
    const cleanContent = sanitize(content);

    if (containsProfanity(cleanContent)) {
      await logEvent({
        category: 'security',
        action: 'profanity_attempt',
        severity: 'warn',
        targetType: 'Comment',
        tags: ['profanity', 'moderation'],
        ...getRequestMeta(req),
        targetSnapshot: { attemptedContentPreview: cleanContent.slice(0, 300) },
        details: {
          contentType: parentId ? 'reply' : 'comment',
          location: `/forum/${req.params.id}`,
          postId: req.params.id,
          parentCommentId: parentId || null,
          attemptedContentPreview: cleanContent.slice(0, 300),
        },
      });
      return res.status(400).json({
        error: 'Your content contains language that violates the VINS Community Forum policy.',
        code: 'PROFANITY_DETECTED',
      });
    }

    const post = await Post.findOne({ _id: req.params.id, isHidden: false });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    let depth = 0;
    if (parentId) {
      const parent = await Comment.findById(parentId);
      if (!parent || parent.post.toString() !== req.params.id) {
        return res.status(400).json({ error: 'Invalid parent comment' });
      }
      depth = Math.min(parent.depth + 1, 5);
    }

    const mentions = await parseMentions(cleanContent);

    const comment = await Comment.create({
      post: req.params.id,
      parent: parentId || null,
      content: cleanContent,
      author: req.user._id,
      depth,
      mentions,
    });

    await Post.findByIdAndUpdate(req.params.id, { $inc: { commentCount: 1 }, $set: { lastCommentAt: new Date() } });
    await User.findByIdAndUpdate(req.user._id, { $inc: { commentCount: 1 } });

    if (parentId) {
      await Comment.findByIdAndUpdate(parentId, { $inc: { replyCount: 1 } });
    }

    await comment.populate('author', 'username avatar role publicId');

    await logEvent({
      category: 'comment',
      action: 'comment_created',
      severity: 'info',
      targetType: 'Comment',
      targetId: comment._id,
      targetSnapshot: { contentLength: cleanContent.length, post: req.params.id, depth, mentionCount: mentions.length },
      ...getRequestMeta(req),
      details: { postId: req.params.id, commentId: comment._id, parentId: parentId || null },
    });

    // Notify parent comment author (reply notification)
    if (parentId) {
      const parent = await Comment.findById(parentId).select('author').lean();
      if (parent) {
        await createNotification({
          recipient: parent.author,
          type: 'reply',
          actor: req.user._id,
          post: req.params.id,
          comment: comment._id,
        });
      }
    }

    // Notify mentioned users
    for (const mention of mentions) {
      await createNotification({
        recipient: mention.userId,
        type: 'mention',
        actor: req.user._id,
        post: req.params.id,
        comment: comment._id,
      });
    }

    const commentPayload = { ...comment.toJSON(), replies: [], userVote: 0 };
    res.status(201).json({ comment: commentPayload });
    analyzeSentiment(comment._id, 'Comment'); // fire-and-forget

    // Broadcast to everyone else viewing this post
    const io = getIo();
    if (io) io.to(`post:${req.params.id}`).emit('post:comment_new', { comment: commentPayload });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/forum/posts/:id  — owner or admin
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const isOwner = post.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    await Promise.all([
      Post.findByIdAndDelete(req.params.id),
      Comment.deleteMany({ post: req.params.id }),
      Vote.deleteMany({ target: req.params.id, targetModel: 'Post' }),
    ]);
    await User.findByIdAndUpdate(post.author, { $inc: { postCount: -1 } });

    await logEvent({
      category: 'post',
      action: isAdmin && !isOwner ? 'post_admin_deleted' : 'post_deleted',
      severity: isAdmin && !isOwner ? 'warn' : 'info',
      targetType: 'Post',
      targetId: post._id,
      targetSnapshot: { title: post.title, authorId: post.author, commentCount: post.commentCount, voteScore: post.voteScore },
      ...getRequestMeta(req),
      details: { postId: req.params.id, title: post.title },
    });

    res.json({ message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/forum/posts/:id/comments/:commentId  — owner or admin
exports.deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findOne({ _id: req.params.commentId, post: req.params.id });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const isOwner = comment.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    await Comment.findByIdAndUpdate(req.params.commentId, { isHidden: true });
    await Post.findByIdAndUpdate(req.params.id, { $inc: { commentCount: -1 } });
    await User.findByIdAndUpdate(comment.author, { $inc: { commentCount: -1 } });

    await logEvent({
      category: 'comment',
      action: isAdmin && !isOwner ? 'comment_admin_deleted' : 'comment_deleted',
      severity: isAdmin && !isOwner ? 'warn' : 'info',
      targetType: 'Comment',
      targetId: comment._id,
      targetSnapshot: { postId: req.params.id },
      ...getRequestMeta(req),
      details: { commentId: req.params.commentId, postId: req.params.id },
    });

    res.json({ message: 'Comment deleted' });

    const io = getIo();
    if (io) io.to(`post:${req.params.id}`).emit('post:comment_deleted', { commentId: req.params.commentId });
  } catch (err) {
    next(err);
  }
};

// GET /api/forum/search
exports.searchForum = async (req, res, next) => {
  try {
    const {
      q = '', from = '', tag = '', has = '',
      before = '', after = '', sort = '', page = 1, limit = 20,
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const validTag = POST_TAGS.includes(tag) ? tag : '';

    const hasAny = q.trim() || from.trim() || validTag || has || before || after;
    if (!hasAny) {
      return res.json({ posts: [], total: 0, page: pageNum, totalPages: 0 });
    }

    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Resolve `from` username → author ObjectId
    let authorId = null;
    if (from.trim()) {
      const esc = escape(from.trim().slice(0, 30));
      const found = await User.findOne({ username: { $regex: `^${esc}$`, $options: 'i' } }).select('_id').lean();
      if (!found) return res.json({ posts: [], total: 0, page: pageNum, totalPages: 0 });
      authorId = found._id;
    }

    // Build filter
    const filter = { isHidden: false };
    if (q.trim()) {
      const esc = escape(q.trim().slice(0, 100));
      filter.$or = [
        { title:       { $regex: esc, $options: 'i' } },
        { description: { $regex: esc, $options: 'i' } },
      ];
    }
    if (authorId)  filter.author = authorId;
    if (validTag)  filter.tags   = validTag;
    if (has === 'image')    filter.imageUrl     = { $ne: null, $exists: true };
    if (has === 'comments') filter.commentCount = { $gt: 0 };
    if (has === 'votes')    filter.voteScore    = { $gt: 0 };

    const dateFilter = {};
    if (before) { const d = new Date(before); if (!isNaN(d)) dateFilter.$lt = d; }
    if (after)  { const d = new Date(after);  if (!isNaN(d)) dateFilter.$gt = d; }
    if (Object.keys(dateFilter).length) filter.createdAt = dateFilter;

    const sortQuery = sort === 'top' ? { voteScore: -1, createdAt: -1 } : { createdAt: -1 };
    const skip = (pageNum - 1) * limitNum;

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort(sortQuery)
        .skip(skip)
        .limit(limitNum)
        .populate('author', 'publicId username avatar role')
        .lean(),
      Post.countDocuments(filter),
    ]);

    let userVotes = {};
    if (req.user) {
      const ids = posts.map((p) => p._id);
      const votes = await Vote.find({ user: req.user._id, target: { $in: ids }, targetModel: 'Post' });
      votes.forEach((v) => { userVotes[v.target.toString()] = v.value; });
    }
    const enriched = posts.map((p) => ({ ...p, userVote: userVotes[p._id.toString()] || 0 }));

    const filterCount = [from.trim(), validTag, has, before, after].filter(Boolean).length;

    await logEvent({
      category: 'post',
      action: 'post_search',
      severity: 'info',
      targetType: null,
      targetSnapshot: { q: q.trim(), filterCount, resultCount: enriched.length },
      ...getRequestMeta(req),
      details: { q: q.trim(), filterCount, resultCount: enriched.length },
    });

    res.json({ posts: enriched, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    next(err);
  }
};

// POST /api/forum/posts/:id/comments/:commentId/vote
exports.voteComment = async (req, res, next) => {
  try {
    const { value } = req.body;
    const numValue = parseInt(value);
    if (![1, -1, 0].includes(numValue)) return res.status(400).json({ error: 'Invalid vote value' });

    const comment = await Comment.findOne({ _id: req.params.commentId, post: req.params.id, isHidden: false });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const existingVote = await Vote.findOne({ user: req.user._id, target: comment._id, targetModel: 'Comment' });

    if (numValue === 0) {
      if (existingVote) {
        await existingVote.deleteOne();
        const delta = existingVote.value === 1 ? { upvotes: -1 } : { downvotes: -1 };
        await comment.updateOne({ $inc: { ...delta, voteScore: -existingVote.value } });
      }
    } else if (existingVote) {
      if (existingVote.value !== numValue) {
        await Vote.findByIdAndUpdate(existingVote._id, { value: numValue });
        const upDelta = numValue === 1 ? 1 : -1;
        const downDelta = numValue === -1 ? 1 : -1;
        await comment.updateOne({ $inc: { upvotes: upDelta, downvotes: downDelta, voteScore: numValue * 2 } });
      }
    } else {
      await Vote.create({ user: req.user._id, target: comment._id, targetModel: 'Comment', value: numValue });
      const inc = numValue === 1 ? { upvotes: 1, voteScore: 1 } : { downvotes: 1, voteScore: -1 };
      await comment.updateOne({ $inc: inc });
    }

    const updated = await Comment.findById(comment._id).select('voteScore upvotes downvotes');
    res.json({ voteScore: updated.voteScore, upvotes: updated.upvotes, downvotes: updated.downvotes, userVote: numValue });
  } catch (err) {
    next(err);
  }
};
