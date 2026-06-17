# Provecta Platform — Design & Copy Brief

**Owner:** Design Lead
**Build target:** `C:/Users/swozz/Documents/provecta-platform` (Next.js — landing + portal/back-office)
**Status:** Build-ready. This brief merges the advisor + designer panel into one source of truth.

**Visual system = the LIVE pgco.world Apple-inspired CSS.** `design.md` describes a navy/gold/IBM-Plex system — that is **overridden for all visuals** and survives only for VOICE rules and structural discipline. Do not re-introduce navy (`#060f20`), gold (`#c8a96e`), or IBM Plex anywhere.

**Voice rules (enforced in every string below):** direct, operational, evidence-led, numbers over adjectives, sentence-case headings, Title Case nav, no emoji, and a hard ban on the salesy verbs **unlock / empower / transform / discover / embark**. CTAs are action-and-noun ("Run the audit", "Download the template", "Book a working session").

---

## 1. Positioning & Thesis

**One-liner:** *Provecta is a business-operations resource platform — a hub of assessments, calculators, templates, and playbooks businesses use to run leaner and grow revenue — and the firm that installs and runs them on bRRAIn.*

**Who it serves:** operators and leaders at mid-market and growing businesses who suspect their operations leak revenue or drag on manual work, but want to self-diagnose with a number before talking to anyone.

**Why it's credible (not a content veneer):** Provecta runs its own back office autonomously on bRRAIn — the same operating system every client is onboarded onto. So every free tool is an honest, thin slice of a real engagement, not a marketing blog. "We run our own firm on the platform we sell you" is the load-bearing proof.

**The conversion ladder (the whole strategy in one line):** a visitor runs a free tool → sees a scored gap with a **number attached** (dollars leaked, hours dragged, a 0–100 score) → creates a portal account to save/benchmark the result → the highest-cost gaps convert into Provecta engagements. The portal account is a value-capture moment, never a paywall: **the tool is always free to run; only the saved/benchmarked output and downloads are gated by a free sign-up.**

**Hard rule the IA must reflect:** tools come **before** services on the page. The platform leads; the firm closes.

---

## 2. Hamburger Nav / IA

**HARD CONSTRAINT:** all navigation lives inside a **single hamburger** that opens a **full-screen translucent glass overlay at every screen width** — no inline desktop nav, no persistent sidebar, no mobile scroll-strip. The same overlay component is used on the landing AND the portal/back-office.

**Exact menu item list (in order), used at all widths:**

1. Tools & Resources
2. Assessments
3. Calculators
4. Templates & Playbooks
5. What We Do
6. Our Work
7. Insights
8. Client Login *(pinned — primary action)*
9. Book a Working Session *(pinned — primary action)*

**Overlay behavior:**
- Bar contains only: `Provecta` wordmark (+ faded `Group` / `Platform` label) and the hamburger trigger. Optionally the primary "Book a Working Session" pill may also sit in the bar.
- Menu lead with the four Tools items (this reinforces "resource platform" even in the IA), then What We Do / Our Work / Insights.
- **Client Login** and **Book a Working Session** are pinned as the two persistent actions at the bottom of the overlay so the conversion path is never buried.
- Each item may carry a one-line descriptor underneath. Flat list — **no nested dropdowns** (they fail on touch).
- Client component: `useState(open)` + body scroll-lock + Esc-to-close + focus trap.

---

## 3. Landing Page — Section by Section

Strict tone alternation: never two adjacent sections of the same tone. Container `max-width: 980px`, `padding: 0 2rem`. Vertical rhythm ~7rem desktop / ~4rem mobile.

Order: **Hero (black) → Tools & Resources grid (light) → How it works / 3-step (black) → Proof / numbers band (light) → What We Do (black) → Insights (light) → Final CTA (black) → Footer (black).**

---

### Section 1 — Hero  *(dark / #000, digital-grid overlay)*
- **Purpose:** State the repositioning in one line — a tools platform with the firm as the optional done-for-you path. No "we are a firm" language above the fold.
- **Layout:** Black hero, `min-height 100vh`, `padding 140px 0 100px`. `.hero__grid` absolute overlay: two `linear-gradient(rgba(0,113,227,0.12) 1px, transparent 1px)` (and the 90deg variant), `background-size 48px 48px`, `z-1`; content `z-2`. Centered eyebrow micro-tag → h1 → subcopy (max-width 600px, `--text-white-secondary`) → `.hero__actions` (primary pill + ghost text-link) → hero stat strip with the highlighted figure wrapped in a `--bright-blue` span.
- **Eyebrow:** `BUSINESS OPERATIONS TOOLKIT`
- **Heading:** The operations toolkit, and the firm that runs it for you.
- **Subcopy:** Free assessments, calculators, and playbooks to find where revenue leaks and operations drag — then the team that fixes it. Built on bRRAIn, the same operating system we run our own firm on.
- **Primary CTA (Apple-blue pill):** Start the free RevOps audit
- **Secondary CTA (ghost text-link):** See what we do
- **Hero stat strip (numbers, bright-blue spans):** 11 operations modules · one source of truth · built on bRRAIn
- **Tools/resources shown:** none yet (drives down to the grid).

---

### Section 2 — Tools & Resources grid  *(light / #f5f5f7)*
- **Purpose:** Make the page read as a "resource platform" within one scroll and give the visitor an action before any ask.
- **Layout:** Section header (eyebrow + heading + subcopy) then a 3-up card grid (`sm:1 md:2 lg:3`). Cards on light = white, `radius 18px`, subtle shadow. **One featured card = Apple-blue (#0071e3), white text** — use it for the RevOps Audit (highest-intent, already built). Every card leads with an uppercase micro-tag (`ASSESSMENT` / `CALCULATOR` / `TEMPLATE` / `PLAYBOOK`) in `--apple-blue`, then heading → one-line subcopy → single action CTA.
- **Eyebrow:** `TOOLS & RESOURCES`
- **Heading:** Diagnose first. Decide second.
- **Subcopy:** Run any tool free, no account required. Save your results and benchmark against your sector by creating a portal account.
- **Section CTA:** See all resources
- **Tools/resources shown (6 cards):**
  - **RevOps Audit** *(featured Apple-blue card)* — tag `ASSESSMENT` — "39 questions across lead-to-deal, CRM, and reporting. Returns a scored gap map and the three fixes with the highest payback." — CTA: Start the assessment
  - **AI Readiness Assessment** — tag `ASSESSMENT` — "Score where AI removes manual work across your operations — not where it adds another chatbot. Get a readiness band and a sequenced rollout." — CTA: Run the assessment
  - **Revenue-Leakage Calculator** — tag `CALCULATOR` — "Enter your funnel volumes and conversion rates. See the dollar value dropping out between lead and closed deal, stage by stage." — CTA: Open the calculator
  - **Operations Drag Estimator** — tag `CALCULATOR` — "Estimate the hours per month your team loses to manual, repeatable work — and what reclaiming them is worth at your loaded cost." — CTA: Open the calculator
  - **CRM Architecture Template** — tag `TEMPLATE` — "The field, stage, and automation structure behind our client builds. Download it, or have us implement it." — CTA: Download the template
  - **GTM & Sales-Process Playbook** — tag `PLAYBOOK` — "The sales-process architecture we deploy on engagements, written as a step-by-step playbook you can run yourself." — CTA: Download the playbook

---

### Section 3 — How it works (3-step)  *(dark / #000)*
- **Purpose:** Make the free-tool → portal-signup → engagement path explicit, so the account reads as the natural next step, not a gate.
- **Layout:** Eyebrow + heading, then a 3-column step band on dark (`#1c1c1e` step cards, numbered 1–3), closing with a single pill CTA.
- **Eyebrow:** `HOW IT WORKS`
- **Heading:** From a free tool to a fixed operation, in three steps.
- **Subcopy / steps:**
  - **Step 1 — Diagnose.** Run any assessment or calculator free and see your scored gaps in dollars and hours.
  - **Step 2 — Save.** Create a portal account to store your results, track your score over time, and benchmark against your sector.
  - **Step 3 — Act.** Where a gap is too costly to leave, bring in Provecta to build and run the fix on the same platform you signed in to.
- **CTA:** Create your portal account

---

### Section 4 — Proof / numbers band  *(light / #f5f5f7)*
- **Purpose:** Credibility from real signed contracts and the working platform — not vanity stats. The `design.md` anti-pattern is fabricated numbers; do not invent "500 clients / 95% retention".
- **Layout:** Numbers-first stat blocks (Apple stat style, bold figure + small label) over testimonials. Lead with the platform-as-proof line.
- **Eyebrow:** `EVIDENCE`
- **Heading:** We run our own firm on the platform we sell you.
- **Subcopy:** 11 operations modules on one source of truth, built on bRRAIn. Ecotecture / Sierra Homes Tower — project-management contract signed and active. Premier Realty — automated revenue-operations build signed, delivered at roughly 40% below a traditional dev-shop quote. Every tool above is a working slice of an engagement we deliver.
- **CTA:** See our work
- **Numbers discipline note for engineer:** the only client-proven facts are the Ecotecture/Sierra Homes PM contract (signed, active) and the Premier Realty RevOps build (signed, ~40% below dev-shop). Any dollar figures used inside tool *examples* (e.g. "$184K leak", "4.2-mo payback") are illustrative category-median placeholders and **must be labeled as such or replaced with real data** before going live — never presented as Provecta client results.

---

### Section 5 — What We Do  *(dark / #000)*
- **Purpose:** The firm pitch, demoted below the tools. Framed as "when the toolkit isn't enough, we build and run it."
- **Layout:** Eyebrow + heading, then four condensed service-line cards (`#1c1c1e`), closing with the working-session CTA.
- **Eyebrow:** `WHAT WE DO`
- **Heading:** When the toolkit isn't enough, we build and run it.
- **Subcopy / four service lines:**
  - **Business Operations Design** — your engagements, projects, money, and support modeled as one source of truth.
  - **Organization-wide AI Implementation** — AI deployed across your operations, not a single chatbot.
  - **Revenue Operations** — CRM architecture, lead-to-deal automation, and dashboards leadership actually uses.
  - **Custom Platforms** — bespoke software at a fraction of traditional dev-shop cost, delivered on a platform your team is onboarded onto.
- **CTA:** Book a working session

---

### Section 6 — Insights  *(light / #f5f5f7)*
- **Purpose:** Field-notes/thought-leadership lane; keeps the "resource" theme alive and feeds SEO. Pulls the 3 latest published `BlogPost` records (already wired in `page.tsx`).
- **Layout:** Eyebrow + heading, 3-up card grid (white cards on light).
- **Eyebrow:** `INSIGHTS`
- **Heading:** Field notes on running operations on AI.
- **Subcopy:** How we use bRRAIn to run an enterprise back office solo, and what that means for your team.
- **CTA:** Read the latest

---

### Section 7 — Final CTA  *(dark / #000)*
- **Purpose:** Close on the lowest-friction, highest-intent action — a free tool, not a sales call.
- **Layout:** Centered eyebrow + heading + subcopy + single primary pill.
- **Eyebrow:** `START HERE`
- **Heading:** Find your most expensive gap this week.
- **Subcopy:** Run a free assessment, save the result to your portal, and decide what to fix yourself and what to hand us. No sales call to get started.
- **CTA:** Start the free RevOps audit

---

### Section 8 — Footer  *(dark / #000)*
- **Heading line:** Provecta Group — Business Operations on bRRAIn
- **Subcopy:** © 2026 Provecta Group. The first Business Operations firm built on bRRAIn.
- **Link:** Powered by bRRAIn → `https://brrain.io/architecture?ref=957c790577` (styled in `--bright-blue`, not gold).

---

## 4. Tools & Resources Catalog (deduped, all advisors merged)

The panel proposed ~20 tools across five advisors with heavy overlap. Below is the deduped master catalog mapped 1:1 to Provecta's real service lines. **Wave 1 = ship first** (two assets already exist: the 39-question RevOps Audit Blueprint and the live AI Readiness Assessment at pgco.world/amb). Gating rule: tool runs free; saved/benchmarked output + downloads require a free portal account; "we build it" is the paid tier.

| Tool / Resource | Category | Description | Value prop / service line | Tier | Wave |
|---|---|---|---|---|---|
| **RevOps Audit** | Assessment | 39-question scored diagnostic across lead-to-deal flow, CRM hygiene, handoffs, and reporting; returns a weighted gap map and the three highest-payback fixes. | Honest preview of a Revenue Operations engagement; already built (Zoho blueprint, 34 CRM fields, scoring matrix) — ships day one. | Run free · result gated · build paid | 1 |
| **AI Readiness Assessment** | Assessment | Scores the preconditions for AI that returns ROI (data, process docs, integration, decision-rights, change capacity); returns a readiness band + sequenced first use-cases. | Already live at pgco.world/amb; anchors the Organization-wide AI Implementation line; routes ready teams to a scoped bRRAIn pilot. | Run free · result gated · pilot paid | 1 |
| **Revenue-Leakage Calculator** | Calculator | 3 inputs (qualified leads, avg deal size, stage drop-off) → annual revenue leaking out of the funnel, by stage, with a peer percentile. | Puts a dollar number on the problem (numbers-over-adjectives); primes the RevOps engagement. Ungated headline number, gated breakdown. | Run free · breakdown gated | 2 |
| **Operations Drag Estimator** | Calculator | Inputs hours on repeatable work + loaded hourly cost → monthly/annual cost of manual work and automation payback. | Quantifies the case for Business Operations Design + AI implementation in the visitor's own numbers; flags work to eliminate vs automate. | Run free · breakdown gated | 2 |
| **CRM Architecture Template** | Template | The field (34), stage, and automation structure behind Provecta's client CRM builds, as a downloadable template + checklist. | Demonstrates depth; converts DIY users into "have us implement it." Reuses existing Zoho blueprint IP. | Download gated by sign-up | 3 |
| **GTM & Sales-Process Playbook** | Playbook | Step-by-step sales-process architecture Provecta deploys on engagements, written to run yourself. | Thought-leadership asset mapped to the GTM line; seeds portal sign-ups. | Download gated by sign-up | 3 |
| **Operating-System One-Pager** | Template | Single-page canvas mapping engagements, projects, money, and support into one source of truth — the first artifact built in every engagement. | Low-friction lead magnet that mirrors the real first deliverable. | Download gated by sign-up | 3 |
| **Operating-System Health Scorecard** | Assessment | Whole-business diagnostic rating each function against a 5-level maturity model; returns one operating-system score + a sequenced 90-day roadmap. | The platform-level "where do I sit / what to fix first" view; mirrors the bRRAIn single-source-of-truth back office. | Run free · roadmap gated · build paid | 4 |

**Catalog discipline (strategy advisor's rule):** keep to a tight set mapped 1:1 to service lines; resist a "general business" bucket with no engagement on the other side. Define a leading indicator at launch — **tool-completion → portal-signup rate; if it drops below ~15%, the gate is too aggressive.** Every tool must end in a scoped, Provecta-buildable recommendation, never a generic "Contact us".

**Deferred / optional (do not block Wave 1):** Manual-Work Cost Calculator, Cost-to-Serve Calculator, Deal-Velocity Calculator, Process-Leak Diagnostic, Build-vs-Buy Estimator, and the PMO delivery tools (Charter Builder, Critical-Path Tracker, RAID Log, RAG Status Generator). These are strong second-wave additions but are out of scope for the initial landing build.

---

## 5. Token & Component Spec (pgco.world Apple system — build-ready)

Source of truth for exact hexes: `C:/Users/swozz/Documents/AI_Memory_Brain/projects/staging/ProvectaGroup/website/index.html`. **Replace the current `@theme` block in `globals.css`** (which holds the OLD `--color-navy #060f20` / `--color-brand #2468b0` / `--color-gold #c8a96e`) with the palette below. Inter is already correct.

### 5.1 Color tokens (CSS vars)
```css
--color-black:        #000;
--color-near-black:   #1d1d1f;
--color-light-bg:     #f5f5f7;
--color-white:        #fff;
--color-apple-blue:   #0071e3;
--color-link-blue:    #0066cc;
--color-bright-blue:  #2997ff;
--color-dark-surface: #1c1c1e;   /* default card on dark */
--color-dark-surface-2:#2c2c2e;
--color-nav-bg:       rgba(0,0,0,0.82);
--text-secondary:     rgba(0,0,0,0.56);
--text-muted:         rgba(0,0,0,0.48);
--text-white-secondary:rgba(255,255,255,0.7);
--brand:              var(--color-apple-blue);   /* single functional alias */
```
Retire all gold and navy. No other saturated hue is allowed except the single restrained Apple red reserved for danger (§5.7).

### 5.2 Typography (Inter, tight Apple tracking)
- `--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif` (load weights 300;400;500;600;700). **Do not use IBM Plex.**
- **h1** `clamp(2.6rem,5vw,3.5rem)` / 600 / lh 1.07 / ls −0.28px
- **h2** `clamp(1.8rem,3.5vw,2.5rem)` / 600 / lh 1.10 / ls −0.2px
- **h3** `1.75rem` / 600 / ls 0.007em
- **h4** `1.31rem` / 600 / ls 0.009em
- **body** `1.0625rem` / lh 1.47 / ls −0.022em / color `--text-secondary`
- **micro-tag** `0.75rem` / 600 / uppercase / ls 0.08em / color `--apple-blue` (use `--bright-blue` on dark cards)
- Headings near-black on light, white on dark.

### 5.3 Pill buttons (~980px radius)
One `.btn` base: `inline-flex; gap .4rem; font-weight 400; font-size 1.0625rem; padding 8px 22px; border-radius 980px; letter-spacing -0.022em; transition all .3s`. Variants:
- `.btn-primary` — bg `--apple-blue`, white; hover `filter: brightness(1.08)`
- `.btn-dark` — bg `--near-black`, white; hover `#333`
- `.btn-outline-light` — transparent, text + 1px border `--bright-blue` (for dark sections); hover fills bright-blue
- `.btn-outline-dark` — transparent, text + 1px border `--link-blue` (for light sections)
- `.btn-link` — text-only `--link-blue`, underline on hover
- Nav-scale pill: `font-size 0.75rem; padding 4px 14px`.
Build as `<PillButton variant intent>` wrapping `next/link`. **Replaces all `rounded-lg` buttons in `page.tsx`.**

### 5.4 Glass nav + full-screen hamburger overlay (shared component)
- Fixed nav: `height 48px; top:0; z-1000; background var(--color-nav-bg); backdrop-filter: saturate(180%) blur(20px)` (+ `-webkit-` prefix).
- Bar: `Provecta` wordmark (600 / 0.88rem / white / ls −0.02em) + faded `Group`/`Platform` span at opacity .7; hamburger = 3 spans 18px×1.5px white, gap 4px. Optionally one primary pill.
- **Deliberate deviation from the live CSS:** the live site reveals inline nav links above 834px — that rule is **dropped**. No inline links at any width; every item lives in the hamburger.
- Overlay `.nav__mobile`: `position fixed; inset 0; background rgba(0,0,0,0.96); flex column; centered; gap 2rem; opacity transition .3s`. Links `1.5rem / 600 / white`. Close button top-right `rgba(255,255,255,0.6)`.
- `'use client'`; `useState(open)` + body scroll-lock + Esc-to-close + focus trap. **Same component used in `marketing-shell.tsx` AND `shell.tsx`.**

### 5.5 Hero & digital-grid overlay
Hero bg `#000`, white, `padding 140px 0 100px`, `min-height 100vh`, relative, overflow hidden. `.hero__grid` absolute inset 0: two gradients `linear-gradient(rgba(0,113,227,0.12) 1px,transparent 1px)` + the `90deg` variant, `background-size 48px 48px`, `z-1`. Content `z-2`. Sub-headline `1.31rem` / `--text-white-secondary` / max-width 600px. Stat row: `2.5rem`/600 numbers, highlighted figure wrapped in a `--bright-blue` span, `0.75rem` white labels.

### 5.6 Sections, container, cards
- Container `max-width 980px; margin auto; padding 0 2rem`. Section padding ~7rem desktop / ~4rem mobile.
- **Strict tone alternation:** dark `#000` (white text) ↔ light `#f5f5f7` (near-black headings, `--text-secondary` body). Never two adjacent same-tone sections.
- **Card on dark:** bg `#1c1c1e`, `border-radius 18px`, `padding 24–32px`, no border, optional shadow `rgba(0,0,0,0.22) 3px 5px 30px`.
- **Featured card:** bg `--apple-blue`, white text, same radius — exactly one per grid (the RevOps Audit / recommended item).
- **Card on light:** bg white, `radius 18px`, subtle shadow.
- Every card leads with the uppercase blue micro-tag (the resource-type label).

### 5.7 Status badges — restyle to the restrained palette
Current badges live in `src/lib/types.ts` (`TONE_CLASS`: emerald/sky/rose/amber) and `src/components/ui.tsx` (`Stat`, `ProgressBar`). They read "SaaS", not Apple. Move to near-monochrome where **blue is the only saturated accent and red is the single exception, reserved strictly for true danger** (OVERDUE / BREACHED / CANCELLED / BLOCKED):

| State | Background | Text | Border |
|---|---|---|---|
| neutral | `#f5f5f7` | `#1d1d1f` | `rgba(0,0,0,0.1)` |
| info | `rgba(0,113,227,0.10)` | `#0071e3` | `rgba(0,113,227,0.25)` |
| success (= "good/active", Apple convention: blue, not green) | `rgba(0,113,227,0.08)` | `#0066cc` | `rgba(0,113,227,0.25)` |
| warn (emphasized neutral, no amber) | `#f5f5f7` | `#1d1d1f` | `1px #1d1d1f` |
| danger (ONLY warm color, desaturated Apple red) | `rgba(255,59,48,0.10)` | `#d70015` | `rgba(255,59,48,0.25)` |

- `ProgressBar` fill → `var(--color-apple-blue)` (not emerald-500).
- `Stat` accents → neutral `#1d1d1f`, info/success `#0071e3`, warn `#1d1d1f`, danger `#d70015`.
- Keep the Badge `rounded-full` pill shape (already correct).

### 5.8 Recommended build order
1. `globals.css @theme` — swap token block.
2. New `components/glass-nav.tsx` (client) — shared full-screen hamburger overlay.
3. New `components/pill-button.tsx` + `card.tsx` (or extend `ui.tsx`).
4. Rewrite `marketing-shell.tsx` → glass-nav + black footer.
5. Rewrite `page.tsx` → dark/light alternation + resource grid + dark/featured cards + tools-first order, primary CTA → free assessment (not login).
6. Rewrite `shell.tsx` → glass-nav-only (drop sidebar + mobile strip).
7. Patch `types.ts` `TONE_CLASS` + `ui.tsx` accents.
8. Verify with the build (port 3001).

---

## 6. Portal / Back-Office Redesign

The portal and the back office are the **same product** as the landing — a client onboarded onto bRRAIn must feel zero jump from the free tool to the logged-in app. The current `shell.tsx` violates the hard constraint twice (a `w-60` navy sidebar on `lg`, plus a `lg:hidden` horizontal scroll strip on mobile) — **both are removed.**

**Nav:** rewrite `shell.tsx` to use the **same `glass-nav.tsx`** component as the landing — one fixed translucent glass top bar (`rgba(0,0,0,0.82)` + blur, Inter, pill buttons) carrying a single hamburger that opens the full-screen overlay at **every** width. Only the nav array and the `brand` label differ between landing, `/portal`, and `/admin`. Active route highlighted with `--apple-blue`. User identity + Sign Out live either at the right of the bar or as the last block in the overlay (replacing the old sidebar footer).

**Surfaces & color:** app background `--light-bg` (#f5f5f7); content cards white, `radius 18px`, the pgco shadow; all action buttons → pill system; slate borders → hairline `rgba(0,0,0,0.1)`. Keep admin information density but swap `rounded-lg` → pill and apply the restrained status badges (§5.7). Retire all navy/gold.

**Portal IA (expand beyond the current single "Overview" stub) — delivery-shaped, role-gated:**
`Overview · Engagement · Milestones · RAID · Status & Reports · Documents · Invoices · Support`. Clients get read/acknowledge; back-office gets full control. This mirrors the primitives already running in `/admin` (Charter, Milestone, Task, Document, Invoice) and makes the "one platform your team is onboarded onto" claim real rather than asserted.

**Resource-driven empty states** (keep the tools theme alive post-signup and pull users toward the engagement CTA):
- *No tool results yet:* **Heading** "No results yet." **Subcopy** "Run an assessment or calculator from the library and its output lands here, attached to your engagement." **CTA** "Browse the tools".
- *Dashboard not populated:* "Run an assessment to populate this dashboard."

**Retention/upsell surface:** the portal's default logged-in view should surface the client's own saved tool results + score history. Where a saved tool result shows a low/expensive gap, render a contextual **"Book a working session with Provecta"** CTA tied to that specific gap (converts far better than a generic "Contact us" because it answers "why now" with the client's own data).
