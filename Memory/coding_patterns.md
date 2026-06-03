---
name: vins-coding-patterns
description: "Validated coding patterns for the VINS platform — API client, UX edge cases, non-fatal side effects"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2c01f4c2-63f4-4e14-afd3-cc34a9f69678
---

**Pattern 1 — Always use `api.js` for all HTTP requests.**
`frontend/src/utils/api.js` is an Axios instance that automatically:
- Reads `csrf_token` cookie and injects `X-CSRF-Token` header on POST/PUT/PATCH/DELETE
- Auto-refreshes access_token on 401 TOKEN_EXPIRED (queues concurrent requests, retries once)
Never use raw `fetch` or `axios` directly.

**Pattern 2 — Use `onMouseDown` (not `onClick`) for autocomplete dropdowns.**
If a dropdown suggests options and the user clicks one while a textarea is focused, `onClick` fires AFTER blur, causing the dropdown to close before the selection registers. Use `onMouseDown` to prevent this.
Applies to: @mention autocomplete in CommentThread.jsx.

**Pattern 3 — Non-fatal side effects.**
`createNotification()` wraps all logic in try/catch and never throws. Notification failure must not block the main API response. Any other side effect (logging, analytics) should follow the same pattern.

**Pattern 4 — Escape regex before MongoDB regex queries.**
```js
const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const regex = new RegExp(escaped, 'i');
```
Always escape user input before using it in `$regex`. Applies everywhere: admin search, mention search.

**Pattern 5 — N-level comment tree via flat fetch + Map.**
Never do recursive DB queries for comment trees (N+1 problem). Fetch all comments in one query, build tree O(n) using a Map. See `forumController.getComments`.

**Pattern 6 — Upload URL construction in dev.**
Uploaded images return `/uploads/<uuid>.ext` from the backend. In dev, Vite runs on :5173 and backend on :5000. Construct absolute URL as:
```js
window.location.origin.replace(':5173', ':5000') + res.data.url
```
In production where they share an origin, the replace is a no-op.

**Pattern 7 — TIMEOUT_ACTIVE error handling.**
When a user is timed out, write endpoints return:
```json
{ "error": "...", "code": "TIMEOUT_ACTIVE", "timeoutUntil": "...", "remainingSeconds": 123 }
```
Frontend should catch this and show human-readable remaining time in minutes, not a raw error.

**Pattern 8 — Socket.io connects on login, disconnects on logout.**
`SocketContext.jsx` watches `user?._id` in a `useEffect`. When user becomes null (logout), the socket is disconnected and ref is cleared. When user is set (login), a new connection is made with `withCredentials: true`.

**Why:** These patterns were validated during implementation. Deviating from them caused real bugs (mention autocomplete losing focus, notification failure blocking comments, ReDoS potential in search).

**How to apply:** Check these patterns before implementing any new feature involving search, dropdowns, side effects, or uploads.
