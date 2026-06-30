import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/marketing-shell";
import { CASE_STUDIES, getCaseStudy } from "@/content/portfolio";

export function generateStaticParams() {
  return CASE_STUDIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = getCaseStudy(slug);
  if (!c) return { title: "Case study — Provecta Group" };
  return {
    title: `${c.name} — Provecta Group`,
    description: c.summary,
    openGraph: { title: `${c.name} — Provecta Group`, description: c.summary },
  };
}

const SECTION: React.CSSProperties = { padding: "clamp(3rem, 6vw, 5rem) 0" };

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getCaseStudy(slug);
  if (!c) notFound();

  return (
    <MarketingShell>
      {/* Hero */}
      <section className="hero" style={{ minHeight: "auto", paddingBottom: "clamp(2.5rem,5vw,4rem)" }}>
        <div className="hero__grid" />
        <div className="hero__content pgcontainer" style={{ textAlign: "left", maxWidth: 900 }}>
          <Link href="/portfolio" style={{ color: "var(--bright-blue)", fontSize: "0.85rem", fontWeight: 600 }}>← Our Work</Link>
          <p className="eyebrow" style={{ color: "var(--bright-blue)", marginTop: "1.25rem" }}>{c.sector} · {c.location} · {c.year}</p>
          <h1 className="pg" style={{ color: "#fff", margin: "0.75rem 0", textAlign: "left", maxWidth: 820 }}>{c.name}</h1>
          <p style={{ color: "var(--text-white-secondary)", fontSize: "1.25rem", maxWidth: 700 }}>{c.tagline}</p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", marginTop: "0.75rem" }}>Client: {c.client}</p>

          <div style={{ display: "flex", gap: "clamp(1.25rem, 5vw, 2.5rem)", flexWrap: "wrap", marginTop: "2.25rem" }}>
            {c.stats.map((s) => (
              <div key={s.label} style={{ minWidth: 0 }}>
                <div style={{ fontSize: "clamp(1.6rem, 6vw, 2.4rem)", fontWeight: 600, color: "#fff", lineHeight: 1.05 }}>
                  <span style={{ color: c.accent }}>{s.value}</span>
                </div>
                <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", maxWidth: 170, marginTop: "0.25rem" }}>{s.label}</div>
              </div>
            ))}
          </div>
          {c.liveUrl && !c.liveUrl.includes("/portfolio/") ? (
            <div style={{ marginTop: "2rem" }}>
              <a href={c.liveUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Visit the live site ↗</a>
            </div>
          ) : null}
        </div>
      </section>

      {/* Hero image band */}
      {c.hero ? (
        <div style={{ position: "relative", width: "100%", aspectRatio: "21/9", maxHeight: 560, background: "#000" }}>
          <Image src={c.hero} alt={c.name} fill priority sizes="100vw" style={{ objectFit: "cover" }} />
        </div>
      ) : null}

      {/* The challenge (light) */}
      <section className="section-light" style={SECTION}>
        <div className="pgcontainer" style={{ maxWidth: 820 }}>
          <p className="eyebrow">The challenge</p>
          <p style={{ color: "#1d1d1f", fontSize: "1.25rem", lineHeight: 1.6, marginTop: "0.75rem" }}>{c.challenge}</p>
        </div>
      </section>

      {/* What we built (dark) */}
      <section className="section-dark" style={SECTION}>
        <div className="pgcontainer" style={{ maxWidth: 880 }}>
          <p className="eyebrow" style={{ color: "var(--bright-blue)" }}>What we delivered</p>
          <h2 className="pg" style={{ color: "#fff", margin: "0.75rem 0 1.5rem", fontSize: "clamp(1.5rem,3vw,2rem)" }}>The build</h2>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "1rem" }}>
            {c.built.map((b, i) => (
              <li key={i} style={{ display: "flex", gap: "0.9rem", color: "rgba(255,255,255,0.8)", fontSize: "1.05rem", lineHeight: 1.55 }}>
                <span style={{ color: c.accent, fontWeight: 700, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Stack (light) */}
      <section className="section-light" style={{ ...SECTION, paddingTop: "clamp(2rem,4vw,3rem)" }}>
        <div className="pgcontainer" style={{ maxWidth: 880 }}>
          <p className="eyebrow">The stack</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginTop: "1rem" }}>
            {c.stack.map((t) => (
              <span key={t} style={{ border: "1px solid #e5e5e7", borderRadius: 980, padding: "0.4rem 0.9rem", fontSize: "0.85rem", color: "#1d1d1f", background: "#fff" }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      {c.gallery && c.gallery.length > 0 ? (
        <section className="section-light" style={{ paddingBottom: "clamp(2.5rem,5vw,4rem)" }}>
          <div className="pgcontainer">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {c.gallery.map((src, i) => (
                <div key={i} style={{ position: "relative", width: "100%", aspectRatio: "4/3", borderRadius: 14, overflow: "hidden", background: "#0a0a0a" }}>
                  <Image src={src} alt={`${c.name} — ${i + 1}`} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" style={{ objectFit: "cover" }} />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Results (dark) */}
      <section className="section-dark" style={SECTION}>
        <div className="pgcontainer" style={{ maxWidth: 880 }}>
          <p className="eyebrow" style={{ color: "var(--bright-blue)" }}>The outcome</p>
          <h2 className="pg" style={{ color: "#fff", margin: "0.75rem 0 1.5rem", fontSize: "clamp(1.5rem,3vw,2rem)" }}>Results</h2>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "1rem" }}>
            {c.results.map((r, i) => (
              <li key={i} style={{ display: "flex", gap: "0.9rem", color: "rgba(255,255,255,0.85)", fontSize: "1.08rem", lineHeight: 1.55 }}>
                <span style={{ color: c.accent, flexShrink: 0 }}>✓</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: "2.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Link href="mailto:hello@pgco.world?subject=Book a working session" className="btn btn-primary">Book a working session</Link>
            <Link href="/portfolio" className="btn-link btn-link--light">See more work →</Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
