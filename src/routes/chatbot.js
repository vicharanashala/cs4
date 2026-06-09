const express = require('express');
const router = express.Router();
const chatbotController = require('../services/chatbotController');
const { chatbotLimiter } = require('../middleware/rateLimiter');

router.post('/chat', chatbotLimiter, chatbotController.chat);

module.exports = router;
