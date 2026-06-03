const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const forumController = require('../controllers/forumController');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { postCreationLimiter, commentLimiter, duplicateCheckLimiter, searchLimiter } = require('../middleware/rateLimiter');
const checkTimeout = require('../middleware/timeout');
const { POST_TAGS } = require('../models/Post');

const postValidation = [
  body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be 5-200 characters'),
  body('description').trim().isLength({ min: 10, max: 5000 }).withMessage('Description must be 10-5000 characters'),
  body('tags').optional().isArray({ max: 5 }).withMessage('Maximum 5 tags'),
  body('imageUrl').optional({ nullable: true, checkFalsy: true }).isURL().withMessage('Invalid image URL'),
  body('ignoredSimilar').optional().isBoolean(),
];

const commentValidation = [
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Comment must be 1-2000 characters'),
];

router.get('/search', verifyToken, searchLimiter, forumController.searchForum);
router.get('/posts', verifyToken, forumController.getPosts);
router.get('/posts/:id', verifyToken, forumController.getPost);
router.post('/posts', verifyToken, checkTimeout, postCreationLimiter, postValidation, forumController.createPost);
router.post('/posts/check-duplicate', verifyToken, duplicateCheckLimiter, forumController.checkDuplicate);
router.delete('/posts/:id', verifyToken, forumController.deletePost);
router.post('/posts/:id/vote', verifyToken, checkTimeout, forumController.votePost);
router.get('/posts/:id/comments', verifyToken, forumController.getComments);
router.post('/posts/:id/comments', verifyToken, checkTimeout, commentLimiter, commentValidation, forumController.createComment);
router.delete('/posts/:id/comments/:commentId', verifyToken, forumController.deleteComment);
router.post('/posts/:id/comments/:commentId/vote', verifyToken, checkTimeout, forumController.voteComment);
router.get('/tags', verifyToken, (req, res) => res.json({ tags: POST_TAGS }));

module.exports = router;
