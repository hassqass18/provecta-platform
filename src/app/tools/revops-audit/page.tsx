import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";
import { RevOpsForm } from "./revops-form";

export const metadata: Metadata = {
  title: "RevOps Audit — Provecta Group",
  description: "A free scored diagnostic across lead-to-deal, CRM, and reporting. Get your gap map and the three highest-payback fixes.",
};

export default function RevOpsAuditPage() {
  return (
    <MarketingShell>
      <section className="section-dark" style={{ padding: "clamp(3rem, 7vw, 5rem) 0", minHeight: "80vh" }}>
        <div className="pgcontainer" style={{ maxWidth: 760 }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <p className="eyebrow" style={{ color: "var(--bright-blue)" }}>Assessment · Free</p>
            <h1 className="pg" style={{ color: "#fff", margin: "0.75rem 0" }}>RevOps Audit</h1>
            <p style={{ color: "var(--text-white-secondary)", maxWidth: 560, margin: "0 auto" }}>
              Answer a few questions about your revenue engine. We return a scored gap map and the three fixes with the
              highest payback — created straight in our CRM so a specialist can follow up.
            </p>
          </div>
          <RevOpsForm />
        </div>
      </section>
    </MarketingShell>
  );
}
