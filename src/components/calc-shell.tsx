import type { ReactNode } from "react";
import { MarketingShell } from "./marketing-shell";

// Shared scaffold for a tool/calculator page (dark hero + content area).
export function CalcShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <MarketingShell>
      <section className="section-dark" style={{ padding: "clamp(3rem, 7vw, 5rem) 0", minHeight: "80vh" }}>
        <div className="pgcontainer" style={{ maxWidth: 760 }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <p className="eyebrow" style={{ color: "var(--bright-blue)" }}>{eyebrow}</p>
            <h1 className="pg" style={{ color: "#fff", margin: "0.75rem 0" }}>{title}</h1>
            <p style={{ color: "var(--text-white-secondary)", maxWidth: 560, margin: "0 auto" }}>{intro}</p>
          </div>
          {children}
        </div>
      </section>
    </MarketingShell>
  );
}
