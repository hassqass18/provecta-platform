# Provecta Platform

Business operations platform — **client portal + autonomous back office**, built on bRRAIn.
Next.js 15 · React 19 · Prisma 6 · Auth.js v5 · Tailwind v4. Mirrors the karibu-backend stack.

> **Dev runs keyless.** Local dev/demo uses **SQLite** (`prisma/dev.db`) so the whole app runs with
> zero external services. Production targets **Neon Postgres** (native enums + Row-Level Security) —
> see `BUILD-STATUS.md` for the port. Every external rail (Stripe, M-Pesa, DocuSign, WhatsApp, Resend,
> bRRAIn, R2) is **gated behind an env flag**: absent ⇒ the feature is gated/stubbed, never blocks the build.

## Run it

```bash
pnpm install
pnpm prisma db push        # creates prisma/dev.db from the schema
pnpm db:seed               # sample data + writes ADMIN-CREDENTIALS.local.md
pnpm dev                   # http://localhost:3000  (or --port 3001)
```

## Logins (after seed)

- **Admin (complete control):** `hassan.qaseem@gc-usa.com` — password in `ADMIN-CREDENTIALS.local.md` (gitignored, randomly generated each seed).
- **Demo client dashboard:** `demo.client@provecta.dev` / `demo1234` — or click **“View demo client dashboard →”** on the login page.
- **Staff:** `staff@provecta.dev` / `staff1234`.

## What's here (Wave 1 foundation — running)

- Auth.js credentials login (argon2), role-based routing (`SUPER_ADMIN`/`ADMIN`/`STAFF` → `/admin`, `CLIENT` → `/portal`).
- **Admin back office** (`/admin`): overview KPIs, clients, engagements + drill-down (project charter, milestones with *Advance* control, tasks, invoices, documents, engagement-status control), omnichannel **tickets** (channel + status + autonomy-state badges, *Approve action*), **invoices** (mark-paid), and **“View as client (demo)”**.
- **Client portal** (`/portal`): engagement overview, KPIs + progress, milestones, SLAs, invoices, document/media vault, tickets, and a raise-a-ticket form.
- ~18-model engagement spine (Tenant → Engagement → Proposal/Charter/Milestone/Task/Deliverable, Document vault, Invoice/Payment, KPI/SLA, Ticket/Message, AuditLog, Notification).
- Server actions with audit logging for every admin mutation.

See `BUILD-STATUS.md` for what's built vs. what remains (the gated rails + later waves).
