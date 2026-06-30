import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { MarketingShell } from "@/components/marketing-shell";
import { ResourceLibrary, type Resource } from "@/components/resource-library";
import { CASE_STUDIES } from "@/content/portfolio";

export const metadata: Metadata = {
  title: "Provecta Group — The business operations toolkit, and the firm that runs it",
  description:
    "Free assessments, calculators, templates, and playbooks to find where revenue leaks and operations drag — then the team that fixes it. Built on bRRAIn.",
};

const SECTION: React.CSSProperties = { padding: "clamp(4rem, 8vw, 7rem) 0" };

const RESOURCES: Resource[] = [
  { id: "revops-audit", type: "Assessment", title: "RevOps Audit", featured: true, href: "/tools/revops-audit", actionLabel: "Start the assessment",
    desc: "39 questions across lead-to-deal, CRM, and reporting. Returns a scored gap map and the three fixes with the highest payback." },
  { id: "ai-readiness", type: "Assessment", title: "AI Readiness Assessment", href: "/tools/ai-readiness", actionLabel: "Run the assessment",
    desc: "Score where AI removes manual work across your operations — not where it adds another chatbot. Get a readiness band and a sequenced rollout." },
  { id: "os-scorecard", type: "Assessment", title: "Operating-System Health Scorecard", href: "/tools/os-health", actionLabel: "Run the scorecard",
    desc: "Rate each function against a 5-level maturity model. Get one operating-system score and a sequenced 90-day roadmap." },
  { id: "rev-leak", type: "Calculator", title: "Revenue-Leakage Calculator", href: "/tools/revenue-leakage", actionLabel: "Open the calculator",
    desc: "Enter your funnel volumes and conversion rates. See the dollars dropping out between lead and closed deal, stage by stage." },
  { id: "ops-drag", type: "Calculator", title: "Operations Drag Estimator", href: "/tools/operations-drag", actionLabel: "Open the calculator",
    desc: "Estimate the hours per month your team loses to manual work — and what reclaiming them is worth at your loaded cost." },
  { id: "crm-template", type: "Template", title: "CRM Architecture Template", href: "/downloads/crm-architecture-template.html", actionLabel: "Download free", download: true, free: true,
    desc: "The field, stage, and automation structure behind our client CRM builds. Download it, or have us implement it.",
    related: { label: "The single source of truth services firms miss", href: "/blog/single-source-of-truth-for-services-firms" } },
  { id: "os-onepager", type: "Template", title: "Operating-System One-Pager", href: "/downloads/operating-system-one-pager.html", actionLabel: "Download free", download: true, free: true,
    desc: "A single-page canvas mapping engagements, projects, money, and support into one source of truth — the first artifact we build in every engagement." },
  { id: "gtm-playbook", type: "Playbook", title: "GTM & Sales-Process Playbook", href: "/downloads/gtm-sales-process-playbook.html", actionLabel: "Download free", download: true, free: true,
    desc: "The sales-process architecture we deploy on engagements, written as a step-by-step playbook you can run yourself.",
    related: { label: "Why we became the first Business Ops firm on bRRAIn", href: "/blog/first-business-operations-firm-on-brrain" } },
];

const STEPS = [
  { n: "1", t: "Diagnose.", d: "Run any assessment or calculator free and see your scored gaps in dollars and hours." },
  { n: "2", t: "Save.", d: "Create a portal account to store your results, track your score over time, and benchmark against your sector." },
  { n: "3", t: "Act.", d: "Where a gap is too costly to leave, bring in Provecta to build and run the fix on the same platform you signed in to." },
];

const SERVICES = [
  { t: "Business Operations Design", d: "Your engagements, projects, money, and support modeled as one source of truth." },
  { t: "Organization-wide AI Implementation", d: "AI deployed across your operations, not a single chatbot." },
  { t: "Revenue Operations", d: "CRM architecture, lead-to-deal automation, and dashboards leadership actually uses." },
  { t: "Custom Platforms", d: "Bespoke software at a fraction of traditional dev-shop cost, delivered on a platform your team is onboarded onto." },
];

export default async function Landing() {
  const posts = await prisma.blogPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 6,
  });

  const insightResources: Resource[] = posts.map((p) => ({
    id: p.id,
    type: "Insight",
    title: p.title,
    desc: p.excerpt,
    href: `/blog/${p.slug}`,
    actionLabel: "Read the insight",
  }));
  const resources = [...RESOURCES, ...insightResources];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Provecta Group",
        url: "https://www.pgco.world",
        logo: "https://www.pgco.world/provecta-logo.png",
        description: "Business operations firm and resource platform — assessments, calculators, templates, and playbooks for operational efficiency and revenue growth, built on bRRAIn.",
        parentOrganization: { "@type": "Organization", name: "Genius Co" },
      },
      {
        "@type": "WebSite",
        name: "Provecta Group",
        url: "https://www.pgco.world",
      },
    ],
  };

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* 1 — Hero (dark) */}
      <section className="hero">
        <div className="hero__grid" />
        <div className="hero__content pgcontainer">
          <p className="eyebrow" style={{ color: "var(--bright-blue)" }}>Business Operations Toolkit</p>
          <h1 className="pg" style={{ color: "#fff", margin: "1rem auto", maxWidth: 760 }}>
            The operations toolkit, and the firm that runs it for you.
          </h1>
          <p style={{ color: "var(--text-white-secondary)", fontSize: "1.31rem", maxWidth: 600, margin: "0 auto 2rem" }}>
            Free assessments, calculators, templates, and playbooks to find where revenue leaks and operations drag —
            then the team that fixes it. Built on bRRAIn, the same operating system we run our own firm on.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "3.5rem" }}>
            <Link href="#library" className="btn btn-primary">Browse the free toolkit</Link>
            <Link href="#what-we-do" className="btn-link btn-link--light">See what we do →</Link>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "2.5rem", flexWrap: "wrap" }}>
            {[[String(RESOURCES.length), "free tools & resources"], ["3", "free downloads"], ["bRRAIn", "the platform we run on"]].map(([n, l]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", fontWeight: 600, color: "#fff", lineHeight: 1.07 }}>
                  <span style={{ color: "var(--bright-blue)" }}>{n}</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#fff", marginTop: "0.3rem" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2 — Interactive Resource Library (light) */}
      <section id="library" className="section-light" style={SECTION}>
        <div className="pgcontainer">
          <div style={{ textAlign: "center", maxWidth: 660, margin: "0 auto 2.5rem" }}>
            <p className="eyebrow">The Library</p>
            <h2 className="pg" style={{ margin: "0.75rem 0", color: "#1d1d1f" }}>Browse the toolkit. Diagnose first, decide second.</h2>
            <p>
              Filter by what you need — assessments, calculators, templates, playbooks, and insights. Run any tool free;
              templates and playbooks download free, no account required.
            </p>
          </div>
          <ResourceLibrary resources={resources} />
        </div>
      </section>

      {/* 3 — How it works (dark) */}
      <section className="section-dark" style={SECTION}>
        <div className="pgcontainer">
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 3rem" }}>
            <p className="eyebrow" style={{ color: "var(--bright-blue)" }}>How it works</p>
            <h2 className="pg" style={{ margin: "0.75rem 0", color: "#fff" }}>From a free tool to a fixed operation, in three steps.</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="darkcard" style={{ borderRadius: 18 }}>
                <div style={{ fontSize: "2rem", fontWeight: 600, color: "var(--bright-blue)" }}>{s.n}</div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 600, margin: "0.5rem 0", color: "#fff" }}>{s.t}</h3>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.95rem" }}>{s.d}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
            <Link href="/login" className="btn btn-primary">Create your portal account</Link>
          </div>
        </div>
      </section>

      {/* 4 — Proof / numbers (light) */}
      <section className="section-light" style={SECTION}>
        <div className="pgcontainer" style={{ textAlign: "center", maxWidth: 760, marginInline: "auto" }}>
          <p className="eyebrow">Evidence</p>
          <h2 className="pg" style={{ margin: "0.75rem 0", color: "#1d1d1f" }}>We run our own firm on the platform we sell you.</h2>
          <p>
            11 operations modules on one source of truth, built on bRRAIn. Ecotecture / Sierra Homes Tower —
            project-management contract signed and active. Premier Realty — automated revenue-operations build signed,
            delivered at roughly 40% below a traditional dev-shop quote. Every tool above is a working slice of an
            engagement we deliver.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "3rem", flexWrap: "wrap", margin: "2.5rem 0 1.5rem" }}>
            {[["11", "operations modules"], ["~40%", "below dev-shop cost"], ["2", "signed engagements"]].map(([n, l]) => (
              <div key={l}>
                <div style={{ fontSize: "2.5rem", fontWeight: 600, color: "#1d1d1f" }}>{n}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{l}</div>
              </div>
            ))}
          </div>
          <Link href="/portfolio" className="btn btn-outline-dark" style={{ border: "1px solid var(--link-blue)", color: "var(--link-blue)" }}>
            See our work
          </Link>
        </div>
      </section>

      {/* 4b — Selected Work (dark) */}
      <section id="work" className="section-dark" style={SECTION}>
        <div className="pgcontainer">
          <div style={{ textAlign: "center", maxWidth: 660, margin: "0 auto 3rem" }}>
            <p className="eyebrow" style={{ color: "var(--bright-blue)" }}>Selected work</p>
            <h2 className="pg" style={{ margin: "0.75rem 0", color: "#fff" }}>Operating systems we built — then ran.</h2>
            <p style={{ color: "var(--text-white-secondary)" }}>
              From the platform we run our own firm on, to go-to-market engines and AI-native intelligence products.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {CASE_STUDIES.map((c) => (
              <Link key={c.slug} href={`/portfolio/${c.slug}`} className="darkcard" style={{ borderRadius: 18, borderTop: `3px solid ${c.accent}`, textDecoration: "none", display: "block" }}>
                <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255,255,255,0.45)" }}>{c.sector}</div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 600, margin: "0.4rem 0", color: "#fff" }}>{c.name}</h3>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", lineHeight: 1.5 }}>{c.summary}</p>
                <div style={{ marginTop: "0.9rem", color: "var(--bright-blue)", fontWeight: 600, fontSize: "0.85rem" }}>Read the case study →</div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
            <Link href="/portfolio" className="btn btn-primary">See all our work</Link>
          </div>
        </div>
      </section>

      {/* 5 — What We Do (dark) */}
      <section id="what-we-do" className="section-dark" style={SECTION}>
        <div className="pgcontainer">
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 3rem" }}>
            <p className="eyebrow" style={{ color: "var(--bright-blue)" }}>What we do</p>
            <h2 className="pg" style={{ margin: "0.75rem 0", color: "#fff" }}>When the toolkit isn't enough, we build and run it.</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {SERVICES.map((s) => (
              <div key={s.t} className="darkcard" style={{ borderRadius: 18 }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.5rem", color: "#fff" }}>{s.t}</h3>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.95rem" }}>{s.d}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
            <Link href="mailto:hello@pgco.world?subject=Book a working session" className="btn btn-primary">Book a working session</Link>
          </div>
        </div>
      </section>

      {/* 6 — Final CTA (dark) */}
      <section className="section-dark" style={{ ...SECTION, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="pgcontainer" style={{ textAlign: "center", maxWidth: 640, marginInline: "auto" }}>
          <p className="eyebrow" style={{ color: "var(--bright-blue)" }}>Start here</p>
          <h2 className="pg" style={{ margin: "0.75rem 0", color: "#fff" }}>Find your most expensive gap this week.</h2>
          <p style={{ color: "var(--text-white-secondary)" }}>
            Run a free assessment, save the result to your portal, and decide what to fix yourself and what to hand us.
            No sales call to get started.
          </p>
          <div style={{ marginTop: "2rem" }}>
            <Link href="#library" className="btn btn-primary">Browse the free toolkit</Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
