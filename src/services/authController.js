const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { logEvent, getRequestMeta } = require('../middleware/logger');
const { AppError } = require('../middleware/errorHandler');
const { emitToUser } = require('../lib/socketServer');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  path: '/',
};

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });
  const refreshToken = jwt.sign({ id: userId, jti: uuidv4() }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  });
  return { accessToken, refreshToken };
};

const generateCsrfToken = () => crypto.randomBytes(32).toString('hex');

const setAuthCookies = (res, accessToken, refreshToken, csrfToken) => {
  res.cookie('access_token', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/api/auth/refresh' });
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

// Extract device info from request headers
const getDeviceFromReq = (req) => ({
  fingerprint: req.headers['x-device-fingerprint'] || null,
  deviceBrand: req.headers['x-device-brand'] || null,
  deviceModel: req.headers['x-device-model'] || null,
  deviceOs:    req.headers['x-device-os']    || null,
  userAgent:   req.headers['user-agent']     || null,
  ip:          req.ip || req.headers['x-forwarded-for'] || 'unknown',
});

// ── register ─────────────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { username, email, password } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(409).json({
        error: existing.email === email ? 'Email already registered' : 'Username already taken',
      });
    }

    const device = getDeviceFromReq(req);
    const user = await User.create({ username, email, password });

    const { accessToken, refreshToken } = generateTokens(user._id);
    const csrfToken = generateCsrfToken();

    user.refreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    user.lastLogin = new Date();
    user.lastLoginIP = device.ip;
    user.activeSession = {
      fingerprint: device.fingerprint,
      deviceBrand: device.deviceBrand,
      deviceModel: device.deviceModel,
      deviceOs:    device.deviceOs,
      userAgent:   device.userAgent,
      ip:          device.ip,
      lastSeen:    new Date(),
    };
    await user.save({ validateBeforeSave: false });

    setAuthCookies(res, accessToken, refreshToken, csrfToken);

    await logEvent({
      category: 'auth', action: 'register', severity: 'info',
      targetType: 'User', targetId: user._id,
      targetSnapshot: { role: user.role, publicId: user.publicId },
      ...getRequestMeta(req),
      userId: user._id, userEmail: user.email, username: user.username,
      userRole: user.role, userPublicId: user.publicId,
      details: { userId: user._id, deviceBrand: device.deviceBrand, deviceModel: device.deviceModel },
    });

    res.status(201).json({
      user: { _id: user._id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
};

// ── shared login core (used by login + forceLogin) ────────────────────────────
async function performLogin(req, res, next, { forceOverride = false } = {}) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { email, password } = req.body;
    const device = getDeviceFromReq(req);

    const user = await User.findOne({ email }).select('+password +refreshToken +loginAttempts +lockUntil');
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    if (user.isBanned) return res.status(403).json({ error: 'Account suspended' });

    if (user.isLocked()) {
      await logEvent({
        level: 'warn', category: 'security', action: 'login_locked', severity: 'warn',
        tags: ['rate_limited'], ...getRequestMeta(req), userEmail: email,
        details: { lockUntil: user.lockUntil },
      });
      return res.status(429).json({ error: 'Account temporarily locked. Try again in 15 minutes.' });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      await user.incrementLoginAttempts();
      await logEvent({
        level: 'warn', category: 'security', action: 'login_failed', severity: 'warn',
        tags: ['security'], ...getRequestMeta(req), userEmail: email,
        details: { attempts: user.loginAttempts + 1 },
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // ── Device conflict check ─────────────────────────────────────────────────
    const session = user.activeSession;
    const hasDifferentDevice = session?.fingerprint &&
      device.fingerprint &&
      session.fingerprint !== device.fingerprint;

    if (hasDifferentDevice && !forceOverride) {
      await logEvent({
        level: 'warn', category: 'security', action: 'login_device_conflict', severity: 'warn',
        tags: ['security', 'device'],
        ...getRequestMeta(req),
        userId: user._id, userEmail: user.email, username: user.username,
        details: {
          existingDevice: { brand: session.deviceBrand, model: session.deviceModel, os: session.deviceOs, ip: session.ip, lastSeen: session.lastSeen },
          newDevice: { brand: device.deviceBrand, model: device.deviceModel, os: device.deviceOs, ip: device.ip },
        },
      });

      return res.status(409).json({
        error: 'device_conflict',
        conflict: {
          deviceBrand: session.deviceBrand,
          deviceModel: session.deviceModel,
          deviceOs:    session.deviceOs,
          ip:          session.ip,
          lastSeen:    session.lastSeen,
        },
      });
    }

    // ── Issue tokens ──────────────────────────────────────────────────────────
    const { accessToken, refreshToken } = generateTokens(user._id);
    const csrfToken = generateCsrfToken();

    const oldDevice = forceOverride && hasDifferentDevice ? { ...session } : null;

    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.refreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    user.lastLogin = new Date();
    user.lastLoginIP = device.ip;
    user.activeSession = {
      fingerprint: device.fingerprint,
      deviceBrand: device.deviceBrand,
      deviceModel: device.deviceModel,
      deviceOs:    device.deviceOs,
      userAgent:   device.userAgent,
      ip:          device.ip,
      lastSeen:    new Date(),
    };
    await user.save({ validateBeforeSave: false });

    setAuthCookies(res, accessToken, refreshToken, csrfToken);

    const action = forceOverride && hasDifferentDevice ? 'login_force' : 'login';
    await logEvent({
      category: 'auth', action, severity: forceOverride && hasDifferentDevice ? 'warn' : 'info',
      tags: forceOverride && hasDifferentDevice ? ['security', 'device', 'forced'] : [],
      targetType: 'User', targetId: user._id,
      targetSnapshot: { role: user.role, publicId: user.publicId, lastLogin: user.lastLogin },
      ...getRequestMeta(req),
      userId: user._id, userEmail: user.email, username: user.username,
      userRole: user.role, userPublicId: user.publicId,
      details: {
        deviceBrand: device.deviceBrand, deviceModel: device.deviceModel,
        deviceOs: device.deviceOs, ip: device.ip,
        ...(oldDevice ? { displacedDevice: { brand: oldDevice.deviceBrand, model: oldDevice.deviceModel, os: oldDevice.deviceOs, ip: oldDevice.ip, lastSeen: oldDevice.lastSeen } } : {}),
      },
    });

    // Push real-time logout to the displaced device before sending response to new device
    if (forceOverride && hasDifferentDevice) {
      emitToUser(user._id, 'force_logout', {
        newDevice: { brand: device.deviceBrand, model: device.deviceModel, os: device.deviceOs },
      });
    }

    res.json({
      user: { _id: user._id, username: user.username, email: user.email, role: user.role, avatar: user.avatar },
    });
  } catch (err) {
    next(err);
  }
}

exports.login      = (req, res, next) => performLogin(req, res, next, { forceOverride: false });
exports.forceLogin = (req, res, next) => performLogin(req, res, next, { forceOverride: true  });

// ── logout ────────────────────────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        $unset: { refreshToken: 1 },
        $set:   { activeSession: { fingerprint: null, deviceBrand: null, deviceModel: null, deviceOs: null, userAgent: null, ip: null, lastSeen: null } },
      });
      await logEvent({
        category: 'auth', action: 'logout_manual', severity: 'info',
        ...getRequestMeta(req),
        userId: req.user._id, userEmail: req.user.email, username: req.user.username,
        userRole: req.user.role, userPublicId: req.user.publicId,
        details: {
          deviceBrand: req.headers['x-device-brand'] || null,
          deviceModel: req.headers['x-device-model'] || null,
          deviceOs:    req.headers['x-device-os']    || null,
          ip: req.ip,
        },
      });
    }

    const clearOpts = { ...COOKIE_OPTIONS, maxAge: 0 };
    res.cookie('access_token',  '', clearOpts);
    res.cookie('refresh_token', '', { ...clearOpts, path: '/api/auth/refresh' });
    res.cookie('csrf_token',    '', { httpOnly: false, maxAge: 0 });

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// ── refresh ───────────────────────────────────────────────────────────────────
exports.refresh = async (req, res, next) => {
  try {
    const token = req.cookies.refresh_token;
    if (!token) return res.status(401).json({ error: 'No refresh token' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (jwtErr) {
      // Token expired or invalid — attempt to log session expiry
      try {
        const unverified = jwt.decode(token);
        if (unverified?.id) {
          await User.findByIdAndUpdate(unverified.id, {
            $set: { activeSession: { fingerprint: null, deviceBrand: null, deviceModel: null, deviceOs: null, userAgent: null, ip: null, lastSeen: null } },
          });
          await logEvent({
            category: 'auth', action: 'logout_session_expired', severity: 'info',
            ...getRequestMeta(req),
            userId: unverified.id,
            details: { reason: jwtErr.name },
          });
        }
      } catch { /* non-fatal */ }
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ _id: decoded.id, refreshToken: hashedToken });

    if (!user) return res.status(401).json({ error: 'Invalid or expired refresh token' });
    if (user.isBanned) return res.status(403).json({ error: 'Account suspended' });

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    const csrfToken = generateCsrfToken();

    user.refreshToken = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    // Update lastSeen on the active session so conflict panel shows accurate time
    if (user.activeSession?.fingerprint) {
      user.activeSession.lastSeen = new Date();
      user.activeSession.ip = req.ip || user.activeSession.ip;
    }
    await user.save({ validateBeforeSave: false });

    setAuthCookies(res, accessToken, newRefreshToken, csrfToken);

    res.json({
      user: { _id: user._id, username: user.username, email: user.email, role: user.role, avatar: user.avatar },
    });
  } catch (err) {
    next(err);
  }
};

// ── getMe ─────────────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  res.json({
    user: { _id: req.user._id, username: req.user.username, email: req.user.email, role: req.user.role, avatar: req.user.avatar },
  });
};
