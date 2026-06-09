const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const FileType = require('file-type');
const { verifyToken } = require('../middleware/auth');
const checkTimeout = require('../middleware/timeout');
const rateLimit = require('express-rate-limit');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    // Pre-check MIME from Content-Type header; real check is done after buffer
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many uploads, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const EXT_MAP = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

// POST /api/upload/image
router.post('/image', verifyToken, checkTimeout, uploadLimiter, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    // Validate MIME from actual bytes, not Content-Type header
    const detected = await FileType.fromBuffer(req.file.buffer);
    if (!detected || !ALLOWED_MIME.has(detected.mime)) {
      return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' });
    }

    const ext = EXT_MAP[detected.mime];
    const filename = `${uuidv4()}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    fs.writeFileSync(filepath, req.file.buffer);

    const url = `/uploads/${filename}`;
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
