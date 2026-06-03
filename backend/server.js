require('dotenv').config();
const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const path = require('path');
const { connectDB } = require('./src/config/db');
const { configureSecurityMiddleware } = require('./src/middleware/security');
const { requestLogger } = require('./src/middleware/logger');
const { errorHandler } = require('./src/middleware/errorHandler');
const { Server } = require('socket.io');
const { setIo, onlineUsers } = require('./src/utils/socketServer');
const User = require('./src/models/User');
const { runClusteringJob } = require('./src/utils/clusteringJob');
const { runAlertEvaluator } = require('./src/utils/alertEvaluator');

const authRoutes = require('./src/routes/auth');
const faqRoutes = require('./src/routes/faq');
const forumRoutes = require('./src/routes/forum');
const adminRoutes = require('./src/routes/admin');
const chatbotRoutes = require('./src/routes/chatbot');
const notificationRoutes = require('./src/routes/notifications');
const userRoutes = require('./src/routes/users');
const uploadRoutes = require('./src/routes/upload');
const deadEndRoutes = require('./src/routes/deadEnd');

const app = express();
const httpServer = http.createServer(app);

connectDB();

// ── Background jobs ────────────────────────────────────────────────────────
// Delay startup to ensure DB is connected before first run
setTimeout(() => {
  runClusteringJob();
  setInterval(runClusteringJob, 6 * 60 * 60 * 1000);
}, 8000);

setTimeout(() => {
  runAlertEvaluator();
  setInterval(runAlertEvaluator, 60 * 60 * 1000);
}, 12000);

app.set('trust proxy', 1);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(compression());

configureSecurityMiddleware(app);
app.use(requestLogger);

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/faq', faqRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/forum/dead-end', deadEndRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

// ── Socket.io ──────────────────────────────────────────────────────────────
const CLIENT_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setIo(io);

io.use(async (socket, next) => {
  try {
    // Try cookie first, then auth header
    const cookieHeader = socket.handshake.headers.cookie || '';
    const cookieMatch = cookieHeader.match(/access_token=([^;]+)/);
    const token = cookieMatch?.[1] || socket.handshake.auth?.token;

    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('_id username role isBanned timeoutUntil');
    if (!user || user.isBanned) return next(new Error('Unauthorized'));

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  onlineUsers.set(socket.userId, socket.id);
  socket.join(`user:${socket.userId}`);

  // Post-room subscriptions for real-time comments
  socket.on('join:post', (postId) => {
    if (postId && typeof postId === 'string' && /^[a-f\d]{24}$/i.test(postId)) {
      socket.join(`post:${postId}`);
    }
  });

  socket.on('leave:post', (postId) => {
    if (postId && typeof postId === 'string') {
      socket.leave(`post:${postId}`);
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.userId);
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});
