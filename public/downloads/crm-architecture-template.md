# CRM Architecture Template
**Provecta Group — Business Operations on bRRAIn**

The field, stage, and automation structure behind Provecta's client CRM builds.
Use it to architect (or audit) your own CRM. Free to use; have us implement it at pgco.world.

---

## 1. Lead object — core fields
| Field | Type | Why it exists |
|---|---|---|
| Lead Source | Picklist | Attribution; the #1 field teams skip |
| Lead Source Detail | Text | Campaign / referrer specificity |
| Lead Score | Number | Fit × intent, recomputed on change |
| Lifecycle Stage | Picklist | Subscriber → Lead → MQL → SQL → Opp |
| Owner | User | Single accountable rep |
| Routing Status | Picklist | Unassigned / Assigned / SLA-breached |

## 2. Pipeline stages (lead-to-deal)
1. **Qualification** — fit confirmed, owner assigned (SLA: < 5 min to first touch)
2. **Discovery** — pain quantified, decision process mapped
3. **Proposal** — scoped, sent, tracked
4. **Negotiation** — terms, redlines, approvals
5. **Closed Won / Closed Lost** — reason code required on both

## 3. Automation rules (the high-payback five)
1. Web-form → create Lead → score → route to owner + instant notify.
2. Stage change → timestamp + required-field gate (no skipping).
3. No activity in N days → task to owner + manager visibility.
4. Closed Won → create onboarding project + handoff checklist.
5. Closed Lost → reason code → nurture sequence by reason.

## 4. Reporting (the 4 leadership actually uses)
- Pipeline coverage (3–4× target by stage)
- Speed-to-lead (median minutes to first touch)
- Stage conversion + drop-off (where revenue leaks)
- Win rate by source / segment

---
© 2026 Provecta Group · pgco.world · Built on bRRAIn
