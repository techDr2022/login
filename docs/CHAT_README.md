# Realtime Team Chat

Production-ready realtime team chat: room-based model, SSE streaming, idempotent send, read receipts, unread badges, and sound notifications.

## Chat Types

- **TEAM room**: Single global room; all employees are members. Anyone can send and read.
- **DIRECT room**: Only **Manager → Employee** (or Super Admin → anyone). Employees cannot DM other employees.

## Data Model (Prisma)

| Model | Purpose |
|-------|--------|
| **ChatRoom** | `type`: TEAM \| DIRECT |
| **ChatMember** | Membership with `lastReadAt` for unread count |
| **ChatMessage** | `text`, `clientMsgId` (idempotency), `roomId`, `senderId` |
| **MessageReceipt** | Per-user status: SENT / DELIVERED / READ |
| **UserPresence** | `lastSeenAt` (optional for future presence) |
| **ChatNotification** | In-app notifications (optional) |

Indexes: `ChatMessage(roomId, createdAt)` for fast pagination; unique `(roomId, clientMsgId)` for idempotent upsert.

## Realtime (SSE)

- **GET `/api/chat/stream?roomId=...`**  
  Streams new messages for that room only. Open after loading the last 50 messages; append new events to the list (no full re-render).
- **POST `/api/chat/send`**  
  Body: `{ roomId, text, clientMsgId }`. Upsert by `(roomId, clientMsgId)` so retries don’t create duplicates.
- **POST `/api/chat/read-receipts`**  
  Body: `{ roomId }`. Updates `ChatMember.lastReadAt` and sets `MessageReceipt` to READ for messages in that room.

## Performance

- **Initial load**: Fetch last 50 messages via **GET `/api/chat/rooms/[roomId]/messages?limit=50`**.
- **Virtualization**: Message list uses **react-virtuoso** for large scrollable lists.
- **Index**: `ChatMessage` has `@@index([roomId, createdAt])`.
- **Append-only**: New messages from SSE are appended to state; list is not refetched.

## Unread & Notifications

- Unread count per room: messages after `ChatMember.lastReadAt` (excluding own).
- Red badge on room in sidebar and on Team/Direct tabs.
- Sound plays only when the window is **not** focused (or when the new message is in a different room than the one open).
- Opening a room calls **POST `/api/chat/read-receipts`** with `roomId` and updates `lastReadAt`.

## UI (shadcn/ui)

- **Layout**: Left sidebar = room list (Team + Direct); main area = message panel.
- **Composer**: Sticky at bottom; attachments placeholder; Enter to send; resend for failed messages (same `clientMsgId`).
- **Message bubble**: Sender name, time, and delivery/read indicator (checkmarks).

## API Summary

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/api/chat/rooms` | List rooms (TEAM + DIRECT) with last message and unread count |
| POST | `/api/chat/rooms` | Create/get TEAM or DIRECT room (`type`, optional `targetUserId`) |
| GET | `/api/chat/rooms/[roomId]/messages?limit=50&before=ISO` | Last N messages (paginated) |
| GET | `/api/chat/stream?roomId=...` | SSE stream of new messages for room |
| POST | `/api/chat/send` | Send message `{ roomId, text, clientMsgId }` (idempotent) |
| POST | `/api/chat/read-receipts` | Mark room read `{ roomId }` |
| GET | `/api/chat/rooms/unread` | Total unread count across rooms |

---

## How to Run Locally

1. **Environment**  
   Copy `.env.example` to `.env` and set:
   - `DATABASE_URL` (PostgreSQL)
   - `DIRECT_URL` (optional, for migrations)
   - NextAuth `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (e.g. `http://localhost:3000`)

2. **Database**  
   Apply migrations and (optional) seed:
   ```bash
   npx prisma migrate deploy
   # optional: npx prisma db seed
   ```

3. **Install & run**  
   ```bash
   npm install
   npm run dev
   ```
   Open `http://localhost:3000`, log in, and go to **Team Chat** (`/chat`).

4. **Chat flow**  
   - TEAM room is created on first access; you’re auto-added.
   - Direct: only Manager/Super Admin can start a conversation (New message → pick user).
   - Messages send via POST `/api/chat/send`; new messages arrive via SSE on `/api/chat/stream?roomId=...`.

---

## Deploy on Vercel

1. **Repo**  
   Push the project to GitHub (or connect your repo in Vercel).

2. **Project**  
   In Vercel: New Project → Import repo → use existing framework (Next.js).

3. **Environment variables**  
   In Project → Settings → Environment Variables, add:
   - `DATABASE_URL` (e.g. Vercel Postgres or Neon)
   - `DIRECT_URL` (if using connection pooling)
   - `NEXTAUTH_SECRET` (generate a random string)
   - `NEXTAUTH_URL` = `https://your-domain.vercel.app`

4. **Build**  
   Build command: `npm run build` (or `prisma generate && next build`).  
   Install command: `npm install`.  
   Output directory: default (`.next`).

5. **Migrations**  
   Run migrations against the production DB before or after first deploy:
   ```bash
   npx prisma migrate deploy
   ```
   Use the same `DATABASE_URL` / `DIRECT_URL` as in Vercel (e.g. run locally with production env or use Vercel’s “Run script” / a one-off job).

6. **SSE / long connections**  
   Vercel supports streaming responses (e.g. GET `/api/chat/stream`). If you hit timeouts, ensure `maxDuration` is set in the route (e.g. 120s) and consider Vercel’s plan limits for function duration.

After deploy, open `https://your-domain.vercel.app/chat` and use the same flow as locally (TEAM + Direct, send, read receipts, unread badges, sound when not focused).
