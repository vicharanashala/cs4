# CONTEXT.md — VINS Community Platform
> Last updated: 2026-05-26 | Maintained by: all agents and contributors
> Session changes: liquid glass UI, pure black dark mode, Space Grotesk headings, portal dropdown, regex search, Discord @mention, integer publicId, admin publicId search, SearchModal z-index fix

---

## 1. Project Overview

Full MERN stack community platform for the **VINS (Vicharanashala Internship)** programme.
Three public pages: FAQ, Community Forum, Admin Panel.

**Stack:**
- Backend: Node.js + Express 5, port 5000
- Frontend: React 18 + Vite + Tailwind CSS, port 5173
- Database: MongoDB Atlas
- AI: OpenRouter API (Yaksha chatbot + duplicate post detection)
- Realtime: Socket.io 4 (JWT-authenticated, httpOnly-cookie-based)
- Auth: JWT in httpOnly cookies + refresh token rotation + CSRF double-submit cookies

**Default admin credentials** (run seed first):
```
Email:    admin@vins.in
Password: Admin@123456
```

---

## 2. Repository Structure

```
vins-crowdwork-11/
├── backend/
│   ├── server.js                     ← Express app entry + Socket.io server
│   ├── .env                          ← backend env vars (MONGO_URI, JWT_SECRET, etc.)
│   ├── uploads/                      ← uploaded images (served at /uploads/)
│   └── src/
│       ├── config/
│       │   └── db.js                 ← MongoDB connection
│       ├── controllers/
│       │   ├── adminController.js    ← user CRUD, post mod, timeout, undo, logs
│       │   ├── authController.js     ← register, login, refresh, logout
│       │   ├── chatbotController.js  ← OpenRouter Yaksha + duplicate detection
│       │   ├── faqController.js      ← public getAll + admin CRUD
│       │   ├── forumController.js    ← posts, comments (N-level), votes, mentions
│       │   ├── memberController.js   ← admin member list with online status
│       │   └── notificationController.js  ← create, get, mark read
│       ├── middleware/
│       │   ├── auth.js               ← verifyToken, requireAdmin, optionalAuth
│       │   ├── errorHandler.js       ← global Express error handler
│       │   ├── logger.js             ← Winston + MongoDB Log model helper
│       │   ├── rateLimiter.js        ← per-endpoint rate limit configs
│       │   ├── security.js           ← helmet, CORS, mongo-sanitize, HPP, CSRF
│       │   └── timeout.js            ← checkTimeout middleware
│       ├── models/
│       │   ├── Comment.js
│       │   ├── FAQ.js
│       │   ├── Log.js
│       │   ├── Notification.js
│       │   ├── Post.js
│       │   ├── UndoToken.js
│       │   ├── User.js
│       │   └── Vote.js
│       ├── routes/
│       │   ├── admin.js
│       │   ├── auth.js
│       │   ├── chatbot.js
│       │   ├── faq.js
│       │   ├── forum.js
│       │   ├── notifications.js
│       │   ├── upload.js
│       │   └── users.js
│       ├── scripts/
│       │   └── seed.js               ← creates admin user + imports faq.json to MongoDB
│       └── utils/
│           ├── openrouter.js         ← OpenRouter API client
│           ├── parseMentions.js      ← @mention regex parser → user IDs
│           └── socketServer.js       ← singleton io + onlineUsers Map
├── frontend/
│   ├── vite.config.js                ← proxies /api → :5000 (NOT /uploads)
│   └── src/
│       ├── App.jsx                   ← React Router routes
│       ├── main.jsx                  ← root with ThemeProvider/AuthProvider/SocketProvider
│       ├── index.css                 ← CSS variables (light/dark) + component classes
│       ├── utils/
│       │   └── api.js                ← Axios instance + CSRF interceptor + auto-refresh
│       ├── context/
│       │   ├── AuthContext.jsx       ← user state, login/logout, isAdmin flag
│       │   ├── SocketContext.jsx     ← Socket.io connection lifecycle
│       │   └── ThemeContext.jsx      ← dark/light mode toggle
│       └── components/
│           ├── Admin/
│           │   ├── AdminPage.jsx     ← tab shell (Dashboard/Users/Moderation/FAQ/Logs)
│           │   ├── FAQManagement.jsx ← add/edit/delete categories and questions
│           │   ├── LogViewer.jsx
│           │   ├── PostModeration.jsx  ← hide/archive/hard-delete + undo banner
│           │   ├── Statistics.jsx
│           │   └── UserManagement.jsx
│           ├── Auth/
│           │   └── LoginModal.jsx
│           ├── FAQ/
│           │   ├── Chatbot.jsx       ← Yaksha AI sidebar
│           │   ├── FAQItem.jsx       ← collapsible Q&A
│           │   └── FAQPage.jsx       ← tag filter, search, FAQ list
│           ├── Footer/
│           ├── Forum/
│           │   ├── CommentThread.jsx ← recursive N-level comments + @mention input
│           │   ├── CreatePost.jsx    ← post form + image drag/drop/paste upload
│           │   ├── ForumPage.jsx     ← post list + MemberPanel (admin-only)
│           │   ├── MemberPanel.jsx   ← Discord-style admin sidebar
│           │   ├── PostCard.jsx
│           │   └── PostDetail.jsx    ← post view + comment submission + TimeoutBanner
│           └── Navbar/
│               ├── Navbar.jsx
│               └── NotificationBell.jsx  ← real-time notification dropdown
├── faq.json                          ← static seed data for FAQ (imported to MongoDB once)
├── CONTEXT.md                        ← THIS FILE
└── .gitignore
```

---

## 3. Running the Project

```bash
# One-time: seed admin user and FAQ data into MongoDB
cd backend && npm run seed

# Terminal 1 — Backend
cd backend && npm run dev    # :5000

# Terminal 2 — Frontend
cd frontend && npm run dev   # :5173
```

**Known dev quirk:** `vite.config.js` only proxies `/api` to `:5000`. The `/uploads/` static path is NOT proxied. In development, uploaded image URLs will 404 when viewed from the Vite dev server. Fix: add `/uploads` to the Vite proxy, or open images directly at `http://localhost:5000/uploads/<filename>`.

---

## 4. Environment Variables

`backend/.env`:
```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>?retryWrites=true&w=majority
JWT_SECRET=<long random string>
JWT_REFRESH_SECRET=<different long random string>
FRONTEND_URL=http://localhost:5173
OPENROUTER_API_KEY=sk-or-...
```

`frontend/.env` (optional — Vite proxy handles `/api` in dev):
```
VITE_API_URL=http://localhost:5000/api
```

---

## 5. Database Models

### User
```
publicId        String  unique  6-digit integer string (Math.floor(100000 + Math.random() * 900000))
username        String  required  unique  3–30 chars  /^[a-zA-Z0-9_]+$/
email           String  required  unique  lowercase
password        String  required  select:false  bcrypt 12 rounds
role            String  enum:[user,admin]  default:user
refreshToken    String  select:false
avatar          String  default:null
isBanned        Boolean default:false
bannedAt        Date
bannedBy        ObjectId → User
banReason       String
loginAttempts   Number  default:0
lockUntil       Date    (set after 5 failed logins, 15-min lock)
lastLogin       Date
lastLoginIP     String  (excluded from toJSON)
postCount       Number  default:0
commentCount    Number  default:0
timeoutUntil    Date    default:null
timeoutBy       ObjectId → User  default:null
timeoutReason   String  default:null
```
toJSON strips: password, refreshToken, loginAttempts, lockUntil, lastLoginIP.
Pre-save hook: generates unique publicId (collision-safe loop), then hashes password if modified.

### Post
```
title           String  required  5–200 chars
description     String  required  10–5000 chars
imageUrl        String  nullable  must match https?://...
tags            [String]  max 5  enum: POST_TAGS (18 values)
author          ObjectId → User  required
voteScore       Number  default:0  index
upvotes         Number  default:0
downvotes       Number  default:0
commentCount    Number  default:0
isHidden        Boolean default:false  index
hiddenBy        ObjectId → User  nullable
hiddenAt        Date    nullable
hideReason      String  nullable
isArchived      Boolean default:false  index
archivedAt      Date    nullable
archivedBy      ObjectId → User  nullable
archiveReason   String  nullable
```
Indexes: text index on title+description+tags (declared but NOT used for search — `$or` regex used instead), createdAt desc, voteScore desc.

POST_TAGS: About VINS, Timing & Dates, NOC, Selection & Offer, Work & Mentorship, Code of Conduct, Interviews, Certificate, Rosetta, Phase 1 & ViBe, Yaksha Chat, ViBe Platform, Team Formation, General, Technical, Help Needed, Announcements, Off-topic

### Comment
```
post            ObjectId → Post  required  index
parent          ObjectId → Comment  default:null  (null = root comment)
content         String  required  1–2000 chars
author          ObjectId → User  required
voteScore       Number  default:0
upvotes         Number  default:0
downvotes       Number  default:0
depth           Number  default:0
replyCount      Number  default:0
isHidden        Boolean default:false
mentions        [{userId: ObjectId, username: String, publicId: String}]
```
Indexes: {post, createdAt}, {post, parent}.

### FAQ
```
main            String  required  unique  (category name)
sub             [{question, answer, _id, timestamps}]  (embedded subdocuments)
order           Number  default:0  (display order)
```
Data source: seeded from `faq.json` at first run. Managed via Admin → FAQ tab.

### Notification
```
recipient       ObjectId → User  required  index
type            String  enum:[reply, mention, admin_message]  required
actor           ObjectId → User  default:null
post            ObjectId → Post  default:null
comment         ObjectId → Comment  default:null
message         String  default:null  (used for admin_message type)
read            Boolean default:false  index
```
TTL: auto-deleted after 30 days (index on createdAt, expireAfterSeconds = 2592000).
Compound index: {recipient, read, createdAt desc}.

### UndoToken
```
token           String  required  unique  (UUID v4)
adminId         ObjectId → User  required
action          String  required  (e.g. 'unhide_post', 'remove_timeout', 'unarchive_post')
targetType      String  required  ('Post' or 'User')
targetId        ObjectId  required
snapshot        Mixed   required  (fields to restore on undo)
expiresAt       Date    required  (now + 10 seconds)
used            Boolean default:false
```
TTL: auto-deleted when expiresAt passes (index on expiresAt, expireAfterSeconds = 0).

### Vote
```
user            ObjectId → User  required
target          ObjectId  required  (dynamic ref via targetModel)
targetModel     String  enum:[Post, Comment]  required
value           Number  enum:[1, -1]  required
```
Unique index: {user, target} — one vote per user per target.

### Log
```
level           String  enum:[info, warn, error]  default:info  index
category        String  enum:[auth, post, comment, vote, admin, system, security]  index
action          String  required  index  (e.g. 'user_login', 'post_hidden')
userId          ObjectId → User  nullable  index
userEmail       String  nullable
username        String  nullable
ip              String  nullable
userAgent       String  nullable
details         Mixed   default:{}  (arbitrary extra context)

targetType      String  nullable  (e.g. 'Post', 'User', 'FAQ', 'Comment')
targetId        ObjectId  nullable
targetSnapshot  Mixed   default:{}  (selected fields of target at action time — never full doc)

method          String  nullable  (HTTP method, uppercase)
path            String  nullable  (request path)
statusCode      Number  nullable
durationMs      Number  nullable  (computed from startTime passed to logEvent)
query           Mixed   default:{}  (sanitized req.query)
body            Mixed   default:{}  (sanitized req.body — sensitive keys stripped)
referer         String  nullable
origin          String  nullable

userRole        String  nullable  (role at time of event)
userPublicId    String  nullable

tags            [String]  default:[]  (e.g. ['security', 'rate_limited', 'undo'])
severity        String  enum:[debug, info, warn, error, critical]  default:info
sessionHint     String  nullable  (opaque session identifier if available)
```
TTL: auto-deleted after 90 days. Logs are append-only — no delete/update endpoints exposed.

---

## 6. Authentication Flow

1. **Register/Login** → server sets two httpOnly cookies:
   - `access_token` (JWT, 15 min TTL, httpOnly, SameSite=Strict)
   - `refresh_token` (JWT, 7 days TTL, httpOnly, path=/api/auth/refresh)
   - `csrf_token` (UUID, readable by JS, SameSite=Strict) — used for CSRF double-submit
2. **All requests** → Axios `api.js` reads `csrf_token` cookie and injects `X-CSRF-Token` header on POST/PUT/PATCH/DELETE
3. **CSRF middleware** (`csrfProtect`) verifies header == cookie for all mutating requests
4. **401 TOKEN_EXPIRED** → Axios interceptor calls `/api/auth/refresh` once, queues concurrent requests, retries
5. **Account locking** → 5 failed logins triggers 15-minute lock (`lockUntil`), checked server-side
6. **Socket.io auth** → on handshake, reads `access_token` from cookie header via regex, verifies JWT, fetches user, rejects if banned

---

## 7. API Routes

All routes prefixed with `/api`.

### Auth  (`/api/auth`)
```
POST   /register         — create account
POST   /login            — set JWT cookies + csrf_token
POST   /refresh          — rotate access_token using refresh_token cookie
POST   /logout           — clear all auth cookies
GET    /me               — current user (verifyToken)
```

### FAQ  (`/api/faq`)
```
GET    /                 — all categories sorted by order (public)
```

### Forum  (`/api/forum`)
```
GET    /posts            — paginated posts (optionalAuth for userVote)
GET    /posts/:id        — single post
POST   /posts            — create post (verifyToken + checkTimeout + postCreationLimiter)
POST   /posts/check-duplicate — AI duplicate check (verifyToken + duplicateCheckLimiter)
POST   /posts/:id/vote   — upvote/downvote post (verifyToken + checkTimeout)
GET    /posts/:id/comments    — N-level comment tree (optionalAuth)
POST   /posts/:id/comments    — create comment (verifyToken + checkTimeout + commentLimiter)
POST   /posts/:id/comments/:commentId/vote  — vote comment (verifyToken + checkTimeout)
GET    /search           — search posts with filters (optionalAuth + searchLimiter 60/min)
GET    /tags             — static tag list
```

### Admin  (`/api/admin` — all require verifyToken + requireAdmin)
```
GET    /stats            — dashboard stats
GET    /users            — paginated user list (search by username/email/publicId, role filter)
POST   /users            — create user
PUT    /users/:id        — update user (role, ban/unban)
DELETE /users/:id        — delete user
POST   /users/:id/timeout   — timeout user (durationMinutes 1–43200, reason)
DELETE /users/:id/timeout   — remove timeout
GET    /posts            — paginated posts (showHidden, search)
PUT    /posts/:id/hide   — hide/restore post
PUT    /posts/:id/archive   — archive/unarchive post
DELETE /posts/:id/hard   — permanently delete post + comments + votes
POST   /undo             — execute undo token (10-second window)
GET    /logs             — paginated logs (category, level, search)
GET    /faq              — all FAQ categories with _ids
POST   /faq              — create category
DELETE /faq/:categoryId  — delete category
POST   /faq/:categoryId/questions     — add question to category
PUT    /faq/:categoryId/questions/:questionId  — edit question
DELETE /faq/:categoryId/questions/:questionId  — delete question
GET    /members          — paginated member list with online status (search, status filter)
GET    /members/online   — online member list
```

### Notifications  (`/api/notifications` — verifyToken required)
```
GET    /                 — last 30 + unread count
PUT    /read-all         — mark all read
PUT    /:id/read         — mark one read
```

### Users  (`/api/users`)
```
GET    /search?q=        — prefix search for @mention autocomplete (verifyToken, 30/min limit)
```

### Upload  (`/api/upload`)
```
POST   /image            — upload image (verifyToken + checkTimeout + 10/min limit)
                           validates MIME from buffer bytes (file-type@14), UUID filename
                           max 5 MB, allows: jpeg/png/gif/webp
                           returns: { url: '/uploads/<uuid>.<ext>' }
```

### Chatbot  (`/api/chatbot`)
```
POST   /chat             — Yaksha AI chat (verifyToken? + chatbotLimiter 20/10min)
```

---

## 8. Rate Limits

| Limiter              | Window    | Max  | Applied to                                |
|----------------------|-----------|------|-------------------------------------------|
| globalLimiter        | 15 min    | 200  | (applied globally in server.js if wired)  |
| authLimiter          | 15 min    | 10   | /api/auth/login, /register                |
| postCreationLimiter  | 60 min    | 15   | POST /forum/posts                         |
| commentLimiter       | 10 min    | 30   | POST /forum/posts/:id/comments            |
| chatbotLimiter       | 10 min    | 20   | POST /chatbot/chat                        |
| duplicateCheckLimiter| 1 min     | 10   | POST /forum/posts/check-duplicate         |
| mentionSearchLimiter | 1 min     | 30   | GET /users/search                         |
| uploadLimiter        | 1 min     | 10   | POST /upload/image                        |
| searchLimiter        | 1 min     | 60   | GET /forum/search                         |

---

## 9. Security Architecture

**Never trust the frontend.** All enforcement is server-side.

- **JWT in httpOnly cookies** — inaccessible to JavaScript, XSS-resistant
- **CSRF double-submit** — `csrf_token` cookie (readable) must match `X-CSRF-Token` header on all mutations
- **Helmet** — sets Content-Security-Policy, X-Frame-Options, etc.
- **CORS** — strict origin whitelist from `FRONTEND_URL` env var
- **express-mongo-sanitize** — strips MongoDB operators (`$`, `.`) from inputs, prevents NoSQL injection
- **HPP** — prevents HTTP parameter pollution
- **bcrypt 12 rounds** — password hashing
- **Account locking** — 5 failed logins → 15-min lockout, tracked in DB
- **checkTimeout middleware** — applied to ALL write endpoints; returns 403 with `code: TIMEOUT_ACTIVE`, `remainingSeconds`. Frontend UI is secondary.
- **Opaque publicId** — all member-facing APIs return `publicId` (6-digit integer string) not MongoDB `_id`
- **ReDoS protection** — all regex-based DB searches escape user input: `s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` — applied in forum search, admin user/post search, mention search
- **No MongoDB text index dependency** — all full-text search uses `$or: [{ title: regex }, { description: regex }]` — works without index, handles all search endpoints (`getPosts`, `searchForum`, admin `getPosts`)
- **Image MIME validation** — `file-type@14` reads actual buffer bytes, not the `Content-Type` header
- **UUID filenames** — uploaded images get UUID names, original filenames never stored
- **Admin auth on every request** — `verifyToken + requireAdmin` on all `/api/admin/*` routes; never trust frontend role checks
- **UndoToken bound to admin** — undo token validates `adminId === req.user._id`; another admin cannot use it
- **Logs are append-only** — no DELETE or UPDATE endpoint for Log collection; auto-expire after 90 days via TTL

---

## 10. Socket.io System

**Server side (`backend/server.js` + `utils/socketServer.js`):**
- HTTP server shared between Express and Socket.io
- CORS origin from `FRONTEND_URL` env var with `credentials: true`
- Auth middleware: reads `access_token` from `cookie` header via regex `/access_token=([^;]+)/`, verifies JWT, rejects banned users
- On connect: `onlineUsers.set(socket.userId, socket.id)` and socket joins room `user:<userId>`
- On disconnect: `onlineUsers.delete(socket.userId)`
- Singleton exported from `socketServer.js`: `{ setIo, getIo, onlineUsers, emitToUser }`

**Client side (`frontend/src/context/SocketContext.jsx`):**
- Connects when `user` is set (after login), disconnects on logout
- `withCredentials: true` — browser sends httpOnly `access_token` cookie automatically
- Reconnection: 5 attempts, 2s delay
- Exports `useSocket()` returning `{ socket, connected }`

**Emitting to a user:**
```js
emitToUser(userId, 'notification', { ...notificationData });
```
Socket client listens: `socket.on('notification', handler)` in `NotificationBell.jsx`.

---

## 11. Notification System

**Triggers:**
- `reply` — when someone replies to a comment (notifies parent comment author)
- `mention` — when @username appears in a comment (notifies mentioned user)
- `admin_message` — when admin times out a user (notifies the targeted user)

**Non-fatal:** `createNotification()` wraps all logic in try/catch and never throws — a notification failure never blocks the main API response.

**Self-notification prevention:** if `recipient === actor`, the notification is silently dropped.

**Real-time delivery:** after DB insert, `emitToUser()` pushes via Socket.io to the recipient's room.

**Frontend (`NotificationBell.jsx`):**
- Fetches last 30 + unread count on mount via `GET /api/notifications`
- Listens to `socket.on('notification', ...)` for instant updates
- Red badge on bell icon shows unread count
- Dropdown with type-specific icons: reply (MessageSquare), mention (AtSign/@), admin_message (Shield)
- Click navigates to `/forum/<postId>` and marks as read
- Mark all read button

---

## 12. CSS & Theming

**Approach:** CSS custom variables in `:root` (light) and `.dark` class (dark). **Never use Tailwind's `dark:` prefix.**

**Key variables:**
```css
/* backgrounds */
--bg-base       --bg-primary    --bg-secondary    --bg-tertiary    --bg-card

/* borders */
--border        --border-subtle

/* text */
--text-primary  --text-secondary  --text-muted

/* accent (indigo) */
--accent        --accent-hover    --accent-light   --accent-dark

/* semantic */
--success       --warning         --danger

/* glass */
--glass-blur    --glass-border    --glass-specular
--btn-secondary-bg    --btn-secondary-hover-bg
--btn-ghost-hover-bg  --input-bg    --input-focus-bg

/* shadows (include inner specular) */
--shadow        --shadow-md       --shadow-lg
```

**Dark mode values:** pure black base (`--bg-base: #000000`, `--bg-primary: #0a0a0a`), neutral grey borders/text — no blue/indigo tint. Body gradient blobs are very subtle (opacity ≤ 0.05).

**Glass UI:** Body has a fixed `radial-gradient` background (4 blobs: indigo, purple, green, indigo). Cards use `backdrop-filter: blur(24px) saturate(160%)` with semi-transparent backgrounds. `.card`, `.btn-secondary`, `.btn-ghost`, `.input` all use glass variables.

**Stacking context hazard:** `backdrop-filter` on an element creates a new CSS stacking context. Any absolutely-positioned child dropdown cannot escape above a sibling element that also has `backdrop-filter`, regardless of z-index. **Fix: use `createPortal` + `position: fixed` + `getBoundingClientRect()`** for dropdowns that must float above sibling cards. See `PostCard.jsx`.

**Component classes** (defined in `index.css` `@layer components`):
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`
- `.card`
- `.input`, `.textarea`
- `.tag`, `.badge`
- `.page-container`
- `.vote-btn`
- `.scrollbar-thin`
- `.accent-text`

**Semantic inline colors** (used directly in JSX for status colors):
- Danger/red: `rgba(239,68,68,...)` or `rgb(239,68,68)`
- Success/green: `rgba(34,197,94,...)` or `rgb(34,197,94)`
- Warning/yellow: `rgba(234,179,8,...)` or `rgb(234,179,8)`
- Purple/mention: `rgba(168,85,247,...)` or `rgb(168,85,247)`
- Indigo/accent: `rgba(99,102,241,...)`

**Fonts:**
- Body: Montserrat (system fallback: system-ui, sans-serif)
- Headings (`h1`–`h6`): Space Grotesk, then Montserrat fallback
- Both loaded from Google Fonts in `index.html`

**Animations:** `.collapse-content.open/closed`, `.skeleton` shimmer, `animate-slide-down`

---

## 13. @Mentions System

**Backend (`utils/parseMentions.js`):**
- Regex: `/@([a-zA-Z0-9_]{3,30})/g`
- Max 10 unique mentions per comment
- Case-insensitive exact match against DB
- Returns: `[{ userId, username, publicId }]`
- Saved to `Comment.mentions` array

**Frontend (`CommentThread.jsx`):**
- `MentionInput` component: detects `@` prefix while typing, sends debounced request to `GET /api/users/search?q=`
- Autocomplete dropdown uses `onMouseDown` (not `onClick`) to prevent textarea blur before selection
- **Discord-style dropdown:** "Members" header label, 36px avatar circle, two lines per entry (bold username + `#publicId` in muted text), accent-left-border + accent-light background on selected row, glass panel background (`backdrop-filter`)
- `MentionHighlight` component: splits comment content on `/@[a-zA-Z0-9_]{3,30}/g`, renders matches as purple highlighted spans

---

## 14. Comment Tree (N-level)

**Backend (`forumController.getComments`):**
- Single query: `Comment.find({ post, isHidden: false }).sort({ voteScore: -1, createdAt: 1 })`
- Build tree O(n) using a Map: `map[id] = { ...comment, replies: [] }`
- Root comments: `c.parent === null`; child comments: `map[c.parent].replies.push(map[c._id])`
- No recursive DB calls (avoids N+1 problem)

**Frontend (`CommentThread.jsx`):**
- `MAX_DEPTH = 8` — comments indent up to depth 8
- Indent: `Math.min(depth * 16, 64)px` left margin + 12px padding + left border
- Collapse toggle on root comments (depth 0)
- `TIMEOUT_ACTIVE` error code → human-readable "X minutes" message

**Frontend (`PostDetail.jsx`):**
- `addReplyToTree(comments, parentId, newReply)` — recursive tree update helper
- `handleReply` wrapped in `useCallback`
- `TimeoutBanner` component: live countdown via `setInterval`

---

## 15. Image Upload

**Backend (`routes/upload.js`):**
- `multer({ storage: memoryStorage(), limits: { fileSize: 5MB } })`
- Pre-filter: rejects non-image Content-Type headers (secondary guard only)
- Real validation: `FileType.fromBuffer(req.file.buffer)` — reads actual file bytes
- Allowed MIME: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Saves to `backend/uploads/<uuid>.<ext>` with UUID filename
- Returns `{ url: '/uploads/<uuid>.<ext>' }`
- Rate limit: 10 uploads/minute per user
- `checkTimeout` applied — timed-out users cannot upload

**Frontend (`CreatePost.jsx`):**
- Drag/drop zone with `onDrop` handler
- Clipboard paste with `onPaste` → checks `clipboardData.items` for image files
- Shows preview thumbnail after successful upload
- Dev URL construction: `window.location.origin.replace(':5173', ':5000') + res.data.url`

**Known gap:** EXIF/metadata stripping not implemented (requires `sharp` package).
**Known dev gap:** Vite proxy does NOT include `/uploads` — images 404 in dev from the Vite origin.

---

## 16. Admin Member Panel

**`MemberPanel.jsx`** — Discord-style right sidebar, admin-only, visible at `xl:` breakpoint.

- Fixed position: `right-0, top-16, bottom-0`, width 240px, `z-index: 30`
- Member list: avatar initials, green dot for online status, Shield icon for admin role, ban/timeout badges
- Click opens inline moderation row: timeout button (opens TimeoutDialog), remove timeout, ban/unban
- Debounced search (300ms) → `GET /api/admin/members?search=`
- Pagination: load-more button

**`UndoToast` component** (inside MemberPanel):
- 10-second countdown bar
- Undo button calls `POST /api/admin/undo` with token

**`TimeoutDialog` component**:
- Duration presets: 5m, 15m, 1h, 6h, 1d
- Custom input field for arbitrary minutes
- Reason text field

**`ForumPage.jsx`** renders MemberPanel:
```jsx
{user?.role === 'admin' && (
  <div className="hidden xl:flex fixed right-0 top-16 bottom-0" style={{ zIndex: 30 }}>
    <MemberPanel />
  </div>
)}
```

---

## 17. FAQ Admin Management

**Backend:**
- FAQ data stored in MongoDB (`FAQ` model), not a static file
- Seeded from `faq.json` on first run if DB is empty
- Public: `GET /api/faq` → sorted by `order`, then `createdAt`
- Admin CRUD via `/api/admin/faq` routes (all require verifyToken + requireAdmin)
- Each mutation is logged to the Log collection

**Frontend (`FAQManagement.jsx`):**
- Accordion list of categories
- Per-category: question count, "+ Add Question" button, delete category button
- Per-question: edit (inline modal) and delete buttons
- Modal forms: CategoryModal (name input), QuestionModal (question + answer textarea)
- `window.confirm` before delete operations

**Admin panel integration:**
- `AdminPage.jsx` has tab: `{ id: 'faq', label: 'FAQ', icon: BookOpen }`
- Rendered as: `{activeTab === 'faq' && <FAQManagement />}`

---

## 18. UndoToken System

1. Admin performs reversible action (hide post, archive post, timeout user)
2. Server saves document snapshot → creates `UndoToken` (UUID, 10-sec TTL, adminId, targetType, targetId, snapshot)
3. Token returned in API response to frontend
4. Frontend shows `UndoBanner` with countdown timer
5. Within 10 seconds: `POST /api/admin/undo { token }` → validates token (not used, not expired, same admin), restores snapshot to DB, marks token used
6. MongoDB TTL auto-deletes expired tokens

**Actions that support undo:**
- `unhide_post` — restore post.isHidden + hiddenBy/hiddenAt/hideReason
- `unarchive_post` — restore post.isArchived + archivedBy/archivedAt/archiveReason
- `remove_timeout` — restore user.timeoutUntil/timeoutBy/timeoutReason

---

## 19. Coding Patterns & Rules

**Security rules (never violate):**
- Backend verifies admin role on EVERY admin request — never trust frontend role checks
- `checkTimeout` applied to ALL write endpoints (forum + upload)
- Never expose MongoDB `_id` in member-facing APIs — use `publicId`
- Escape regex input before using in MongoDB regex queries

**Theming rules:**
- Always use `var(--css-variable)` or inline `rgba()` for colors
- NEVER use Tailwind `dark:` prefix — it won't work (ThemeContext adds `.dark` class to `<html>`)
- Semantic inline rgba values: danger=239,68,68  success=34,197,94  warning=234,179,8  purple=168,85,247

**API client:**
- Always use `api.js` (Axios instance) for all API calls — handles CSRF header injection + auto token refresh
- For upload, use `FormData` with `api.post()` and let Axios set `Content-Type: multipart/form-data`

**Comment code:** Default to no comments. Only add when the WHY is non-obvious.

**Error handling:** `TIMEOUT_ACTIVE` error code → show remaining time in minutes. `TOKEN_EXPIRED` → auto-refresh (handled by interceptor).

---

## 20. Features Implemented

- [x] Full JWT auth with httpOnly cookies, CSRF, refresh token rotation, account locking
- [x] FAQ page: search, tag filter, collapsible items, Yaksha AI chatbot
- [x] FAQ data in MongoDB — admin CRUD via Admin Panel
- [x] Forum: post list, post detail, create post, vote, tags
- [x] AI duplicate detection via OpenRouter before posting
- [x] N-level threaded comments with recursive tree build
- [x] @mention autocomplete in comment input, mention highlighting, mention notifications
- [x] Image upload: drag/drop + paste, MIME validation from bytes, UUID filenames
- [x] Notification system: reply/mention/admin_message types, real-time via Socket.io
- [x] Notification bell with unread count badge in navbar
- [x] Socket.io with JWT auth on handshake, online user tracking
- [x] Admin panel: Dashboard stats, User management (CRUD + ban/unban)
- [x] Admin post moderation: hide/restore, archive, hard delete
- [x] Admin FAQ management: add/edit/delete categories and questions
- [x] Admin log viewer: paginated, filterable by category/level/search
- [x] UndoToken system: 10-second undo for hide/archive/timeout actions
- [x] User timeout: admin sets duration 1–43200 minutes; notifies user via notification
- [x] checkTimeout middleware on ALL write endpoints (server-side only)
- [x] Opaque publicId on all users
- [x] ReDoS protection on admin search and mention search
- [x] Discord-style admin member panel in Forum (xl breakpoint)
- [x] Discord-style forum post search: full-text + from/tag/has/before/after filters, glass UI, Ctrl+K trigger (no macOS-specific elements)
- [x] Log schema v2: targetSnapshot, request context, durationMs, severity, sanitized body/query, extended user fields
- [x] LogViewer v2: 11 columns (Sev, Target, Path, Status, Duration), Severity + TargetType filter dropdowns
- [x] Light/dark theme (CSS variables, no Tailwind dark:)
- [x] Liquid glass UI: backdrop-filter cards/buttons/inputs, fixed radial gradient body, glass navbar
- [x] Dark mode: pure black (`#000000` base), neutral grey tones — no dark blue tint
- [x] Space Grotesk for headings, Montserrat for body
- [x] PostCard three-dot menu via `createPortal` + `position: fixed` — escapes backdrop-filter stacking context
- [x] Discord-style @mention dropdown: Members header, 36px avatar, username + #publicId
- [x] publicId is a 6-digit integer string (e.g. `482931`)
- [x] Admin user search includes publicId field
- [x] Forum search uses `$or` regex — no MongoDB text index required
- [x] Navbar with live clock and timezone
- [x] Mobile responsive nav

---

## 21. Known Issues & Incomplete Work

- **Vite proxy missing `/uploads`** — images uploaded via the API will 404 when viewed from Vite's origin. Add to `vite.config.js`:
  ```js
  '/uploads': { target: 'http://localhost:5000', changeOrigin: true }
  ```

- **EXIF/metadata stripping** — uploaded images are not stripped of EXIF data. Requires `sharp`. Buffer is available before write so the integration point is ready.

- **Post.imageUrl validation** — Post model validates `imageUrl` must match `https?://...` but uploaded images return `/uploads/<uuid>.<ext>` (relative URL). A post created with an uploaded image would fail this validator if `imageUrl` is set directly to the relative path. The upload flow in `CreatePost.jsx` uses absolute URL construction as a workaround.

---

## 22. Key Decisions

| Decision | Reason |
|----------|--------|
| JWT in httpOnly cookies | XSS-resistant; localStorage is trivially readable by injected scripts |
| CSRF double-submit | SPA mutation protection without server-side session store |
| N-level comments as flat DB + Map tree | Single query, O(n) tree build, avoids N+1 DB calls |
| UndoToken 10-second TTL via MongoDB TTL index | Self-cleaning; never needs manual cleanup |
| file-type@14 (not v20+) | v20 is ESM-only; backend is CommonJS; @14 is the last CJS-compatible version |
| publicId 6-digit integer | Human-readable, easier for admins to search/compare; still opaque enough; collision-safe via loop |
| $or regex search instead of $text | MongoDB `$text` requires a text index that may not exist on all deployments; regex works without any index and is simpler to reason about |
| createPortal for PostCard dropdown | `backdrop-filter` on `.card` creates a CSS stacking context — z-index values inside it cannot escape above sibling cards with their own stacking context. Portal + `position: fixed` + `getBoundingClientRect()` is the only reliable fix |
| overflow: visible on SearchModal panel | Panel had `overflow: hidden` which clipped the filter dropdown regardless of z-index; removing it allows the FilterDropdown to render visibly below the filter row |
| onMouseDown for mention autocomplete | onClick causes textarea blur before click registers → dropdown closes too early |
| Non-fatal createNotification() | Notification failure should never block comment creation |
| Socket.io reads cookie from handshake header | access_token is httpOnly — JS cannot read it, but browser sends it automatically with withCredentials: true |
| FAQ in MongoDB | Allows admin to manage content without code deploys |
| checkTimeout server-side only | Frontend timeout UI is cosmetic — attacker can bypass disabled buttons via Postman/cURL |

---

## 23. Maintenance Rules

**Any agent or person working on this project must update CONTEXT.md when they:**
- Fix a bug → describe the fix
- Add a feature → add to Section 20
- Break something → add to Section 21
- Make an architectural decision → add to Section 22
- Change routes → update Section 7
- Change env vars → update Section 4
