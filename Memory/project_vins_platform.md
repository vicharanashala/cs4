---
name: project-vins-platform
description: "Full MERN community platform — FAQ, Forum, Admin — built in root directory with JWT auth, OpenRouter AI, MongoDB Atlas"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2c01f4c2-63f4-4e14-afd3-cc34a9f69678
---

Full MERN community platform built at root `vins-crowdwork-11/`.

**Stack:** Node/Express (backend/) + MongoDB Atlas + React/Vite/Tailwind (frontend/) + OpenRouter AI

**Key facts:**
- Backend port 5000, Frontend port 5173
- Admin seed: `cd backend && npm run seed` → admin@vins.in / Admin@123456
- Start: `npm run dev` in both `backend/` and `frontend/`
- JWT in httpOnly cookies + CSRF double-submit pattern
- MONGO_URI in root `.env` had missing `@` — fixed copy is in `backend/.env`
- OpenRouter API key in `backend/.env` as `OPENROUTER_API_KEY`

**Three pages:**
1. `/` — FAQ with collapsible answers, tag filter, search, Yaksha AI chatbot
2. `/forum` — Reddit-like forum with auth gate, create post, votes, N-level threaded comments, @mention autocomplete, AI duplicate detection, image upload
3. `/admin` — Admin panel: stats, user management, FAQ management, post moderation (hide/archive/hard-delete with undo tokens), log viewer, Discord-style member panel

**Security features added:**
- Server-side timeout middleware on ALL write endpoints (TIMEOUT_ACTIVE error code)
- Opaque publicId (6-char hex) on all users — never exposes Mongo _id in member-facing APIs
- UndoToken system: 10-second single-use undo for admin moderation actions
- Socket.io with JWT auth middleware (verifies token from httpOnly cookie on handshake)
- Image upload: MIME validated from bytes (file-type@14), not Content-Type header
- Admin search regex-escaped to prevent ReDoS
- Notification system (reply, mention, admin_message) with real-time Socket.io delivery

**New models:** Notification (30-day TTL), UndoToken (10-second TTL)
**New backend routes:** /api/notifications, /api/users/search, /api/upload/image, /api/admin/members

**Why:** Security hardening + feature set added per user requirements. Never trust frontend controls.

**How to apply:** Reference for structure, credentials, and how to run/extend this project.
