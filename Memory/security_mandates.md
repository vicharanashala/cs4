---
name: vins-security-mandates
description: "Hard security rules for the VINS platform — server-side enforcement, never trust frontend, opaque IDs"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2c01f4c2-63f4-4e14-afd3-cc34a9f69678
---

These rules were set explicitly by the user and must never be violated.

**Never rely on:** hidden buttons, disabled frontend controls, client-side role checks, obscured API routes, frontend validation only.

**Assume attackers WILL:** inspect frontend code, replay requests manually, modify payloads, use Postman/cURL, forge websocket packets, automate spam, scrape APIs, brute-force IDs, tamper with timestamps, bypass disabled buttons, attempt horizontal privilege escalation.

**Rule 1 — Backend admin check on every request.**
`verifyToken + requireAdmin` on ALL `/api/admin/*` routes. Never trust `user.role` from the frontend.

**Rule 2 — checkTimeout server-side only.**
`checkTimeout` middleware is applied to ALL write endpoints (forum posts, votes, comments, image upload). Frontend disabled-UI is cosmetic only. Returns 403 with `code: TIMEOUT_ACTIVE` and `remainingSeconds`.

**Rule 3 — Opaque publicId instead of MongoDB _id.**
All member-facing APIs expose `publicId` (6-char hex, e.g. `A3F9C1`), never `_id`. Prevents enumeration and leaks.

**Rule 4 — Logs are immutable.**
Log collection is append-only. No DELETE or UPDATE endpoints for logs. Auto-expire after 90 days via TTL index only. Admins cannot silently modify or delete logs.

**Rule 5 — Prevent log injection.**
All string content passed to `logEvent()` is structured in the `details` object (Mixed type), never interpolated into log message strings directly.

**Rule 6 — ReDoS protection on regex queries.**
All search strings used in MongoDB regex must be escaped: `s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` before wrapping in `new RegExp(...)`.

**Why:** User explicitly designed this platform assuming a hostile environment where attackers have full frontend source access and will bypass every UI control.

**How to apply:** Before adding any write endpoint or admin feature, ask: does this work if the attacker bypasses the frontend entirely? Backend must be the sole enforcement point.
