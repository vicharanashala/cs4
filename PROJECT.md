# PROJECT.md — VINS Community Platform

> Complete project reference. Every detail, every file, every decision.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Repository Layout](#3-repository-layout)
4. [Environment Variables](#4-environment-variables)
5. [NPM Scripts](#5-npm-scripts)
6. [Dependencies](#6-dependencies)
7. [Database Models](#7-database-models)
8. [API Routes](#8-api-routes)
9. [Rate Limits](#9-rate-limits)
10. [Authentication & Security](#10-authentication--security)
11. [Frontend Architecture](#11-frontend-architecture)
12. [Feature Breakdown](#12-feature-breakdown)
13. [Real-time System (Socket.io)](#13-real-time-system-socketio)
14. [Background Jobs](#14-background-jobs)
15. [AI Integrations](#15-ai-integrations)
16. [Admin Panel](#16-admin-panel)
17. [Component Tree](#17-component-tree)
18. [Architectural Decisions](#18-architectural-decisions)
19. [Known Issues & Limitations](#19-known-issues--limitations)
20. [Maintenance Rules](#20-maintenance-rules)

---

## 1. Project Overview

- **Name**: VINS Community Platform
- **Purpose**: Community hub for interns in the Vicharanashala Internship (VINS) programme at IIT Ropar
- **Three core pillars**:
  - FAQ knowledge base — searchable, category-filtered, AI-chatbot-assisted
  - Community forum — threaded discussion with voting, @mentions, image uploads
  - Admin panel — moderation, analytics, sentiment tracking, audit logs
- **Architecture**: Full-stack MERN (MongoDB + Express + React + Node.js)
- **Ports**: Backend on `5000`, Frontend (Vite dev) on `5173`
- **Git branch**: `main`
- **Git user**: `KireinaR`
- **Last significant commits**: "Update readme", "updated folder structure", "final", "Initial commit"

---

## 2. Tech Stack

- **Runtime**: Node.js
- **Backend framework**: Express.js 4.18
- **Frontend framework**: React 18 + Vite 5
- **Styling**: Tailwind CSS 3.4 + PostCSS + custom CSS properties (light/dark)
- **Database**: MongoDB Atlas via Mongoose 8
- **Real-time**: Socket.io 4.8 (JWT-authenticated, httpOnly cookie transport)
- **AI / LLM**: OpenRouter API → Claude 3 Haiku (chatbot, duplicate detection, sentiment analysis, search clustering)
- **Authentication**: JWT in httpOnly cookies + CSRF double-submit pattern
- **Build tool**: Vite 5 (proxies `/api` and `/uploads` to Express in dev)
- **Package manager**: npm (single root `package.json`, monorepo-style)
- **Fonts**: Space Grotesk (headings), Montserrat (body) — loaded via Google Fonts

---

## 3. Repository Layout

```
cs4/
├── .env                          ← All environment variables (never committed)
├── .gitignore
├── package.json                  ← Root manifest; scripts, all deps (frontend + backend)
├── vite.config.js                ← Vite; proxies /api → :5000, /uploads → :5000
├── tailwind.config.js            ← Tailwind config (content paths, theme extensions)
├── postcss.config.js             ← PostCSS (tailwindcss, autoprefixer)
├── index.html                    ← HTML shell; Google Fonts preload links
├── README.md                     ← Project overview for external readers
├── CONTEXT.md                    ← Living context file; updated by team on changes
├── faq.json                      ← Seed data: FAQ categories + Q&A pairs
├── users.txt                     ← Demo/test user data
│
├── Memory/                       ← Claude Code memory files
│   ├── MEMORY.md
│   ├── project_vins_platform.md
│   ├── security_mandates.md
│   ├── theming_rules.md
│   ├── coding_patterns.md
│   └── project_samagama_faq.md
│
├── uploads/                      ← Uploaded images served at /uploads/<uuid>.<ext>
│
└── src/
    ├── server.js                 ← Express app entry + Socket.io boot
    ├── main.jsx                  ← React root; wraps app in ThemeProvider, AuthProvider, SocketProvider
    ├── App.jsx                   ← React Router; routes: /, /forum, /forum/:postId, /admin
    ├── styles.css                ← CSS custom properties (light/dark tokens) + global component classes
    │
    ├── lib/
    │   ├── db.js                 ← connectDB() — mongoose.connect with event logging
    │   ├── api.js                ← Axios instance; injects X-CSRF-Token, auto-refresh on 401
    │   ├── socketServer.js       ← Socket.io singleton; setIo, getIo, onlineUsers Map, emitToUser
    │   ├── openrouter.js         ← OpenRouter fetch wrapper for Claude 3 Haiku calls
    │   ├── parseMentions.js      ← @mention regex parser + case-insensitive DB user lookup
    │   ├── profanity.js          ← bad-words library wrapper; returns boolean + cleaned text
    │   └── deviceFingerprint.js  ← Device brand/model/OS detection + session fingerprint generation
    │
    ├── middleware/
    │   ├── auth.js               ← verifyToken, requireAdmin, optionalAuth, JWT extraction from cookie
    │   ├── security.js           ← helmet, CORS (FRONTEND_URL whitelist), mongo-sanitize, HPP, CSRF check
    │   ├── logger.js             ← Winston logger + logEvent() — creates Log documents in MongoDB
    │   ├── errorHandler.js       ← Global error handler + AppError class (message, statusCode, code)
    │   ├── rateLimiter.js        ← express-rate-limit configs; one export per endpoint category
    │   └── timeout.js            ← checkTimeout middleware — reads user.timeoutUntil, returns 403 TIMEOUT_ACTIVE
    │
    ├── models/
    │   ├── User.js
    │   ├── Post.js
    │   ├── Comment.js
    │   ├── Vote.js
    │   ├── Notification.js
    │   ├── FAQ.js
    │   ├── Log.js
    │   ├── UndoToken.js
    │   ├── SearchCluster.js
    │   ├── DeadEndSearch.js
    │   ├── SentimentAlert.js
    │   └── SentimentAlertRule.js
    │
    ├── routes/
    │   ├── auth.js
    │   ├── forum.js
    │   ├── faq.js
    │   ├── admin.js
    │   ├── chatbot.js
    │   ├── notifications.js
    │   ├── users.js
    │   ├── upload.js
    │   └── deadEnd.js
    │
    ├── services/
    │   ├── authController.js
    │   ├── forumController.js
    │   ├── faqController.js
    │   ├── adminController.js
    │   ├── chatbotController.js
    │   ├── notificationController.js
    │   ├── memberController.js
    │   └── deadEndController.js
    │
    ├── algorithms/
    │   ├── clusteringJob.js      ← Runs every 6 hours; clusters DeadEndSearch via Claude
    │   ├── sentimentJob.js       ← On-demand; analyzes Post/Comment sentiment via Claude
    │   └── alertEvaluator.js     ← Runs hourly; evaluates SentimentAlertRules, fires alerts
    │
    ├── components/
    │   ├── Navbar/
    │   │   ├── Navbar.jsx
    │   │   └── NotificationBell.jsx
    │   ├── FAQ/
    │   │   ├── FAQPage.jsx
    │   │   ├── FAQItem.jsx
    │   │   ├── Chatbot.jsx
    │   │   └── TagFilter.jsx
    │   ├── Forum/
    │   │   ├── ForumPage.jsx
    │   │   ├── PostCard.jsx
    │   │   ├── PostDetail.jsx
    │   │   ├── CommentThread.jsx
    │   │   ├── CreatePost.jsx
    │   │   ├── SearchModal.jsx
    │   │   ├── MemberPanel.jsx
    │   │   └── LoginModal.jsx
    │   ├── Admin/
    │   │   ├── AdminPage.jsx
    │   │   ├── Statistics.jsx
    │   │   ├── UserManagement.jsx
    │   │   ├── PostModeration.jsx
    │   │   ├── FAQManagement.jsx
    │   │   ├── LogViewer.jsx
    │   │   ├── SearchGapTracker.jsx
    │   │   └── SentimentPulse.jsx
    │   ├── Footer/
    │   │   ├── Footer.jsx
    │   │   └── PolicyModal.jsx
    │   └── Auth/
    │       └── LoginModal.jsx
    │
    ├── context/
    │   ├── AuthContext.jsx       ← user, loading, login, register, logout, refreshAuth, isAdmin
    │   ├── ThemeContext.jsx       ← theme, toggleTheme, isDark; persists in localStorage, toggles .dark on <html>
    │   └── SocketContext.jsx     ← Socket lifecycle; handles force_logout event
    │
    └── seed.js                   ← Seeds admin + intern users; populates FAQ from faq.json
```

---

## 4. Environment Variables

```
NODE_ENV=development
PORT=5000

# MongoDB
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>

# JWT
JWT_SECRET=<long random string>
JWT_REFRESH_SECRET=<different long random string>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# CSRF
CSRF_SECRET=<random string>

# AI
OPENROUTER_API_KEY=sk-or-v1-...

# Frontend origin (for CORS + cookie SameSite)
FRONTEND_URL=http://localhost:5173
```

---

## 5. NPM Scripts

- `npm run dev` — Concurrently starts backend (nodemon, port 5000) AND frontend (Vite, port 5173)
- `npm run dev:server` — Backend only via nodemon
- `npm run dev:client` — Frontend only via Vite
- `npm run build` — Vite production build (outputs to `dist/`)
- `npm run preview` — Serve the Vite production build locally
- `npm run seed` — Run `src/seed.js` — populates MongoDB with admin user + FAQ data from `faq.json`
- `npm run start` — Production: `node src/server.js`

---

## 6. Dependencies

### Backend (Node.js / Express)

- `express` 4.18.2 — Web framework
- `mongoose` 8.0.3 — MongoDB ODM
- `jsonwebtoken` 9.0.2 — JWT creation and verification
- `bcryptjs` 2.4.3 — Password hashing (12 rounds)
- `socket.io` 4.8.3 — Real-time WebSocket server
- `axios` 1.6.2 — HTTP client (OpenRouter calls)
- `multer` 2.1.1 — Multipart file upload handling
- `file-type` 14.7.1 — MIME type detection from buffer bytes (last CJS-compatible version)
- `bad-words` 3.0.4 — Profanity detection and filtering
- `xss` 1.0.14 — XSS string sanitization
- `express-validator` 7.0.1 — Request body validation chains
- `express-rate-limit` 7.1.5 — Per-route rate limiting
- `helmet` 7.1.0 — Security headers (CSP, X-Frame-Options, etc.)
- `express-mongo-sanitize` 2.2.0 — Strips `$` and `.` from MongoDB query input
- `hpp` 0.2.3 — HTTP parameter pollution prevention
- `morgan` 1.10.0 — HTTP request logging to stdout
- `winston` 3.11.0 — Structured application logging
- `compression` 1.7.4 — gzip response compression
- `cookie-parser` 1.4.6 — Cookie parsing middleware
- `cors` 2.8.5 — CORS with configurable origin whitelist
- `uuid` 9.0.1 — UUID v4 generation (filenames, undo tokens)
- `suncalc` 1.9.0 — Astronomical time calculations (timezone/time features)
- `dotenv` 16.3.1 — Loads `.env` into `process.env`
- `nodemon` — Dev only; auto-restarts server on file changes
- `concurrently` — Dev only; runs backend + frontend simultaneously

### Frontend (React / Vite)

- `react` 18.2.0 — UI library
- `react-dom` 18.2.0 — DOM renderer
- `react-router-dom` 6.21.1 — Client-side routing (BrowserRouter)
- `axios` 1.6.2 — HTTP client with interceptors for CSRF + auto-refresh
- `socket.io-client` 4.8.3 — WebSocket client
- `react-hot-toast` 2.4.1 — Toast notifications
- `lucide-react` 0.303.0 — SVG icon library
- `date-fns` 3.0.6 — Date formatting and arithmetic
- `tailwindcss` 3.4.1 — Utility-first CSS framework
- `vite` 5.0.10 — Build tool and dev server
- `@vitejs/plugin-react` — Vite plugin for React JSX + Fast Refresh
- `autoprefixer` — PostCSS vendor prefixing
- `postcss` — CSS transformation pipeline

---

## 7. Database Models

### 7.1 User (`src/models/User.js`)

- `publicId` — String, unique, indexed; 6-digit collision-safe human-readable ID
- `username` — String, required, unique, 3–30 chars, alphanumeric + underscore only
- `email` — String, required, unique, stored lowercase
- `password` — String, required, `select: false`; bcrypt 12 rounds
- `role` — Enum `[user, admin]`, default `user`
- `refreshToken` — String, `select: false`
- `avatar` — String, nullable
- `isBanned` — Boolean, default `false`
- `bannedAt` — Date, nullable
- `bannedBy` — ObjectId → User, nullable
- `banReason` — String, nullable
- `loginAttempts` — Number, default `0`
- `lockUntil` — Date; account locked after 5 failed logins for 15 minutes
- `lastLogin` — Date
- `lastLoginIP` — String, excluded from `toJSON`
- `postCount` — Number, default `0`
- `commentCount` — Number, default `0`
- `timeoutUntil` — Date, nullable
- `timeoutBy` — ObjectId → User, nullable
- `timeoutReason` — String, nullable
- `activeSession` — Embedded object:
  - `fingerprint` — String
  - `deviceBrand` — String
  - `deviceModel` — String
  - `deviceOs` — String
  - `userAgent` — String
  - `ip` — String
  - `lastSeen` — Date
- Timestamps: `createdAt`, `updatedAt`
- Indexes: `publicId`, `username`, `email`
- `toJSON` hook removes: `password`, `refreshToken`, `loginAttempts`, `lockUntil`, `lastLoginIP`

### 7.2 Post (`src/models/Post.js`)

- `title` — String, required, 5–200 chars
- `description` — String, required, 10–5000 chars
- `imageUrl` — String, nullable; validated as `https?://...` URL pattern
- `tags` — Array of String, max 6 items; values from `POST_TAGS` enum (18 predefined values)
- `author` — ObjectId → User
- `voteScore` — Number, default `0`
- `upvotes` — Number, default `0`
- `downvotes` — Number, default `0`
- `commentCount` — Number, default `0`
- `isHidden` — Boolean, default `false`
- `hiddenBy` — ObjectId → User, nullable
- `hiddenAt` — Date, nullable
- `hideReason` — String, nullable
- `isArchived` — Boolean, default `false`
- `archivedAt` — Date, nullable
- `archivedBy` — ObjectId → User, nullable
- `archiveReason` — String, nullable
- `isPinned` — Boolean, default `false`
- `pinnedAt` — Date, nullable
- `pinnedBy` — ObjectId → User, nullable
- `lastCommentAt` — Date, indexed (used for "active" sort)
- `sentiment` — Embedded object:
  - `score` — Number, `-1.0` to `+1.0`
  - `label` — Enum `[positive, neutral, negative, anxious, frustrated]`
  - `analyzedAt` — Date
  - `source` — Enum `[api, library, pending, unanalyzed]`
- Timestamps: `createdAt`, `updatedAt`
- Indexes: full-text on `title + description + tags`, `createdAt` desc, `voteScore` desc

### 7.3 Comment (`src/models/Comment.js`)

- `post` — ObjectId → Post, required, indexed
- `parent` — ObjectId → Comment, nullable (`null` = root comment)
- `content` — String, required, 1–2000 chars
- `author` — ObjectId → User
- `voteScore` — Number, default `0`
- `upvotes` — Number, default `0`
- `downvotes` — Number, default `0`
- `depth` — Number, default `0`; `0` = root; display capped at `8`
- `replyCount` — Number, default `0`
- `isHidden` — Boolean, default `false`
- `mentions` — Array of embedded objects:
  - `userId` — ObjectId → User
  - `username` — String
  - `publicId` — String
- `sentiment` — Embedded object (same schema as Post.sentiment)
- Timestamps: `createdAt`, `updatedAt`
- Indexes: `{post, createdAt}`, `{post, parent}`

### 7.4 Vote (`src/models/Vote.js`)

- `user` — ObjectId → User
- `target` — ObjectId (dynamic ref via `refPath`)
- `targetModel` — Enum `[Post, Comment]` (drives `refPath`)
- `value` — Enum `[1, -1]` (upvote / downvote)
- Timestamps: `createdAt`, `updatedAt`
- Unique compound index: `{user, target}` — one vote per user per target

### 7.5 Notification (`src/models/Notification.js`)

- `recipient` — ObjectId → User, required, indexed
- `type` — Enum `[reply, mention, admin_message]`
- `actor` — ObjectId → User, nullable (the user who triggered the notification)
- `post` — ObjectId → Post, nullable
- `comment` — ObjectId → Comment, nullable
- `message` — String, nullable (used for `admin_message` type)
- `read` — Boolean, default `false`, indexed
- Timestamps: `createdAt`, `updatedAt`
- Indexes: `{recipient, read, createdAt desc}`, TTL on `createdAt` (30 days)

### 7.6 FAQ (`src/models/FAQ.js`)

- `main` — String, required, unique (category name, e.g. "Stipend & Payments")
- `sub` — Array of embedded Q&A objects:
  - `question` — String, required
  - `answer` — String, required
  - `createdAt`, `updatedAt` — subdocument timestamps
- `order` — Number, default `0` (controls display order)
- Timestamps: `createdAt`, `updatedAt`

### 7.7 Log (`src/models/Log.js`)

- `level` — Enum `[info, warn, error]`, indexed
- `category` — Enum `[auth, post, comment, vote, admin, system, security]`, indexed
- `action` — String, required, indexed (e.g., `user_login`, `post_hidden`, `comment_deleted`)
- `userId` — ObjectId → User, nullable, indexed
- `userEmail` — String
- `username` — String
- `ip` — String
- `userAgent` — String
- `details` — Mixed (arbitrary extra context object)
- `targetType` — String (`Post`, `User`, `FAQ`, `Comment`)
- `targetId` — ObjectId
- `targetSnapshot` — Mixed (selected model fields captured at action time)
- `method` — String (HTTP verb)
- `path` — String (request path)
- `statusCode` — Number
- `durationMs` — Number
- `query` — Mixed (sanitized query params)
- `body` — Mixed (sanitized request body)
- `referer` — String
- `origin` — String
- `userRole` — String
- `userPublicId` — String
- `tags` — Array of String (e.g., `security`, `rate_limited`, `undo`)
- `severity` — Enum `[debug, info, warn, error, critical]`, default `info`
- `sessionHint` — String, nullable
- `deviceFingerprint` — String
- `deviceBrand` — String
- `deviceModel` — String
- `deviceOs` — String
- Timestamps: `createdAt`, `updatedAt`
- Indexes: `createdAt` desc, TTL on `createdAt` (90 days auto-delete)

### 7.8 UndoToken (`src/models/UndoToken.js`)

- `token` — String, unique (UUID v4)
- `adminId` — ObjectId → User (token is bound to this admin — others cannot use it)
- `action` — String (`unhide_post`, `unarchive_post`, `remove_timeout`)
- `targetType` — String (`Post`, `User`)
- `targetId` — ObjectId
- `snapshot` — Mixed (fields to restore, captured at action time)
- `expiresAt` — Date (set to `now + 10 seconds` by server)
- `used` — Boolean, default `false`
- Index: `{expiresAt: 1}` with `expireAfterSeconds: 0` → MongoDB auto-deletes expired tokens

### 7.9 SearchCluster (`src/models/SearchCluster.js`)

- `label` — String (human-readable topic assigned by Claude)
- `queryCount` — Number (total dead-end queries in this cluster)
- `firstSeen` — Date
- `lastSeen` — Date
- `status` — Enum `[unresolved, in_progress, resolved]`, indexed
- `faqEntryId` — ObjectId → FAQ, nullable (linked FAQ if resolved)
- `trend` — Enum `[up, flat, down]`
- `lastClusteredAt` — Date, nullable
- `isActive` — Boolean
- Timestamps: `createdAt`, `updatedAt`
- Index: `{status, lastClusteredAt desc}`

### 7.10 DeadEndSearch (`src/models/DeadEndSearch.js`)

- `rawQuery` — String, max 200
- `normalizedQuery` — String, max 200, indexed
- `outcomeType` — Enum `[zero_results, no_click, converted_to_request]`, indexed
- `sessionId` — String, indexed
- `cohortId` — String, nullable
- `clusterId` — ObjectId → SearchCluster, nullable, indexed
- `convertedToRequest` — Boolean, indexed
- `requestId` — ObjectId, nullable (reserved for future use)
- Timestamps: `createdAt`, `updatedAt`
- Indexes: `{sessionId, normalizedQuery}`, `createdAt` desc

### 7.11 SentimentAlert (`src/models/SentimentAlert.js`)

- `cohortId` — String, nullable
- `triggerType` — String (e.g., `sentiment_drop`, `sentiment_spike`)
- `currentScore` — Number (0–100 display range)
- `previousScore` — Number
- `delta` — Number (difference between scores)
- `postCount` — Number (posts analyzed in window)
- `triggeredAt` — Date, indexed
- `acknowledgedBy` — ObjectId → User, nullable
- `acknowledgedAt` — Date, nullable
- `adminNote` — String, nullable
- Timestamps: `createdAt`, `updatedAt`

### 7.12 SentimentAlertRule (`src/models/SentimentAlertRule.js`)

- `cohortId` — String, nullable
- `thresholdType` — Enum `[absolute, relative]`, default `relative`
- `thresholdValue` — Number, default `25` (points of change that triggers alert)
- `comparisonWindowDays` — Number, default `7`
- `minPostVolume` — Number, default `5` (minimum posts required to fire)
- `isActive` — Boolean, indexed
- `createdBy` — ObjectId → User, nullable
- Timestamps: `createdAt`, `updatedAt`

---

## 8. API Routes

### 8.1 Auth — `/api/auth`

- `POST /register` — Create account
  - Validates: username (3–30, alphanumeric+underscore), email, password (8+ chars, must have upper, lower, digit)
  - Returns: sets `access_token` + `refresh_token` httpOnly cookies, `csrf_token` readable cookie
- `POST /login` — Login
  - Checks: isBanned, lockUntil, password bcrypt compare
  - Increments `loginAttempts`; locks for 15 min after 5 failures
  - Sets same three cookies as register
- `POST /force-login` — Override device conflict (single-session enforcement)
- `POST /logout` — Clears all three auth cookies, nulls `refreshToken` in DB
- `GET /me` — Returns current user object (requires `verifyToken`)
- `POST /refresh` — Rotates `access_token` using `refresh_token` cookie; returns new token

### 8.2 FAQ — `/api/faq`

- `GET /` — All FAQ categories sorted by `order` (public, no auth)

### 8.3 Forum — `/api/forum`

- `GET /posts` — Paginated post list
  - Query params: `sort` (top/new/old/active), `period` (day/week/month/all), `tag`, `page`, `limit`
  - Hidden/archived posts filtered out for non-admins
- `GET /posts/:id` — Single post with populated author
- `POST /posts` — Create post (requires `verifyToken`, `checkTimeout`, `postCreationLimiter`)
- `POST /posts/check-duplicate` — AI duplicate detection via OpenRouter (rate-limited 10/min)
- `POST /posts/:id/vote` — Vote on post; body: `{value: 1 | -1}`
- `DELETE /posts/:id` — Delete post (author or admin only)
- `GET /posts/:id/comments` — Full comment tree (sorted: voteScore desc, createdAt asc)
- `POST /posts/:id/comments` — Create comment (requires `verifyToken`, `checkTimeout`, `commentLimiter`)
- `POST /posts/:id/comments/:commentId/vote` — Vote on comment
- `DELETE /posts/:id/comments/:commentId` — Delete comment
- `GET /search` — Advanced search
  - Filters: keyword, fromUser, tag, hasImage, hasComments, hasVotes, before, after
- `GET /tags` — Returns static list of all valid tags

### 8.4 Admin — `/api/admin` (all require `verifyToken` + `requireAdmin`)

- `GET /stats` — Dashboard stats: user/post/comment totals, top-poster list, posts-over-time chart data
- `GET /users` — Paginated users; search by username/email/publicId; filter by role
- `POST /users` — Create user
- `PUT /users/:id` — Update user (role change, ban/unban)
- `DELETE /users/:id` — Delete user
- `POST /users/:id/timeout` — Timeout user; body: `{durationMinutes: 1–43200, reason}`; returns `{undoToken}`
- `DELETE /users/:id/timeout` — Remove active timeout
- `GET /posts` — Admin post list (supports `showHidden=true`, search by title/content)
- `PUT /posts/:id/pin` — Toggle pin on post
- `PUT /posts/:id/hide` — Hide/restore post; returns `{undoToken}` on hide
- `PUT /posts/:id/archive` — Archive/unarchive post; returns `{undoToken}` on archive
- `DELETE /posts/:id/hard` — Permanently delete post + all comments + all votes (irreversible)
- `POST /undo` — Execute undo token; validates: token not used, not expired, same admin as issuer
- `GET /logs` — Paginated audit logs; filters: category, level, search term
- `GET /faq` — All FAQ categories with MongoDB `_id` fields exposed
- `POST /faq` — Create FAQ category
- `DELETE /faq/:categoryId` — Delete entire FAQ category
- `POST /faq/:categoryId/questions` — Add question to category
- `PUT /faq/:categoryId/questions/:questionId` — Edit existing question
- `DELETE /faq/:categoryId/questions/:questionId` — Delete question
- `GET /members` — Paginated member list; search; includes online status from `onlineUsers` Map
- `GET /members/online` — Online members only
- `GET /search-gaps` — Paginated search clusters; filter by status; includes sample queries
- `PATCH /search-gaps/:clusterId/status` — Update cluster status (unresolved/in_progress/resolved)
- `POST /search-gaps/trigger-clustering` — Manually trigger the 6-hour clustering job immediately
- `GET /sentiment` — Sentiment score + emotion breakdown; query: `window` (5m/1h/6h/1d/7d/30d)
- `POST /sentiment/run-analysis` — Trigger sentiment job on all unanalyzed posts + comments
- `GET /sentiment/alerts` — List all sentiment alerts (newest first)
- `PATCH /sentiment/alerts/:alertId/acknowledge` — Mark alert acknowledged; body: `{adminNote}`

### 8.5 Notifications — `/api/notifications` (require `verifyToken`)

- `GET /` — Last 30 notifications + unread count
- `PUT /read-all` — Mark all notifications as read
- `PUT /:id/read` — Mark single notification as read

### 8.6 Users — `/api/users`

- `GET /search?q=` — Prefix search for @mention autocomplete (requires `verifyToken`, `mentionSearchLimiter` 30/min)

### 8.7 Upload — `/api/upload`

- `POST /image` — Upload image
  - Requires `verifyToken`, `checkTimeout`, `uploadLimiter` (10/min)
  - Reads buffer bytes via `file-type@14` (actual MIME, not Content-Type header)
  - Accepts: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
  - Max size: 5 MB
  - Saves as `/uploads/<uuid>.<ext>`
  - Returns: `{url: "/uploads/<uuid>.<ext>"}`

### 8.8 Chatbot — `/api/chatbot`

- `POST /chat` — Yaksha AI chat endpoint
  - Rate limited: `chatbotLimiter` (20 requests / 10 min)
  - Requires `verifyToken`
  - Sends conversation to OpenRouter (Claude 3 Haiku) with FAQ context injected as system prompt

### 8.9 Dead-End Search — `/api/forum/dead-end`

- `POST /` — Log dead-end search
  - Body: `{rawQuery, normalizedQuery, outcomeType, sessionId}`
  - Rate limited: 30 / 10 min

---

## 9. Rate Limits

| Endpoint Category     | Window  | Max Requests |
|-----------------------|---------|--------------|
| Login / Register      | 15 min  | 10           |
| Create post           | 60 min  | 15           |
| Create comment        | 10 min  | 30           |
| Chatbot               | 10 min  | 20           |
| Duplicate check       | 1 min   | 10           |
| Mention user search   | 1 min   | 30           |
| Image upload          | 1 min   | 10           |
| Forum search          | 1 min   | 60           |
| Dead-end logging      | 10 min  | 30           |

---

## 10. Authentication & Security

### JWT Cookie Architecture

- `access_token` — httpOnly, SameSite=strict; 15-minute TTL; carries `{userId, role}`
- `refresh_token` — httpOnly, path=/api/auth/refresh; 7-day TTL; rotated on each use
- `csrf_token` — readable by JS (not httpOnly); UUID; required in `X-CSRF-Token` header on all mutations

### CSRF Double-Submit Pattern

- On every state-mutating request (POST/PUT/PATCH/DELETE), `security.js` middleware reads `csrf_token` cookie and `X-CSRF-Token` header
- Rejects with `403 CSRF_INVALID` if they don't match
- `src/lib/api.js` (Axios instance) automatically reads `csrf_token` cookie and injects the header

### Auto-Refresh Flow (Frontend)

- Axios response interceptor in `api.js` catches `401 TOKEN_EXPIRED`
- Queues all in-flight requests
- Calls `POST /api/auth/refresh` once
- On success: drains queue, retries all requests
- On failure: clears auth state, redirects to login

### Account Locking

- 5 consecutive failed logins → `lockUntil = now + 15min` stored in `User.lockUntil`
- Login endpoint checks `lockUntil` before password comparison
- `loginAttempts` resets to `0` on successful login

### Single-Device Session Enforcement

- On login, server stores device fingerprint in `User.activeSession`
- If fingerprint differs on next login → returns `409 DEVICE_CONFLICT`
- Client prompts user; `POST /force-login` overrides and sets new session

### Socket.io Authentication

- Socket middleware reads `cookie` header from the WS handshake via regex: extracts `access_token`
- Verifies JWT; rejects banned users before allowing connection
- Uses `withCredentials: true` on client so browser sends httpOnly cookie automatically

### Input Sanitization Stack

- `express-mongo-sanitize` — strips `$` and `.` from all request body + query fields (NoSQL injection)
- `HPP` — prevents HTTP parameter pollution (deduplicates array params)
- `xss` library — used in services to sanitize HTML in post/comment content
- `helmet` — sets: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` (in production)
- Regex input escaping: `s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` before any MongoDB `$regex` query — prevents ReDoS

### File Upload Security

- `file-type@14` reads actual buffer magic bytes — ignores `Content-Type` header (spoofable)
- UUID filename — original filename never stored, never served
- Max 5 MB enforced by `multer` limits before MIME check
- Stored in `uploads/` which is served as static by Express at `/uploads/`

### Timeout Enforcement

- `checkTimeout` middleware reads `User.timeoutUntil`
- Applied to: `POST /posts`, `POST /comments`, `POST /upload/image` (all write endpoints)
- Returns `403 TIMEOUT_ACTIVE` with `{timeoutUntil, reason}` — client shows countdown banner
- Enforced server-side only; frontend UI is cosmetic

### Opaque IDs

- All member-facing APIs return `publicId` (6-digit number), never MongoDB `_id`
- Prevents enumeration and schema inference

---

## 11. Frontend Architecture

### Provider Hierarchy (`src/main.jsx`)

```
ThemeProvider
  └── AuthProvider
        └── SocketProvider
              └── BrowserRouter
                    └── App
```

### Routing (`src/App.jsx`)

- `/` — `FAQPage`
- `/forum` — `ForumPage`
- `/forum/:postId` — `PostDetail`
- `/admin` — `AdminPage` (frontend redirects non-admins; server enforces independently)

### Context Providers

- `AuthContext.jsx`
  - Exposes: `user`, `loading`, `login()`, `register()`, `logout()`, `refreshAuth()`, `isAdmin`
  - On mount: calls `GET /api/auth/me` to restore session from cookie
  - `isAdmin` is derived: `user?.role === 'admin'`

- `ThemeContext.jsx`
  - Exposes: `theme` (`light` | `dark`), `toggleTheme()`, `isDark`
  - Persists choice in `localStorage`
  - Adds/removes `.dark` class on `<html>` element
  - Initial value: reads `localStorage`, falls back to system `prefers-color-scheme`

- `SocketContext.jsx`
  - Connects only when `user` is set (after login)
  - `withCredentials: true` so browser sends httpOnly cookie
  - Reconnection: 5 attempts, 2-second delay
  - Handles `force_logout` event: clears auth state, shows toast, navigates to `/`
  - Cleans up (disconnects) when `user` becomes null (logout)

### HTTP Client (`src/lib/api.js`)

- Axios instance with `baseURL: ''` (relative — works via Vite proxy in dev, same origin in prod)
- `withCredentials: true` on all requests
- Request interceptor: reads `csrf_token` cookie, injects `X-CSRF-Token` header
- Response interceptor: on `401 TOKEN_EXPIRED`, queues requests, calls `/api/auth/refresh`, retries

### CSS Architecture (`src/styles.css`)

- All semantic colors defined as CSS custom properties on `:root` (light) and `.dark` (dark override)
- No Tailwind `dark:` prefix used — all theming via CSS variables and `rgba()`
- Component utility classes defined directly in `styles.css` (e.g., `.card`, `.btn-primary`)
- Visual style: "Liquid glass" — 4-blob radial gradient backdrop, `backdrop-filter: blur(24px) saturate(160%)` on cards/modals

---

## 12. Feature Breakdown

### 12.1 FAQ Page (`src/components/FAQ/FAQPage.jsx`)

- Full-text search input across all questions and answers (client-side filter)
- Result count display updates live as user types
- Multi-select category filter in sticky left sidebar (`TagFilter.jsx`)
- Collapsible Q&A items with animated expand/collapse (`FAQItem.jsx`)
- **Dead-end logging**:
  - Zero-result queries: logged after 800 ms debounce (session-deduplicated via `sessionId`)
  - Triggers `POST /api/forum/dead-end` with `outcomeType: zero_results`
- **Yaksha AI Chatbot** (`Chatbot.jsx`):
  - Floating card, 360 × 480 px
  - Persistent message history within session (last 10 messages sent as context)
  - Rate-limited 20 requests / 10 min server-side
  - FAQ data injected into system prompt for contextual answers

### 12.2 Forum Post List (`src/components/Forum/ForumPage.jsx`)

- Paginated post cards
- Sort options: top (voteScore desc), new (createdAt desc), old (createdAt asc), active (lastCommentAt desc)
- Time period filter: day / week / month / all (applied to `createdAt`)
- Tag filter chips (multi-select)
- "New Post" button (opens `CreatePost` modal); shows login prompt for unauthenticated users
- Admin-only right-side `MemberPanel` (xl breakpoint and above)
- Keyboard shortcut `Ctrl+K` opens `SearchModal`

### 12.3 Post Card (`src/components/Forum/PostCard.jsx`)

- Displays: title (truncated), description preview, author publicId, relative timestamp
- Vote score, comment count, tag chips
- Three-dot context menu rendered via `createPortal` into `document.body`
  - Why `createPortal`: `backdrop-filter` on card creates a new stacking context; `position: fixed` menu would be clipped without portal
- Context menu actions (author): delete post
- Context menu actions (admin): hide, archive, hard delete, pin

### 12.4 Post Detail (`src/components/Forum/PostDetail.jsx`)

- Full title, description, tags
- Image display if `imageUrl` present
- Vote buttons (upvote/downvote); user's existing vote pre-highlighted
- Comment count
- Timeout banner if `user.timeoutUntil > now` (countdown until timeout expires)
- Full comment tree (`CommentThread.jsx`)
- Root-level comment submission textarea

### 12.5 Comment System (`src/components/Forum/CommentThread.jsx`)

- N-level recursive tree rendered from flat DB result
  - Server returns flat array; client builds tree via `Map` in O(n)
- Indentation: 16 px per level, capped at 64 px (4 levels visually)
- Left-border accent color per depth level
- Root comments collapsible (toggle hides all children)
- Each comment: author info, relative timestamp, vote buttons, reply button
- Reply composer: inline `<textarea>` opens below parent comment
- Sorting at each level: `voteScore` desc, `createdAt` asc (most helpful surfaces first)
- Vote updates happen optimistically on click

### 12.6 @Mention System

- **Trigger**: typing `@` followed by 1+ characters in comment textarea
- **Autocomplete dropdown**:
  - "Members" header
  - Avatar (initials from username, colored background)
  - Username + `#publicId`
  - Accent border on hover
  - Keyboard-navigable
- **Click handler**: uses `onMouseDown` (not `onClick`) to fire before `blur` on textarea
- **Insertion**: replaces `@partial` in textarea with `@username `
- **Limit**: max 10 mentions per comment
- **Server**: `parseMentions.js` extracts @usernames via regex, does case-insensitive DB lookup, stores resolved `{userId, username, publicId}` array in `Comment.mentions`
- **Notification**: each mentioned user receives a `mention` notification (non-fatal if fails)
- **Rendering**: stored mentions rendered as `<span class="mention">@username</span>` (purple highlight)

### 12.7 Forum Search Modal (`src/components/Forum/SearchModal.jsx`)

- Trigger: `Ctrl+K` (event listener on `window`)
- Discord-style full-screen modal with centered search card
- Debounced search: 80 ms
- Result animations: staggered fade-in per card
- **Keyword highlighting**: matched substring wrapped in `<mark>` in results
- **Composable filter chips**:
  - `From User` — autocomplete dropdown with avatar (calls `GET /api/users/search`)
  - `Tag` — scrollable tag selector
  - `Has` — checkboxes: image / comments / votes
  - `Before` / `After` — date pickers
- **Dead-end tracking**:
  - Zero results → logged after 800 ms (`zero_results`)
  - Results exist, user doesn't click anything for 15 s → logged as `no_click`

### 12.8 Create Post (`src/components/Forum/CreatePost.jsx`)

- Fields: title (5–200), description (10–5000), tags (max 6), image (optional)
- **Image upload**:
  - Supports drag-and-drop, file input click, and paste (`paste` event)
  - Shows preview before upload
  - Uploads immediately on selection to `POST /api/upload/image`
  - Returns relative URL stored in form state
- **Profanity check**: `bad-words` runs client-side on title + description; shows inline warning badge, does NOT block submission
- **AI duplicate detection**: optional button calls `POST /api/forum/posts/check-duplicate`; shows warning card with matched post title + similarity reasoning if duplicate found; user can still submit
- Blocked if user has active timeout (server enforces, client shows banner)

### 12.9 Notification System

- **Types**: `reply` (someone replied to your comment), `mention` (you were @mentioned), `admin_message` (direct admin message)
- **Bell icon** in Navbar: red badge with unread count
- **Dropdown** (`NotificationBell.jsx`): last 30 notifications, type-specific icons, relative timestamps
- **Click behavior**: marks notification as read, navigates to the relevant post via `react-router-dom`
- **"Mark all read"**: calls `PUT /api/notifications/read-all`
- **Self-notification prevention**: `notificationController.js` skips creation if `actor === recipient`
- **Real-time delivery**: Socket.io `notification` event emitted to `user:<userId>` room; client appends to dropdown without refresh
- **Non-fatal**: failures in `createNotification()` are caught and logged, never rethrow to block the triggering action
- **Auto-expiry**: MongoDB TTL index on `createdAt` (30 days)

### 12.10 Theme System

- **Light mode**: white / off-white background, subtle indigo accents
- **Dark mode**: pure black base (`#000`), neutral grey surfaces, no blue tint
- **Liquid glass visual**:
  - 4-blob radial gradient backdrop (fixed position, blurred, behind all content)
  - Cards: `backdrop-filter: blur(24px) saturate(160%)`
  - Buttons: similar treatment with subtle transparency
- **Toggle**: sun/moon icon in Navbar; animates on switch
- **Persistence**: `localStorage` key `theme`

### 12.11 Navbar (`src/components/Navbar/Navbar.jsx`)

- Sticky (stays at top on scroll)
- **Logo**: VINS wordmark + link to `/`
- **Nav links**: FAQ (`/`), Forum (`/forum`), Admin (`/admin`) — Admin link only visible if `isAdmin`
- **Live clock**: `HH:MM:SS` + date + timezone; updates every 1 second via `setInterval`
- **Theme toggle**: sun/moon icon button
- **Notification bell**: unread badge, dropdown on click
- **User pill**: avatar (first letter of username), username, "Admin" badge if admin role
- **Mobile menu**: hamburger icon; slide-down drawer with same links + user info; closes on route change

---

## 13. Real-time System (Socket.io)

### Server Setup (`src/server.js` + `src/lib/socketServer.js`)

- Socket.io server attached to same HTTP server as Express
- CORS: `origin: process.env.FRONTEND_URL`, `credentials: true`
- **Auth middleware** (runs before `connection` event):
  - Reads `cookie` header from WS handshake via regex to extract `access_token`
  - Verifies JWT; sets `socket.userId` and `socket.userRole`
  - Rejects banned users with `Authentication error`
- **On connect**:
  - Adds `userId → socketId` to `onlineUsers` Map
  - Joins personal room `user:<userId>`
- **On disconnect**:
  - Removes from `onlineUsers` Map
- **Rooms**:
  - `user:<userId>` — personal; used for notifications and `force_logout`
  - `post:<postId>` — reserved for post-level real-time (future use)
- `emitToUser(userId, event, data)` — looks up socket by `userId` in Map, emits to room

### Client Setup (`src/context/SocketContext.jsx`)

- Connects when `user` is non-null (post-login)
- `withCredentials: true` — browser sends httpOnly `access_token` cookie with WS handshake
- Reconnection config: `reconnectionAttempts: 5`, `reconnectionDelay: 2000`
- Listens for:
  - `notification` — appends to NotificationBell state
  - `force_logout` — clears auth, shows toast "Logged in from another device", navigates to `/`
- Disconnects and nulls socket ref on logout (`user` becomes `null`)

---

## 14. Background Jobs

### 14.1 Clustering Job (`src/algorithms/clusteringJob.js`)

- **Schedule**: every 6 hours (via `setInterval` at server boot)
- **What it does**:
  - Fetches up to 100 `DeadEndSearch` records where `clusterId` is `null`
  - Sends the list of `normalizedQuery` strings to Claude 3 Haiku via OpenRouter
  - Prompt asks Claude to group queries into semantic clusters and return JSON array: `[{cluster_label, queries: []}]`
  - For each cluster: finds or creates `SearchCluster` document with that label
  - Updates `queryCount`, calculates `trend` (up/flat/down based on 7-day query rate), sets `lastSeen`
  - Associates each `DeadEndSearch` with its `clusterId`
- **Admin trigger**: `POST /api/admin/search-gaps/trigger-clustering` runs it immediately

### 14.2 Sentiment Job (`src/algorithms/sentimentJob.js`)

- **Trigger**: on-demand via `POST /api/admin/sentiment/run-analysis` (not scheduled)
- **What it does**:
  - Queries all Posts and Comments with `sentiment.source = 'unanalyzed'` or `'pending'`
  - Skips entries with content < 10 words that end with `?` (short FAQ-style questions)
  - For each item, sends content to Claude 3 Haiku with a sentiment analysis prompt
  - Claude returns: `{score: -1.0 to +1.0, label: 'positive' | 'neutral' | 'negative' | 'anxious' | 'frustrated'}`
  - Stores result in `Post.sentiment` or `Comment.sentiment`
  - On API failure: waits 5 seconds, retries once; marks `source: 'pending'` if still fails

### 14.3 Alert Evaluator (`src/algorithms/alertEvaluator.js`)

- **Schedule**: every 1 hour (via `setInterval` at server boot)
- **What it does**:
  - Fetches all active `SentimentAlertRule` documents
  - For each rule: computes recency-weighted sentiment score for current window and previous window
  - Computes `delta = prevScore - currScore`
  - Fires `sentiment_drop` alert if `delta >= rule.thresholdValue` AND `postCount >= rule.minPostVolume`
  - Fires `sentiment_spike` alert if `currScore > 85`
  - Suppresses firing if an alert of the same type was created within the past 48 hours
  - Creates `SentimentAlert` document if threshold breached

---

## 15. AI Integrations

All AI calls go through `src/lib/openrouter.js` — a thin wrapper around `axios.post` to the OpenRouter API endpoint with auth header `Authorization: Bearer <OPENROUTER_API_KEY>`.

### Model Used

- `anthropic/claude-3-haiku` via OpenRouter (low latency, low cost, sufficient for all use cases here)

### Use Cases

| Feature | Prompt Task | Called From |
|---------|-------------|-------------|
| Yaksha Chatbot | Answer user question using FAQ context as system prompt | `chatbotController.js` |
| Duplicate Detection | Given new post title+body, compare against existing posts; return similarity reasoning | `forumController.js` (checkDuplicate) |
| Sentiment Analysis | Given post/comment text, return `score` (-1 to +1) and `label` | `sentimentJob.js` |
| Search Clustering | Given list of dead-end queries, group into semantic clusters with labels | `clusteringJob.js` |

---

## 16. Admin Panel

### Tab: Dashboard (`Statistics.jsx`)

- Stats cards: total users, total posts, total comments, active users (last 7 days)
- Top posters: ranked list by `postCount`
- Posts-over-time chart: daily post counts for last 30 days
- Activity feed: recent log events

### Tab: User Management (`UserManagement.jsx`)

- Paginated, searchable user table (search by username, email, or publicId)
- Role filter: all / user / admin
- Per-user actions: change role (user ↔ admin), ban/unban, timeout
- Timeout dialog: duration presets (15 min, 1 hr, 24 hr, 7 days) + custom minutes input + reason field
- Ban/unban: toggle with confirmation

### Tab: Post Moderation (`PostModeration.jsx`)

- Lists all posts including hidden/archived (admin sees everything)
- Per-post actions: hide/restore, archive/unarchive, hard delete, pin/unpin
- **Undo banner**: 10-second countdown toast after hide/archive/timeout; clicking "Undo" calls `POST /api/admin/undo`

### Tab: FAQ Management (`FAQManagement.jsx`)

- Category list with expand/collapse
- Add category, delete category
- Per-category: add question, edit question (inline), delete question
- Changes persist to MongoDB immediately

### Tab: Log Viewer (`LogViewer.jsx`)

- Paginated log table; 11 columns: Severity, Timestamp, Category, Action, User, Target, Target Type, Path, Status, Duration, IP
- Filters: category (dropdown), level (dropdown), free-text search
- Color-coded severity badges (debug=grey, info=blue, warn=yellow, error=red, critical=dark red)

### Tab: Search Gap Tracker (`SearchGapTracker.jsx`)

- Cards per SearchCluster: label, query count, trend indicator (up/flat/down arrow), first/last seen
- Status filter: all / unresolved / in_progress / resolved
- Expand card: shows sample raw queries from that cluster
- Status dropdown per card to move to in_progress or resolved
- "Trigger Clustering" button: calls `POST /api/admin/search-gaps/trigger-clustering`

### Tab: Sentiment Pulse (`SentimentPulse.jsx`)

- Overall sentiment score (0–100 display, recency-weighted)
- Time window selector: 5m / 1h / 6h / 1d / 7d / 30d
- Emotion breakdown bar: % positive / neutral / negative / anxious / frustrated
- Sentiment alerts list: unacknowledged alerts with delta, triggerType, post count
- Acknowledge button per alert (opens note input)
- "Run Analysis" button: triggers `POST /api/admin/sentiment/run-analysis`

### Member Panel (Forum sidebar) (`MemberPanel.jsx`)

- Visible only to admins, only at `xl` breakpoint and above
- Discord-style right sidebar
- Member list: avatar, username, online dot (green if in `onlineUsers` Map), admin badge, ban badge, timeout badge
- Search input: filters member list by username
- Click any member: expands inline moderation row
  - Timeout: duration presets + custom + reason → `POST /api/admin/users/:id/timeout`
  - Remove timeout: `DELETE /api/admin/users/:id/timeout`
  - Ban: `PUT /api/admin/users/:id` with `{isBanned: true}`
  - Unban: same endpoint with `{isBanned: false}`
- Undo toast: 10-second countdown; clicking "Undo" calls `POST /api/admin/undo`

---

## 17. Component Tree

```
App (BrowserRouter)
├── Navbar
│   ├── Logo (link to /)
│   ├── NavLinks (FAQ, Forum, Admin)
│   ├── LiveClock (updates every 1s)
│   ├── ThemeToggleButton
│   ├── NotificationBell
│   │   └── NotificationDropdown (last 30, mark-read, mark-all-read)
│   ├── UserPill (avatar initial, username, Admin badge)
│   └── MobileHamburgerMenu
│       └── MobileDrawer (same links + user info)
│
├── Route: / → FAQPage
│   ├── SearchInput (full-text filter)
│   ├── TagFilter (sticky left sidebar, multi-select)
│   ├── FAQList
│   │   └── FAQItem × N (collapsible Q&A, animated)
│   └── Chatbot (floating card, bottom-right)
│       ├── ChatMessages
│       └── ChatInput
│
├── Route: /forum → ForumPage
│   ├── Hero (title + description)
│   ├── SortDropdown (top/new/old/active)
│   ├── PeriodFilter (day/week/month/all)
│   ├── TagFilterChips
│   ├── NewPostButton
│   ├── PostList
│   │   └── PostCard × N
│   │       └── ContextMenu (createPortal → document.body)
│   ├── MemberPanel (admin-only, xl breakpoint)
│   │   ├── MemberSearch
│   │   ├── MemberList
│   │   │   └── MemberRow × N
│   │   │       └── ModerationRow (inline expand)
│   │   └── UndoToast
│   ├── SearchModal (Ctrl+K)
│   │   ├── SearchInput
│   │   ├── FilterChips (From User, Tag, Has, Before, After)
│   │   ├── ResultsList
│   │   │   └── ResultCard × N (keyword-highlighted)
│   │   └── FilterDropdowns
│   └── CreatePost (modal)
│       ├── TitleInput
│       ├── DescriptionInput
│       ├── ImageDropZone (drag/drop/paste)
│       ├── TagSelector
│       ├── ProfanityWarning (inline badge)
│       ├── DuplicateWarning (card with matched post)
│       └── SubmitButton
│
├── Route: /forum/:postId → PostDetail
│   ├── PostHeader (title, author, date, tags)
│   ├── PostImage (if imageUrl)
│   ├── PostBody (description)
│   ├── VoteButtons (up/down, score, user vote highlighted)
│   ├── TimeoutBanner (if user is timed out, countdown)
│   ├── RootCommentInput
│   └── CommentTree
│       └── CommentThread (recursive)
│           ├── CommentCard
│           │   ├── AuthorInfo (avatar, username#publicId, timestamp)
│           │   ├── CommentContent (with @mention spans)
│           │   ├── VoteButtons
│           │   ├── ReplyButton
│           │   └── CollapseButton (root only)
│           ├── MentionAutocompleteDropdown
│           └── ReplyComposer (inline textarea)
│
├── Route: /admin → AdminPage
│   ├── AdminSidebar (tab navigation)
│   ├── Statistics (Dashboard tab)
│   ├── UserManagement (Users tab)
│   │   └── TimeoutDialog
│   ├── PostModeration (Moderation tab)
│   │   └── UndoBanner (10s countdown)
│   ├── FAQManagement (FAQ tab)
│   ├── LogViewer (Logs tab)
│   ├── SearchGapTracker (Search Gaps tab)
│   └── SentimentPulse (Sentiment tab)
│       └── AlertAcknowledgeModal
│
└── Footer
    ├── BrandLinks (samagama.in, vicharanashala.ai)
    ├── FooterNavLinks
    └── PolicyModals
        ├── PrivacyPolicyModal
        ├── TermsOfServiceModal
        └── CommunityGuidelinesModal
```

---

## 18. Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| JWT in httpOnly cookies | XSS-resistant; `localStorage` is trivially readable by injected scripts |
| CSRF double-submit | Stateless SPA mutation protection; no server session store needed |
| N-level comments: flat DB + client Map tree | Single DB query; O(n) tree build; avoids N+1 query problem |
| `UndoToken` with MongoDB TTL | 10-second self-cleaning window; no cron needed; server-enforced expiry |
| `file-type@14` (not v20+) | v20 is ESM-only; the backend uses CommonJS; @14 is the last CJS-compatible version |
| `publicId` as 6-digit integer | Human-readable for admins; opaque enough to prevent enumeration; collision-safe generation |
| `$or + $regex` search (not `$text`) | No text index dependency; works on any Atlas tier; simpler deployment |
| `createPortal` for PostCard dropdown | `backdrop-filter` creates a new stacking context; `position: fixed` menu would be clipped inside it without portal escape |
| `onMouseDown` for @mention selection | `onClick` fires after `blur` on textarea; `onMouseDown` fires before, preserving textarea cursor position |
| Non-fatal `createNotification()` | Notification failure must never block comment/post creation (core action) |
| Socket reads cookie from WS handshake header | `access_token` is httpOnly; Socket.io auth middleware can read the raw cookie header from the handshake object |
| FAQ in MongoDB (not hardcoded) | Admins can add/edit/delete Q&A without code deploys |
| `checkTimeout` server-side only | Frontend timeout UI is cosmetic; a determined user could bypass it via direct API calls |
| `suncalc` for clock | Provides timezone-aware time calculations for the Navbar live clock |

---

## 19. Known Issues & Limitations

- **`/uploads` Vite proxy**: In dev, images are served by Express at port 5000. `vite.config.js` proxies `/uploads` to `:5000` — if this proxy is removed, uploaded images will 404 from the Vite origin
- **No EXIF stripping**: Uploaded images retain EXIF metadata (GPS, device info). Buffer is available before disk write — integration point for `sharp` exists but not wired in
- **`Post.imageUrl` validation vs. relative URLs**: The Mongoose model validates `imageUrl` as `https?://...`, but the upload endpoint returns `/uploads/<uuid>.<ext>` (relative path). `CreatePost.jsx` constructs an absolute URL before storing to work around this inconsistency
- **Single-device session**: Enforced at login time only; a user who shares their refresh token can have two active sessions until one is force-kicked
- **Sentiment job is on-demand**: No automatic scheduling for new post sentiment — requires manual admin trigger or API call
- **Comment depth display cap**: Depth capped at 8 levels visually (16 px × 4 = 64 px max indent), but nesting in DB is unlimited; very deep threads collapse visually

---

## 20. Maintenance Rules

- **Update `CONTEXT.md`** when: fixing bugs, adding features, making architectural decisions, breaking existing behavior
- **Update Section 8 (API Routes)** in `CONTEXT.md` when any route is added, changed, or removed
- **Update Section 4 (Env Vars)** in `CONTEXT.md` when any new env var is introduced
- **Never trust frontend role checks** — always enforce authorization on the server (`verifyToken` + `requireAdmin`)
- **Apply `checkTimeout`** to ALL new write endpoints
- **Never expose MongoDB `_id`** in member-facing APIs — use `publicId`
- **Always escape regex input** before any MongoDB `$regex` query: `s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`
- **All semantic colors** must use `rgba()` or CSS custom properties — never Tailwind `dark:` prefix
- **Use `src/lib/api.js`** for all frontend API calls — it handles CSRF header injection + auto-refresh
- **Default to no comments** in code — only add a comment when the WHY is non-obvious (hidden constraint, workaround, subtle invariant)
- **Do not add multi-paragraph docstrings** or comment blocks — one short line max if needed
- **Test uploads in dev** at `http://localhost:5000/uploads/<filename>` if Vite proxy is not configured
