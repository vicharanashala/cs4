const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const registerValidation = [
  body('username').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username: 3-30 chars, letters/numbers/underscores only'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be at least 8 chars with uppercase, lowercase, and number'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

router.post('/register',    authLimiter, registerValidation, authController.register);
router.post('/login',       authLimiter, loginValidation,    authController.login);
router.post('/force-login', authLimiter, loginValidation,    authController.forceLogin);
router.post('/logout',      optionalAuth,                    authController.logout);
router.post('/refresh',                                      authController.refresh);
router.get('/me',           verifyToken,                     authController.getMe);

module.exports = router;
