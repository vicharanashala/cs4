const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');
const { chatbotLimiter } = require('../middleware/rateLimiter');

router.post('/chat', chatbotLimiter, chatbotController.chat);

module.exports = router;
