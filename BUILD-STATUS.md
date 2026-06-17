# Provecta Platform — Build Status

**As of:** 2026-06-17 · **Stack:** Next.js 15.1.3 / React 19 / Prisma 6 / Auth.js v5 / Tailwind v4.
**Dev DB:** SQLite (keyless). **Prod target:** Neon Postgres + RLS.
**Verified:** `pnpm typecheck` clean · `pnpm build` green (**22 routes**) · login, dashboards, a live
ticket mutation, the autonomy ramp, the balanced ledger, and an **inbound WhatsApp webhook → ticket**
all confirmed in-browser / via API.

## ✅ Built & running — all four waves (feature-complete, rails gated)

| Wave | Slices | Status |
|------|--------|--------|
| **W1 Foundation** | Repo + ESM + Tailwind v4; ~30-model Prisma schema + seed; Auth.js credentials (argon2) + role routing; admin overview/clients/engagements + drill-down; client portal; document/media vault; audit log | ✅ |
| **W2 Client value** | KPI/SLA/budget dashboards; invoices + **mark-paid**; **double-entry ledger** + trial balance + **unified payment-intake** view; **e-signature** (envelopes, send, sign, **wet-ink upload + jurisdiction matrix**); **proposal-from-transcript** (brain) | ✅ |
| **W3 Autonomous ops** | **Brain service** (AI Memory Brain now / bRRAIn later, gated); **omnichannel inbound webhooks** (WhatsApp/Slack/Telegram/Discord/email → ticket); **autonomy ramp** (SUGGEST→AUTO_WITH_REVIEW→AUTONOMOUS, hard-gated for REGULATED/IRREVERSIBLE); client **notifications** | ✅ |
| **W4 Maturity** | **Change management / ADKAR** readiness scorecard + adoption dashboard; **public marketing site** (landing, services, **portfolio**, **blog** + SEO `sitemap.xml`/`robots.txt`); mobile nav | ✅ |

Admin back office = 11 modules. Credentials written to gitignored `ADMIN-CREDENTIALS.local.md`.

## 🔌 Gated on API keys — the only thing left to "go live" (per the directive)

| Rail | Env | Effect when key added |
|------|-----|----------------------|
| **Email** | `RESEND_API_KEY` | Auto-emails admin credentials to hassan.qaseem@gc-usa.com (now in local file) + client notifications. |
| **Brain** | `BRRAIN_API_KEY`/`BRRAIN_API_URL` | Swaps the stub for AI Memory Brain → official bRRAIn API. |
| **Payments** | `STRIPE_SECRET_KEY` (+ M-Pesa/Flutterwave/Wise) | Real invoice charges + webhook reconciliation. |
| **E-signature** | `DROPBOX_SIGN_API_KEY`/`DOCUSIGN_*` | Real envelopes (stub already enforces the wet-ink jurisdiction gate). |
| **Omnichannel transport** | `WHATSAPP_TOKEN`/`SLACK_BOT_TOKEN`/… | Verifies inbound webhooks (route + ticket creation already live). |
| **Data feed** | `NANGO_SECRET_KEY` | Pull client-system data into dashboards. |
| **Storage** | `R2_*` | Real vault uploads (metadata modeled today). |

## 🧱 Genuinely remaining (infra, not features) — needs accounts/keys

- **Postgres + RLS port** (dev is SQLite): swap provider, string-status → native enums, add RLS policies + `FORCE ROW LEVEL SECURITY` + Prisma tenant-scoping extension. Checklist below.
- **Vercel deploy** + domain cutover (subsume pgco.world `/amb` + email assets + RevOps functions).
- Real R2 uploads; Nango connector wiring; live payment/e-sign/transport provider calls behind the existing flags.

## Prod port checklist (SQLite → Neon Postgres)

1. `datasource db { provider = "postgresql" }` + `DATABASE_URL` = Neon.
2. Convert string status fields → native Prisma enums.
3. Add RLS policies + `FORCE ROW LEVEL SECURITY` + a Prisma tenant-scoping client extension.
4. `prisma migrate deploy` (never `migrate dev` on a shared DB). Swap vault → R2, email → Resend.
