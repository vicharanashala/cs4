const rateLimit = require('express-rate-limit');

const createLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
  });

// General API: 200 requests per 15 minutes
const globalLimiter = createLimiter(
  15 * 60 * 1000,
  200,
  'Too many requests, please try again later'
);

// Auth endpoints: 10 attempts per 15 minutes
const authLimiter = createLimiter(
  15 * 60 * 1000,
  10,
  'Too many authentication attempts, please try again in 15 minutes'
);

// Forum post creation: 15 posts per hour
const postCreationLimiter = createLimiter(
  60 * 60 * 1000,
  15,
  'Post limit reached, please wait before posting again'
);

// Comment creation: 30 per 10 minutes
const commentLimiter = createLimiter(
  10 * 60 * 1000,
  30,
  'Too many comments, please slow down'
);

// Chatbot: 20 requests per 10 minutes
const chatbotLimiter = createLimiter(
  10 * 60 * 1000,
  20,
  'Chatbot rate limit reached, please wait a moment'
);

// Duplicate check: 10 per minute
const duplicateCheckLimiter = createLimiter(
  60 * 1000,
  10,
  'Too many duplicate checks'
);

// Forum search: 60 per minute
const searchLimiter = createLimiter(
  60 * 1000,
  60,
  'Too many search requests, please slow down'
);

// Dead-end search logging: 30 per 10 minutes
const deadEndLimiter = createLimiter(
  10 * 60 * 1000,
  30,
  'Too many dead-end log requests'
);

module.exports = {
  globalLimiter,
  authLimiter,
  postCreationLimiter,
  commentLimiter,
  chatbotLimiter,
  duplicateCheckLimiter,
  searchLimiter,
  deadEndLimiter,
};
