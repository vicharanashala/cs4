const checkTimeout = (req, res, next) => {
  if (!req.user) return next();
  if (req.user.timeoutUntil && req.user.timeoutUntil > new Date()) {
    const remainingSeconds = Math.ceil((new Date(req.user.timeoutUntil) - Date.now()) / 1000);
    return res.status(403).json({
      error: 'You are currently in timeout and cannot perform this action',
      code: 'TIMEOUT_ACTIVE',
      timeoutUntil: req.user.timeoutUntil,
      remainingSeconds,
    });
  }
  next();
};

module.exports = checkTimeout;
