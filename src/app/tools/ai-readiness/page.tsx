import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";
import { AIForm } from "./ai-form";

export const metadata: Metadata = {
  title: "AI Readiness Assessment — Provecta Group",
  description: "Score where AI removes manual work across your operations. Get a readiness band and a sequenced rollout. Free.",
};

export default function AIReadinessPage() {
  return (
    <MarketingShell>
      <section className="section-dark" style={{ padding: "clamp(3rem, 7vw, 5rem) 0", minHeight: "80vh" }}>
        <div className="pgcontainer" style={{ maxWidth: 720 }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <p className="eyebrow" style={{ color: "var(--bright-blue)" }}>Assessment · Free</p>
            <h1 className="pg" style={{ color: "#fff", margin: "0.75rem 0" }}>AI Readiness Assessment</h1>
            <p style={{ color: "var(--text-white-secondary)", maxWidth: 560, margin: "0 auto" }}>
              Seven questions to score where AI removes manual work across your operations — not where it adds another
              chatbot. Get a readiness band and a sequenced rollout.
            </p>
          </div>
          <AIForm />
        </div>
      </section>
    </MarketingShell>
  );
}
