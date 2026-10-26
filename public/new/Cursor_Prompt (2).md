# Cursor Prompt – Amend Existing App (One Day)

## Before you paste

1. Back up the production database.
2. Export the requirements doc as Markdown and save it in the project as `docs/requirements.md`.
3. Put `master_tasks.json` in the project at `data/master_tasks.json`.
4. Open the existing project in Cursor, switch to Agent mode, paste everything below the line, and attach both files with `@`.

---

This project is our EXISTING internal task management app. Do not rebuild it, do not change the tech stack, and do not delete or rename existing tables, columns, routes or screens unless I approve it. We are amending it so it matches `@docs/requirements.md`. Seed data is in `@data/master_tasks.json`.

Everything must be finished today, so work in the four blocks below. Stop after Block 0 and wait for my OK; after that, keep going block by block and only stop if something is blocked or risky.

## Block 0 – Audit (no code changes)

Read the whole codebase and `docs/requirements.md`, then give me a short gap report as a table: requirement, what exists today (file/table), what needs to change, effort (S/M/L). Cover users and roles, tasks, recurring tasks, dependencies, statuses, notifications, every screen in the "Screens" section, and the public board. Also tell me the stack, how auth works, how the app is deployed, and whether it already has any scheduled jobs. Flag anything that cannot be done today.

## Block 1 – Data

- Additive database migrations only. Existing data must keep working.
- Add or extend models to cover: TaskTemplate, TemplateDependency (with `mode` all/any and same-team/cross-team), TaskInstance fields (status, due_at, revision_count, client, project), Project, Client, ActivityLog, Notification, and a setting for the public board token. Map to existing models wherever they already fit.
- Write an idempotent import script for `master_tasks.json` (upsert by template id; safe to run twice). It creates people, teams, task templates and both kinds of dependencies, and prints counts.
- Abhista and Raviteja are admins with equal rights. Shaheena is coordinator. Everyone else is member. Escalation: member → Shaheena → both admins.

## Block 2 – Engine

Implement automation rules 1–10 from the requirements (skip the WhatsApp and email parts; in-app only):

- Daily scheduler at 09:30 Asia/Kolkata, Mon–Sat, with lead time for monthly tasks, per-client instances, holidays, and no duplicates. Add an admin-only "Run scheduler now" button.
- Dependency unlock (respecting all/any), Waiting on Input with linked provider tasks, daily 10 AM input reminders.
- Escalation (1 day → Shaheena, 2 days → both admins, High priority after 4 working hours).
- New Client and New Website project creation, daily plan & approval, client edits with revision count, on-event buttons.
- Log every status change to ActivityLog.
- Keep all business rules in one service folder (e.g. `lib/engine/`), not in UI components, with unit tests for the scheduler and dependency engine. Include this test: marking RAG-W5 Done unlocks SHA-AM1, and marking SHA-AM1 Done unlocks RAG-W6.

## Block 3 – Screens

Reuse existing screens and components. Add or update: My Day, Waiting on Me, I'm Waiting On, Task detail, Team board, Client view, Admin dashboard, Admin settings, and the Public board.

Public board (no login):

- Route like `/board/[token]`. The token is a long random string stored in settings. Admins can regenerate it from Admin settings, which invalidates the old one. Wrong token returns 404.
- Shows everyone's tasks for today, grouped by person, with status, due time and an overdue flag; filters by team and person.
- Strictly read-only: no buttons, forms or API routes that write anything are reachable from it.
- Never sends payments, client phone numbers, logins, comments or attachments to the browser, not even hidden.
- `noindex` meta tag and robots header; auto-refresh every 60 seconds; works on a phone and on a TV screen.

## Block 4 – Test & deploy

Run every item in the "Launch day is done when" checklist in `docs/requirements.md`, fix failures, and give me a final list of what was changed, what was tested, and anything moved to day two.

## Rules

- Asia/Kolkata timezone everywhere.
- Nothing about people, teams, clients or tasks is hard-coded; it all comes from the database.
- Templates with `needs_confirmation: true` are active; show an "unconfirmed" badge only in admin views.
- If the requirements and the existing code disagree, or something is unclear, ask me instead of guessing.
