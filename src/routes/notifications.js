const express = require('express');
const router = express.Router();
const notificationController = require('../services/notificationController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/', notificationController.getNotifications);
router.put('/read-all', notificationController.markAllRead);
router.put('/:id/read', notificationController.markOneRead);

module.exports = router;
