const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const adminController = require('../services/adminController');
const faqController   = require('../services/faqController');
const memberController = require('../services/memberController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.use(verifyToken, requireAdmin);

router.get('/stats', adminController.getStats);

router.get('/users', adminController.getUsers);
router.post('/users', [
  body('username').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('role').optional().isIn(['user', 'admin']),
], adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.post('/users/:id/timeout', adminController.timeoutUser);
router.delete('/users/:id/timeout', adminController.removeTimeout);

router.get('/posts', adminController.getPosts);
router.put('/posts/:id/pin', adminController.pinPost);
router.put('/posts/:id/hide', adminController.toggleHidePost);
router.put('/posts/:id/archive', adminController.archivePost);
router.delete('/posts/:id/hard', adminController.hardDeletePost);

router.post('/undo', adminController.executeUndo);

router.get('/logs', adminController.getLogs);

router.get('/faq', faqController.adminGetAll);
router.post('/faq', faqController.createCategory);
router.delete('/faq/:categoryId', faqController.deleteCategory);
router.post('/faq/:categoryId/questions', faqController.addQuestion);
router.put('/faq/:categoryId/questions/:questionId', faqController.updateQuestion);
router.delete('/faq/:categoryId/questions/:questionId', faqController.deleteQuestion);

router.get('/members', memberController.getMembers);
router.get('/members/online', memberController.getOnlineMembers);

// Search Gap Tracker
router.get('/search-gaps', adminController.getSearchGaps);
router.patch('/search-gaps/:clusterId/status', adminController.updateClusterStatus);
router.post('/search-gaps/trigger-clustering', adminController.triggerClustering);

// Sentiment Pulse
router.get('/sentiment', adminController.getSentiment);
router.post('/sentiment/run-analysis', adminController.runSentimentAnalysis);
router.get('/sentiment/alerts', adminController.getSentimentAlerts);
router.patch('/sentiment/alerts/:alertId/acknowledge', adminController.acknowledgeSentimentAlert);

module.exports = router;
