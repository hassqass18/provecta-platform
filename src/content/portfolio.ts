// Curated, public-facing portfolio case studies for Provecta Group.
// Honest framing: "Delivered" = shipped; targets/in-progress are labelled as such.

export type Stat = { value: string; label: string };
export type CaseStudy = {
  slug: string;
  name: string;
  client: string;
  sector: string;
  location: string;
  year: string;
  tagline: string;
  accent: string; // hex used for the project's accent
  summary: string; // one/two-line card blurb
  liveUrl?: string;
  featured?: boolean;
  hero?: string; // hero image path under /public; platform uses a gradient instead
  gallery?: string[]; // additional images for the detail page
  stats: Stat[]; // 3 headline numbers
  challenge: string;
  built: string[]; // what Provecta delivered
  stack: string[]; // technologies / methods
  results: string[]; // outcomes — lead with numbers, honest
};

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "provecta-platform",
    name: "Provecta Group — built on bRRAIn",
    client: "Provecta Group (our own operating system)",
    sector: "Business Operations · AI Platform",
    location: "pgco.world",
    year: "2026",
    accent: "#0071e3",
    featured: true,
    liveUrl: "https://www.pgco.world",
    tagline: "The operating system we run our own firm on — and onboard yours onto.",
    summary:
      "We rebuilt our firm as software on top of bRRAIn: one source of truth that is simultaneously our autonomous back office and our clients' portal — running the whole engagement lifecycle, web and mobile.",
    stats: [
      { value: "11", label: "operations modules, one source of truth" },
      { value: "bRRAIn", label: "the AI brain it's built on" },
      { value: "Web + iOS/Android", label: "same data, both surfaces" },
    ],
    challenge:
      "Consulting runs on scattered tools — a CRM here, a drive of documents there, proposals in one app, billing in another. Provecta set out to be the first Business Operations firm built on bRRAIn (Faruq Hunter's AI second-brain): to run our own firm as a single intelligent system, and onboard every client onto that same system so the work, the deliverables and the truth all live in one place.",
    built: [
      "A unified platform that is, at once, Provecta's autonomous back office and each client's portal — project boards, document vault, KPI/SLA/budget dashboards, omnichannel ticketing, billing and a unified payment-intake ledger.",
      "An engagement engine grounded in bRRAIn: drop in a discovery transcript and the system researches the prospect, drafts a tailored proposal, emails it, takes the acceptance, issues credentials and an AI-generated contract, then stages the whole project plan.",
      "Autonomous deliverable production on the real Claude engine — phases, tasks, KPIs and full deliverable content generated and grounded in the firm's knowledge, every artifact landing in an operator review queue before it ever reaches a client.",
      "A hard human-in-the-loop ramp: generation runs autonomously, but every client-facing release is operator-approved, with a tamper-evident audit chain and an honesty gate that refuses unbacked claims.",
      "A native iOS/Android cockpit at full parity — the operator runs the firm and clients see their project, sign agreements and download deliverables from the same data.",
    ],
    stack: ["Next.js 15", "React 19", "Prisma 6", "Neon Postgres + RLS", "Auth.js v5", "Tailwind v4", "Anthropic Claude (tool-use)", "bRRAIn knowledge layer", "Expo / React Native", "Vercel", "Resend"],
    results: [
      "Live at pgco.world — 11 back-office modules on one source of truth, plus a client portal and a published iOS/Android app.",
      "End-to-end engagement funnel verified in production: research → proposal → accept → credentials → AI contract → signed → deliverables → operator approval → client release.",
      "Custom platforms delivered at roughly 40% below a traditional dev-shop quote, because we run the same system we sell.",
      "Bespoke engagements (Sierra Homes, Premier Realty) signed and active — every free tool on our site is a working slice of a real client build.",
    ],
  },
  {
    slug: "grand-malibu",
    name: "The Grand Malibu",
    client: "Sierra USA Homes Ltd",
    sector: "Real Estate · Off-plan GTM",
    location: "Nyali, Mombasa, Kenya",
    year: "2026",
    accent: "#1d235c",
    liveUrl: "https://sierrausahomes.com",
    hero: "/portfolio/grand-malibu/hero.png",
    gallery: ["/portfolio/grand-malibu/g1.png", "/portfolio/grand-malibu/g2.png"],
    tagline: "From zero brand to a full go-to-market system for an 88-unit coastal development — in six weeks.",
    summary:
      "An 88-unit, 3-tower premium development needed 20+ reservations before permit. We built the entire go-to-market engine — brand, assets, CRM, multi-channel campaign, diaspora affiliate network and bank financing materials.",
    stats: [
      { value: "88", label: "units · 3 towers" },
      { value: "20+", label: "pre-permit reservations (target)" },
      { value: "6 wks", label: "brand → live campaign" },
    ],
    challenge:
      "The Grand Malibu — an 88-unit, 3-tower premium development in Nyali, Mombasa — needed 20+ reservation commitments before permit to de-risk funding and accelerate approvals, with ~70% of buyers being Kenyan diaspora across the US, UK and Gulf. It had no brand, no digital assets and no CRM, and an eight-week window to go from concept to a live campaign.",
    built: [
      "Brand foundation: name, logo lockup, navy-and-gold system, voice and messaging hierarchy, and two buyer personas — anchored on a hero differentiator, the only Rooftop Lounge & Restaurant on the coast.",
      "A full digital asset library: 3D render set, floor plans for every unit type, a hero-overlay sales brochure, six hi-res expo banners and the project website.",
      "A Zoho CRM + RevOps build: a three-stage pipeline with lead scoring, a WhatsApp Cloud-API flow with a sub-60-second response SLA, and a 21-day email nurture sequence.",
      "A multi-channel campaign: 12-week organic calendar, Meta/YouTube/LinkedIn funnels, and a diaspora affiliate/broker program with Zoho Deluge commission tracking.",
      "Capital-raise materials: the investor deck and returns model, plus the full KCB bank credit submission, deal economics and valuation package.",
    ],
    stack: ["Zoho CRM + Deluge", "WhatsApp Cloud API", "Meta / YouTube / LinkedIn Ads", "Resend / email nurture", "Figma brand system", "3D rendering", "Excel financial modelling"],
    results: [
      "Pre-launch reservation drive live, targeting 20+ commitments before the Q3 2026 permit window; acceptance targets of ≥5% landing-page conversion, <60s lead response and ≤KES 3,000 cost-per-lead.",
      "A complete, bank-ready capital package delivered (KCB credit submission + investor deck) supporting a ~KES 326M funding-gap close.",
      "Hundreds of production assets — renders, floor plans, brochure, banners, CRM and campaign — shipped in a six-week window.",
    ],
  },
  {
    slug: "msifs",
    name: "MSIFS — Frontier Impact Fund",
    client: "Multinational Strategic Investment Funds",
    sector: "Private Equity · Institutional SaaS",
    location: "East Africa + Central Asia",
    year: "2026",
    accent: "#d87841",
    liveUrl: "https://msifs.com",
    hero: "/portfolio/msifs/hero.png",
    gallery: ["/portfolio/msifs/g1.png", "/portfolio/msifs/g2.png"],
    tagline: "A public site, a gated investor portal and an AI deal-vetting engine for a $200M frontier-impact fund.",
    summary:
      "A newly-formed $200M critical-minerals & infrastructure fund needed institutional credibility fast. We built msifs.com, a security-hardened investor portal, and a Claude-powered intelligence and deal-vetting platform.",
    stats: [
      { value: "$200M", label: "fund · 10-year close-ended" },
      { value: "800+", label: "catalogued intelligence sources" },
      { value: "MFA", label: "mandatory · audit-logged" },
    ],
    challenge:
      "MSIFS — a newly-formed $200M, 10-year fund targeting critical minerals and infrastructure across East Africa and Central Asia — had a sophisticated GP team but no public platform to anchor LP confidence and deal flow. It needed institutional-grade credibility, a secure investor center and analyst tooling, built from fund formation to live in six weeks.",
    built: [
      "A public corporate site (msifs.com): fund strategy, a three-pillar methodology, regional pages, team and an intelligence library.",
      "A gated investor portal with mandatory TOTP MFA: dashboard, portfolio, a slider-driven fund model (IRR/MOIC/NAV + investor waterfall), impact mapping and an admin console.",
      "An AI intelligence assistant and an internal deal-vetting tool that turns a deck excerpt into a structured 10-section IC memo — both citation-gated to primary and anchor sources.",
      "A documented intelligence backbone of 800+ primary and premium sources across 63 countries, refreshed quarterly.",
      "A hardened security posture: Argon2id auth, refresh-token rotation, rate limiting, a full admin audit log, HSTS preload, CSP and strict headers.",
    ],
    stack: ["Vercel", "Supabase (Postgres + Auth + Storage)", "Node.js serverless", "Anthropic Claude (Haiku/Sonnet)", "Upstash Redis", "Chart.js", "Tailwind CSS", "Resend"],
    results: [
      "msifs.com live on Vercel with a production-grade, MFA-gated investor portal.",
      "800+ sources catalogued and citation-gated so the AI only ever surfaces verifiable, primary references.",
      "Security: HSTS preload-eligible, CSP + X-Frame-Options, rate-limiting and a complete admin audit trail — institutional from day one.",
    ],
  },
  {
    slug: "karibu",
    name: "Karibu",
    client: "Karibu (a Genius Co venture)",
    sector: "PropTech · Marketplace",
    location: "Kenya · 47 counties",
    year: "2026",
    accent: "#c82021",
    liveUrl: "https://karibuhome.world",
    hero: "/portfolio/karibu/hero.png",
    gallery: ["/portfolio/karibu/g1.png", "/portfolio/karibu/g2.png"],
    tagline: "A diaspora-first real-estate platform with an AI brain that answers “is this price fair?” — with sources.",
    summary:
      "Kenyan diaspora buyers pay the “Mzungu tax” on portals built for foreign wallets. Karibu is a nationwide marketplace with honest pricing, a native CRM and a citation-gated AI brain — live in production.",
    stats: [
      { value: "Live", label: "in production · karibuhome.world" },
      { value: "47", label: "counties · 43 real listings" },
      { value: "Cited", label: "AI answers, source-gated" },
    ],
    challenge:
      "Kenyan diaspora buyers — established professionals abroad — face the “Mzungu tax”: existing portals optimise for international wallets and inflated agent pricing. Their fear of being scammed outweighs price sensitivity, so they need defensible, ground-truth pricing and a diaspora-native buying experience that doesn't exist on the market.",
    built: [
      "A nationwide listings marketplace across 47 counties, with high-resolution galleries re-hosted from bot-walled portals via a self-hosted headless worker.",
      "A grounded, citation-gated AI copilot that answers natural-language pricing and market questions (“is this Kilimani 4-bed at 28M fair?”) with defensible sources.",
      "A native CRM and deal pipeline: multi-party messaging, a kanban board, contact 360 and a Resend-powered email drip engine.",
      "A diaspora mortgage marketplace (bank referral) plus a consent-gated title-verification workflow and DPA-2019 consent capture at signup.",
    ],
    stack: ["Next.js 15", "Prisma", "Neon Postgres", "Auth.js", "Anthropic Claude (Sonnet/Haiku) + RAG", "Resend", "IntaSend / M-Pesa", "WhatsApp Cloud API", "Playwright", "Vercel"],
    results: [
      "Live in production (karibuhome.world) — 43 real listings, 15 with full high-resolution photo galleries.",
      "An operational AI brain on Claude with source-cited answers at roughly $0.012 per query.",
      "Privacy by design: DPA-2019 consent ledger at signup and a 24-month device-record retention policy enforced on a cron.",
    ],
  },
  {
    slug: "frontier-atlas",
    name: "Frontier Atlas / Index",
    client: "Frontier Atlas (with MSIFS)",
    sector: "Capital Markets · Intelligence",
    location: "Africa + Central Asia · 63 countries",
    year: "2026",
    accent: "#e68250",
    liveUrl: "https://frontier-atlas-pi.vercel.app",
    hero: "/portfolio/frontier-atlas/hero.png",
    gallery: ["/portfolio/frontier-atlas/g1.png", "/portfolio/frontier-atlas/g2.png"],
    tagline: "The citation-gated intelligence layer — and investability index — for the next era of frontier capital.",
    summary:
      "Allocators piece frontier-market decisions together from $50K terminals and hundreds of uncatalogued sources. Frontier Atlas is an AI-native, citation-gated intelligence platform over 800+ vetted sources across 63 countries.",
    stats: [
      { value: "800+", label: "vetted sources · 63 countries" },
      { value: "Tier-0", label: "primary-law citation gating" },
      { value: "Index", label: "cross-region investability score" },
    ],
    challenge:
      "Institutional allocators evaluating critical minerals, infrastructure and FDI across Africa and Central Asia rely on fragmented intelligence — $50K Wood Mackenzie seats, $30K Eurasia Group subscriptions, and hundreds of free but uncatalogued government and DFI sources. No product combines both regions, the full topic stack, AI-native Q&A, citation rigour and a free public tier — and capital can't be committed without a defensible audit trail of sources.",
    built: [
      "Atlas Brain: a grounded, citation-gated AI Q&A engine over a curated reference dataset, answering institutional questions with primary and anchor sources only.",
      "A reference dataset of 800+ catalogued sources across 63 countries and seven categories — multilateral, primary law/gazettes, critical-minerals lists, sanctions/beneficial-ownership, DFI disclosure and macro-stability indicators.",
      "Country and sector deep-dives plus a live project tracker (Lobito Rail, Simandou, GTA corridor) on FDI, extractives governance and the energy transition.",
      "The Frontier Index: a proprietary cross-region investability score blending reserves, FDI flows, governance, sanctions risk, DFI exposure and macro stability.",
    ],
    stack: ["Anthropic Claude (Sonnet/Haiku) + RAG", "Hybrid Postgres + vector + graph store", "Tailwind / Chart.js / Leaflet", "Netlify Functions (prototype)", "Next.js (production)"],
    results: [
      "Reference dataset v2.0: 800+ sources, ~800 verified URLs, 63 countries, with a Tier-0 primary-law layer tracking 2025/26 regulatory changes across six priority jurisdictions.",
      "A live Atlas Brain prototype on Claude with sub-8-second time-to-first-token and citation-gating enforced as a hard database invariant.",
      "Positioned with MSIFS as founding partner for industry convenings — Mining Indaba, Astana Finance Days, Africa CEO Forum.",
    ],
  },
];

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return CASE_STUDIES.find((c) => c.slug === slug);
}
