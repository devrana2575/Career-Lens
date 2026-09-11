# Plan: Phase 16 — Student Dashboard + In-App Notifications

> Post-MVP: richer dashboard insights and an in-app notification system.

---

## Notifications

**Goal:** Notify students when assessments complete, reviews land, and recruiters shortlist them. Surfaced via a bell in the app header and a dedicated page.

### Shared (`packages/shared`)

**New file:** `src/domain/notification.js`
- `NOTIFICATION_KINDS` — `['assessment_completed', 'assessment_reviewed', 'shortlisted']`
- `NotificationSchema` — `{ id, kind, title, message, data?, isRead, readAt?, createdAt }`
- `NotificationListResponseSchema` — `{ notifications[], unreadCount }`
- `UnreadCountResponseSchema` — `{ unreadCount }`

**Edit:** `src/index.js` — add re-exports from `domain/notification.js`

### API (`packages/api`)

**New file:** `models/notification.model.js`
- Mongoose model for `notifications` collection
- Fields: `userId` (ref User), `kind` (enum), `title`, `message`, `data` (Mixed, default `{}`), `isRead` (bool), `readAt` (Date)
- Timestamps: `createdAt` only; index `{ userId: 1, createdAt: -1 }`

**New file:** `services/notification.service.js`
- `createNotification({ userId, kind, title, message, data })`
- `listNotifications(userId, limit)` → `{ notifications, unreadCount }`
- `getUnreadCount(userId)` / `markOneRead(userId, id)` / `markAllRead(userId)`
- `notifyShortlistedCandidates(candidateIds, { shortlistId, shortlistName })` — batch insert via `insertMany`

**New file:** `routes/notification.routes.js`
- `GET /` — list (limit cap 100)
- `GET /unread-count` — unread only
- `POST /:id/read` — mark one (404 if not owner)
- `POST /read-all` — mark all
- All authenticated

**Edits:**
- `routes/index.js` — mount notification router at `/api/notifications`
- `services/assessment.service.js` — after the auto-graded branch of `submitAttempt` records evidence, create an `assessment_completed` notification; after `reviewAttempt` records evidence, create an `assessment_reviewed` notification for the student
- `services/recruiter.service.js` — `createShortlist` notifies all candidates; `updateShortlist` notifies only newly added candidates

**New test:** `test/notifications.test.js`
- Auth required; empty list; newest-first ordering + unreadCount; unread-count endpoint; mark-one-read; 404 when marking another user's notification; mark-all-read; auto-generated `assessment_completed` on scored MCQ attempt; `shortlisted` on shortlist create and on update only for newly added candidates

### Frontend (`packages/frontend`)

**New file:** `components/notification-bell.jsx`
- Header bell with unread badge; polls `GET /notifications?limit=6` every 30s; dropdown lists recent notifications, "Mark all read", link to `/dashboard/notifications`
- Closes on outside pointer down

**New file:** `pages/dashboard/NotificationsPage.jsx`
- Full notification list with unread indicators, kind badges, mark-read and mark-all-read actions

**Edits:**
- `components/layout.jsx` — add a slim top bar above content with the `NotificationBell`
- `App.jsx` — add `/dashboard/notifications` route

---

## Student Dashboard Enhancements

**Goal:** Surface evidence health, market demand, and recent activity directly on the dashboard.

### Edits (`pages/dashboard/DashboardPage.jsx`)
- Fetch evidence records (`GET /evidence`) and role benchmark (`GET /market/benchmarks/:roleSlug`) alongside existing reads
- New "Insights" row of three cards:
  - **Evidence summary** — total skills with evidence plus how many are verifiable (any source type other than `self_reported`)
  - **Market insight** — target role name, demand label, posting volume, confidence, top skills; falls back to a prompt to import job postings
  - **Recent activity** — last 5 evidence events flattened from all sources, newest first