# VINS Community Platform

A full-stack community platform for the **Vicharanashala Internship (VINS)** programme at IIT Ropar. Built on the MERN stack with real-time features, AI integrations, and a liquid glass UI.

---

## Tech Stack

- **Backend:** Node.js + Express 5, port 5000
- **Frontend:** React 18 + Vite + Tailwind CSS, port 5173
- **Database:** MongoDB Atlas
- **AI:** OpenRouter API (Yaksha chatbot, duplicate detection, sentiment analysis, search clustering)
- **Realtime:** Socket.io 4 (JWT-authenticated)
- **Auth:** JWT in httpOnly cookies + refresh token rotation + CSRF double-submit

---

## Getting Started

```bash
# One-time: seed admin user + FAQ data
cd backend && npm run seed

# Terminal 1 — Backend
cd backend && npm run dev     # http://localhost:5000

# Terminal 2 — Frontend
cd frontend && npm run dev    # http://localhost:5173
```

Default admin credentials (after seeding):
```
Email:    admin@vins.in
Password: Admin@123456
```

---

## Environment Variables

`backend/.env`:
```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>
JWT_SECRET=<long random string>
JWT_REFRESH_SECRET=<different long random string>
FRONTEND_URL=http://localhost:5173
OPENROUTER_API_KEY=sk-or-...
```

---

## Features

### FAQ Page

The FAQ page is the primary knowledge base for VINS interns.

- **Search** — live full-text search across all questions and answers; results update as you type
- **Category filter** — sticky left sidebar lists all FAQ categories; clicking one filters to that category only; multi-select is supported
- **Collapsible Q&A** — each question expands in place to reveal its answer; animated open/close transition
- **Result count** — shows how many answers match the current search/filter combination
- **Dead-end logging** — when a logged-in user searches and gets zero results, the query is silently recorded after 800 ms for admin analysis (see Search Gap Tracker)
- **Yaksha AI Chatbot** — floating chat bubble in the bottom-right corner; see the Chatbot section below

---

### Yaksha AI Chatbot

A floating chat assistant available on the FAQ page, powered by OpenRouter.

- **Persistent chat window** — opens as a 360×480 px card anchored to the bottom-right; can be minimised without losing message history
- **Context-aware** — sends the last 10 messages as history with every request so Yaksha can follow a multi-turn conversation
- **Specialised persona** — the system prompt scopes Yaksha to VINS internship topics only
- **Rate limited** — 20 requests per 10 minutes per user to prevent abuse
- **Error resilience** — network or API errors surface as an inline assistant message rather than crashing the UI

---

### Community Forum

The main discussion space for interns to post questions, share updates, and help each other.

**Post list:**
- Paginated list of posts sorted by newest or top-voted
- Each post card shows title, description excerpt, author, tag pills, vote score, and comment count
- Three-dot context menu on each card (uses `createPortal` to escape CSS stacking-context constraints from backdrop-filter cards)
- Tags drawn from 18 predefined categories: About VINS, Timing & Dates, NOC, Certificate, Rosetta, Phase 1 & ViBe, Yaksha Chat, and more

**Creating a post:**
- Title (5–200 chars), description (10–5000 chars), up to 5 tags
- **Image upload** — drag and drop a file onto the upload zone, or paste from clipboard; supported formats: JPEG, PNG, GIF, WebP; max 5 MB; MIME type validated from actual file bytes (not Content-Type header); stored with a UUID filename
- **AI duplicate detection** — before submitting, the form optionally checks the draft against existing posts using OpenRouter; if a likely duplicate is found, a warning is shown with a link to the existing post
- **Profanity filter** — post content is screened with the `bad-words` library on the backend before saving
- Timed-out users cannot post; the server enforces this independently of any frontend state

**Post detail:**
- Full post body with image
- Vote buttons (upvote/downvote); user's existing vote is pre-highlighted
- Comment submission form at the bottom

---

### Forum Search

A keyboard-first, Discord-style search modal accessible from anywhere in the forum.

- **Trigger** — `Ctrl+K` opens the search modal; `Escape` closes it
- **Instant results** — debounced search fires 80 ms after the last keystroke; results animate in staggered
- **Keyword highlighting** — matching text in titles and descriptions is highlighted inline in the results list
- **Filter pills** — five composable filters appear as clickable chips below the search bar:
  - **From User** — type a username prefix to filter posts by author; shows a live autocomplete dropdown with avatar initials
  - **Tag** — pick from all 18 post tags via a scrollable dropdown
  - **Has** — filter posts that have an image, have comments, or have votes
  - **Before / After** — date pickers to constrain the creation date range
- **Active filter chips** — applied filters render as dismissible chips with an animated enter/exit transition
- **Dead-end tracking** — if search yields zero results and the user does not correct the query within 800 ms, the query is logged as a `zero_results` dead-end; if results exist but the user clicks nothing for 15 seconds, it logs a `no_click` dead-end; both feed into the Search Gap Tracker

---

### Threaded Comments

N-level nested comment threads on every post.

- **Unlimited nesting** — comments can be nested up to depth 8; beyond that, replies are appended at depth 8
- **Indentation** — each level is indented by 16 px (capped at 64 px) with a left-border accent line
- **Sorting** — comments are sorted by vote score descending, then by creation time ascending, so the most helpful replies surface first
- **Collapsing** — root-level comment threads can be collapsed/expanded with a toggle button
- **Voting** — each comment has independent upvote/downvote buttons; score updates in real time
- **Reply composer** — clicking "Reply" on any comment opens an inline textarea below that comment
- **Timeout feedback** — if a user is timed out, submitting a comment returns a friendly message showing how many minutes remain

---

### @Mentions

Discord-style @mention system in comment input fields.

- **Trigger** — type `@` followed by at least one character to open the autocomplete dropdown
- **Autocomplete** — debounced search queries the user search endpoint; results appear in a glass-panel dropdown with:
  - A "Members" header label
  - 36 px avatar circle showing the user's initial
  - Bold username on the first line
  - `#publicId` (6-digit ID) in muted text on the second line
  - Accent left-border and tinted background on the hovered row
- **Selection** — uses `onMouseDown` (not `onClick`) so the textarea does not blur before the selection registers
- **Stored mentions** — up to 10 unique mentions per comment are resolved server-side (case-insensitive) and saved to the comment record
- **Highlight rendering** — when viewing a comment, all `@username` tokens are rendered as purple highlighted spans
- **Notifications** — each mentioned user receives an instant notification

---

### Real-time Notifications

Push notifications delivered via Socket.io without any page refresh.

- **Notification types:**
  - `reply` — fired when someone replies to your comment
  - `mention` — fired when your `@username` appears in a new comment
  - `admin_message` — fired when an admin applies a timeout to your account
- **Bell icon** — in the navbar; shows a red unread-count badge when there are unread notifications
- **Dropdown** — clicking the bell opens a list of the last 30 notifications; each entry shows a type-specific icon (chat bubble for reply, @ sign for mention, shield for admin), the actor's username, a relative timestamp, and the post title
- **Click-to-navigate** — clicking a notification navigates to the relevant post and marks the notification read
- **Mark all read** — single button to clear the badge
- **Self-notification prevention** — notifications are never sent to the actor themselves
- **Auto-expiry** — notifications are automatically deleted from the database after 30 days via a MongoDB TTL index
- **Non-fatal** — a failure to create or emit a notification never blocks the underlying action (comment creation, timeout application)

---

### Admin Panel

A protected seven-tab control panel accessible only to admin accounts.

#### Dashboard
- Summary stat cards: total users, total posts, total comments, daily registrations, daily posts, hidden posts, banned users, online users
- Top contributing users
- Recent activity feed
- Posts-over-time chart

#### User Management
- Paginated, searchable user list (search by username, email, or 6-digit publicId)
- Role filter (user / admin)
- **Create user** — add a new account with a specified role
- **Edit user** — change role or ban/unban with a reason
- **Delete user** — permanently removes the account
- **Timeout** — set a timed posting restriction (1 min to 30 days) with a reason; the targeted user receives an `admin_message` notification; supports a 10-second undo window

#### Post Moderation
- Paginated list of all posts including hidden ones
- **Hide/restore** — soft-hides a post from public view (records who hid it and when); 10-second undo supported
- **Archive/unarchive** — marks a post as archived; 10-second undo supported
- **Hard delete** — permanently removes the post along with all its comments and votes; no undo
- Search by title or content

#### FAQ Management
- Full CRUD for FAQ categories and individual Q&A items
- **Add category** — creates a new top-level FAQ section
- **Add question** — appends a question + answer under any category
- **Edit question** — inline modal with question and answer textarea fields
- **Delete** — confirmation dialog before removal; every mutation is logged to the audit log
- Changes are reflected on the public FAQ page immediately

#### Log Viewer
- Paginated audit log of all significant platform events
- 11-column table: Severity, Timestamp, Category, Action, User, Target, Target Type, Path, Status Code, Duration, IP
- Filter by category (auth, post, comment, vote, admin, system, security) and severity level
- Text search across action and user fields
- Logs are append-only; no delete or update endpoints exist; auto-expire after 90 days

#### Search Gap Tracker

Surfaces failed searches to help admins identify gaps in FAQ and forum content.

- **Summary cards:** dead-end searches this week, distinct clusters, unresolved clusters, resolved this month
- **Dead-end sources** — queries are collected from two places: the FAQ page (zero-result text searches) and the Forum Search modal (zero-result searches and no-click outcomes); both log a normalised query along with a session ID for deduplication
- **AI clustering** — a "Run Clustering" button sends up to 100 unprocessed dead-end queries to Claude 3 Haiku via OpenRouter; the model groups them into human-readable topic clusters (e.g. "Certificate download process", "Phase 1 timeline"); clusters are created or updated automatically with query counts and trend indicators
- **Cluster cards** — each cluster shows its label, total query count, first/last seen timestamps, and a trend indicator (↑ trending up, → stable, ↓ trending down)
- **Sample queries** — up to 3 example queries shown per cluster; expandable to show all
- **Status management** — per-cluster status can be set to Unresolved, In Progress, or Resolved via a dropdown; persisted immediately
- **Filter bar** — filter clusters by status
- **Pagination** — 20 clusters per page

#### Sentiment Pulse

Tracks the emotional health of the community over time using AI-powered sentiment scoring.

- **Score display** — a 0–100 score computed as a recency-weighted average of sentiment scores on posts in the selected time window; colour-coded from green (Thriving, ≥80) → teal (Good) → grey (Neutral) → amber (Stressed) → red (Distressed, <20); accompanied by an emoji label
- **Time windows** — 5 min, 15 min, 1 h, 6 h, 24 h, 3 d, 7 d, 30 d; switching windows re-fetches instantly
- **Emotion breakdown** — a stacked horizontal bar showing the percentage split across five labels: positive, neutral, negative, anxious, frustrated; each segment is colour-coded with a legend below
- **Trend sparkline** — a mini bar chart visualising how the score has moved across the selected window
- **Run Analysis** — triggers background AI sentiment analysis on any posts or comments not yet scored; auto-refreshes after 10 seconds
- **Alerts section** — lists sentiment events triggered by the alert evaluator:
  - `sentiment_drop` fires when the current window score drops by the configured threshold compared to the previous window
  - `sentiment_spike` fires when a 3-day sub-window score exceeds 85
  - Duplicate alerts within 48 hours are suppressed
  - Unacknowledged alerts are highlighted in red with an Acknowledge button
  - Acknowledged alerts show the admin's username and optional note

---

### Discord-style Member Panel

An admin-only sidebar on the Forum page, visible at the `xl` breakpoint (≥1280 px wide).

- Fixed to the right edge of the viewport, 240 px wide, positioned below the navbar
- **Member list** — shows all users with avatar initials; green dot for currently online users; shield icon for admins; ban/timeout badges where applicable
- **Search** — debounced 300 ms search across usernames
- **Pagination** — load-more button to fetch additional pages
- **Inline moderation row** — clicking a member reveals quick-action buttons:
  - **Timeout** — opens `TimeoutDialog` with presets (5 m, 15 m, 1 h, 6 h, 1 d) and a custom minutes field plus a reason field
  - **Remove timeout** — one-click lift of an active timeout
  - **Ban / Unban** — toggles the user's banned status
- **Undo toast** — after a timeout or ban, a 10-second countdown toast with an Undo button appears

---

### UndoToken System

A short-window undo mechanism for reversible admin actions.

- When an admin hides a post, archives a post, or times out a user, the server snapshots the affected document fields and creates an `UndoToken` (UUID, 10-second TTL)
- The token is returned in the API response; the frontend displays a countdown banner
- Within 10 seconds, clicking Undo calls `POST /api/admin/undo`; the server validates the token (unused, not expired, same admin), restores the snapshot, and marks the token used
- MongoDB TTL index auto-deletes expired tokens — no manual cleanup needed
- Tokens are bound to the issuing admin; another admin cannot use them

---

### Sentiment Analysis (Background Job)

Every post and comment can be analysed for emotional tone.

- Uses **Claude 3 Haiku** via OpenRouter with a tight JSON-only system prompt
- Returns a `score` (−1.0 to +1.0) and a `label` (positive / neutral / negative / anxious / frustrated)
- Stored as a `sentiment` subdocument on each Post and Comment
- Short question-only texts (under 10 words ending in `?`) are skipped to reduce noise
- On API failure, marks the document `pending`, waits 5 seconds, and retries once before giving up with `unanalyzed`
- Recency-weighted averaging gives more recent posts a higher influence on the overall score

---

### Navbar

- **Live clock** — displays current time (HH:MM:SS), date, and the user's detected timezone; updates every second
- **Navigation links** — FAQ, Forum, and Admin (admin-only); active link is highlighted
- **Theme toggle** — sun/moon icon switches between light and dark mode
- **Notification bell** — visible when logged in; shows unread count badge
- **User pill** — shows avatar initial, username, and Admin badge if applicable
- **Mobile menu** — hamburger button collapses the nav into a slide-down drawer on small screens

---

### Light/Dark Theme

- CSS custom property–based theming; `.dark` class toggled on `<html>` by `ThemeContext`
- **Light mode** — white/off-white backgrounds with subtle indigo accents
- **Dark mode** — pure black base (`#000000`), very dark primary (`#0a0a0a`), neutral grey borders and text with no blue tint
- **Liquid glass UI** — fixed four-blob radial gradient backdrop (indigo, purple, green, indigo) on the body; cards, buttons, and inputs use `backdrop-filter: blur(24px) saturate(160%)` with semi-transparent backgrounds
- **Fonts** — Space Grotesk for headings (h1–h6), Montserrat for body text; both loaded from Google Fonts

---

### Footer

- Brand section with links to samagama.in and vicharanashala.ai
- Platform navigation links
- **Legal modals** — Privacy Policy, Terms of Service, and Community Guidelines open as in-page overlay modals without navigating away

---

## Authentication (Brief Overview)

- JWT access token (15 min) and refresh token (7 days) stored in httpOnly cookies
- CSRF double-submit pattern for all mutating requests
- 5 failed login attempts trigger a 15-minute account lock
- Axios interceptor handles silent token refresh on 401

---

## Rate Limits

| Endpoint | Window | Max |
|---|---|---|
| Login / Register | 15 min | 10 |
| Create post | 60 min | 15 |
| Create comment | 10 min | 30 |
| Chatbot | 10 min | 20 |
| Duplicate check | 1 min | 10 |
| User mention search | 1 min | 30 |
| Image upload | 1 min | 10 |
| Forum search | 1 min | 60 |

---

## Known Limitations

- Vite dev server does not proxy `/uploads` — uploaded images will 404 when viewed from `localhost:5173` in development. Open them directly at `http://localhost:5000/uploads/<filename>`, or add `/uploads` to the Vite proxy config.
- EXIF/metadata stripping is not implemented for uploaded images (would require `sharp`).
