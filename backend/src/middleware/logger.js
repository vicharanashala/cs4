const winston = require('winston');
const Log = require('../models/Log');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp }) => `${timestamp} [${level}]: ${message}`)
      ),
    }),
  ],
});

const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const msg = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - ${req.ip}`;
    if (res.statusCode >= 500) logger.error(msg);
    else if (res.statusCode >= 400) logger.warn(msg);
    else logger.info(msg);
  });
  next();
};

const SENSITIVE_KEYS = new Set([
  'password', 'confirmPassword', 'token', 'refreshToken', 'accessToken',
  'newPassword', 'oldPassword', 'currentPassword',
]);

const sanitizeBody = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const clone = { ...obj };
  SENSITIVE_KEYS.forEach((k) => delete clone[k]);
  return clone;
};

const logEvent = async ({
  level = 'info',
  category,
  action,
  userId = null,
  userEmail = null,
  username = null,
  ip = null,
  userAgent = null,
  details = {},
  targetType = null,
  targetId = null,
  targetSnapshot = {},
  method = null,
  path = null,
  statusCode = null,
  durationMs = null,
  startTime = null,
  query = {},
  body = {},
  referer = null,
  origin = null,
  userRole = null,
  userPublicId = null,
  tags = [],
  severity = 'info',
  sessionHint = null,
  deviceFingerprint = null,
  deviceBrand = null,
  deviceModel = null,
  deviceOs = null,
}) => {
  const computedDuration = startTime != null ? Date.now() - startTime : durationMs;

  try {
    await Log.create({
      level,
      category,
      action,
      userId,
      userEmail,
      username,
      ip,
      userAgent,
      details,
      targetType,
      targetId,
      targetSnapshot,
      method,
      path,
      statusCode,
      durationMs: computedDuration,
      query: sanitizeBody(query),
      body: sanitizeBody(body),
      referer,
      origin,
      userRole,
      userPublicId,
      tags,
      severity,
      sessionHint,
      deviceFingerprint,
      deviceBrand,
      deviceModel,
      deviceOs,
    });
  } catch (err) {
    logger.error(`[logEvent] Failed to write log: ${err.message}`);
  }

  logger.log(level, `[${category}] ${action}`, { userId, userEmail, ip, deviceBrand, deviceModel, ...details });
};

const getRequestMeta = (req) => ({
  ip:                req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown',
  userAgent:         req.headers['user-agent'] || 'unknown',
  userId:            req.user?._id || null,
  userEmail:         req.user?.email || null,
  username:          req.user?.username || null,
  method:            req.method || null,
  path:              req.path || null,
  origin:            req.headers.origin || null,
  referer:           req.headers.referer || null,
  userRole:          req.user?.role || null,
  userPublicId:      req.user?.publicId || null,
  sessionHint:       req.headers['x-session-id'] || null,
  deviceFingerprint: req.headers['x-device-fingerprint'] || null,
  deviceBrand:       req.headers['x-device-brand'] || null,
  deviceModel:       req.headers['x-device-model'] || null,
  deviceOs:          req.headers['x-device-os'] || null,
});

module.exports = { logger, requestLogger, logEvent, getRequestMeta, sanitizeBody };
