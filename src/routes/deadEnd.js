const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { deadEndLimiter } = require('../middleware/rateLimiter');
const deadEndController = require('../services/deadEndController');

router.post('/', optionalAuth, deadEndLimiter, deadEndController.logDeadEnd);

module.exports = router;
