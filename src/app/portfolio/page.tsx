import Link from "next/link";
import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";
import { CASE_STUDIES, type CaseStudy } from "@/content/portfolio";

export const metadata: Metadata = {
  title: "Our Work — Provecta Group",
  description:
    "Selected engagements by Provecta Group — the business-operations platform built on bRRAIn, plus real-estate go-to-market, frontier private-equity, proptech and institutional-intelligence builds.",
};

const SECTION: React.CSSProperties = { padding: "clamp(3.5rem, 7vw, 6rem) 0" };

function StatRow({ stats, dark }: { stats: CaseStudy["stats"]; dark?: boolean }) {
  return (
    <div style={{ display: "flex", gap: "1.75rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
      {stats.map((s) => (
        <div key={s.label}>
          <div style={{ fontSize: "1.5rem", fontWeight: 600, color: dark ? "#fff" : "#1d1d1f", lineHeight: 1.1 }}>{s.value}</div>
          <div style={{ fontSize: "0.72rem", color: dark ? "rgba(255,255,255,0.55)" : "var(--text-secondary)", maxWidth: 150 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Portfolio() {
  const featured = CASE_STUDIES.find((c) => c.featured)!;
  const rest = CASE_STUDIES.filter((c) => !c.featured);

  return (
    <MarketingShell>
      {/* Hero */}
      <section className="hero" style={{ minHeight: "auto", paddingBottom: "clamp(3rem,6vw,5rem)" }}>
        <div className="hero__grid" />
        <div className="hero__content pgcontainer">
          <p className="eyebrow" style={{ color: "var(--bright-blue)" }}>Our Work</p>
          <h1 className="pg" style={{ color: "#fff", margin: "1rem auto", maxWidth: 820 }}>
            We build operating systems — then run them.
          </h1>
          <p style={{ color: "var(--text-white-secondary)", fontSize: "1.2rem", maxWidth: 640, margin: "0 auto" }}>
            From the platform we run our own firm on, to go-to-market engines, investor platforms and AI-native
            intelligence products — selected engagements, the problem each solved, and what we delivered.
          </p>
        </div>
      </section>

      {/* Featured — the platform, built on bRRAIn */}
      <section className="section-dark" style={{ ...SECTION, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="pgcontainer">
          <Link href={`/portfolio/${featured.slug}`} style={{ textDecoration: "none" }}>
            <div className="darkcard" style={{ borderRadius: 22, padding: "clamp(1.5rem,3vw,2.5rem)", borderTop: `3px solid ${featured.accent}` }}>
              <p className="eyebrow" style={{ color: "var(--bright-blue)" }}>Featured · Built on bRRAIn</p>
              <h2 className="pg" style={{ color: "#fff", margin: "0.6rem 0", fontSize: "clamp(1.6rem,3vw,2.2rem)" }}>{featured.name}</h2>
              <p style={{ color: "rgba(255,255,255,0.72)", fontSize: "1.1rem", maxWidth: 720 }}>{featured.summary}</p>
              <StatRow stats={featured.stats} dark />
              <div style={{ marginTop: "1.75rem", color: "var(--bright-blue)", fontWeight: 600 }}>Read the case study →</div>
            </div>
          </Link>
        </div>
      </section>

      {/* The rest */}
      <section className="section-light" style={SECTION}>
        <div className="pgcontainer">
          <div className="grid gap-6 md:grid-cols-2">
            {rest.map((c) => (
              <Link key={c.slug} href={`/portfolio/${c.slug}`} style={{ textDecoration: "none" }}>
                <div className="rounded-2xl border border-slate-200 bg-white p-7 h-full" style={{ borderTop: `3px solid ${c.accent}` }}>
                  <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
                    {c.sector} · {c.location} · {c.year}
                  </div>
                  <h3 style={{ fontSize: "1.45rem", fontWeight: 600, color: "#1d1d1f", margin: "0.5rem 0 0.25rem" }}>{c.name}</h3>
                  <p style={{ color: "#1d1d1f", opacity: 0.55, fontSize: "0.82rem", marginBottom: "0.75rem" }}>{c.client}</p>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.97rem", lineHeight: 1.55 }}>{c.summary}</p>
                  <StatRow stats={c.stats} />
                  <div style={{ marginTop: "1.5rem", color: "var(--link-blue)", fontWeight: 600, fontSize: "0.95rem" }}>Read the case study →</div>
                </div>
              </Link>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: "3.5rem" }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
              Every engagement runs on the same platform you can sign in to today.
            </p>
            <Link href="mailto:hello@pgco.world?subject=Book a working session" className="btn btn-primary">Book a working session</Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
