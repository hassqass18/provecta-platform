"use client";

import { useState } from "react";
import Link from "next/link";
import { ResourceCover, type CoverKind } from "./resource-cover";

export type Resource = {
  id: string;
  type: "Assessment" | "Calculator" | "Template" | "Playbook" | "Insight";
  title: string;
  desc: string;
  href: string;
  actionLabel: string;
  download?: boolean;
  free?: boolean;
  featured?: boolean;
  related?: { label: string; href: string };
};

const TABS = ["All", "Assessments", "Calculators", "Templates", "Playbooks", "Insights"] as const;
const TAB_TYPE: Record<string, Resource["type"]> = {
  Assessments: "Assessment",
  Calculators: "Calculator",
  Templates: "Template",
  Playbooks: "Playbook",
  Insights: "Insight",
};

export function ResourceLibrary({ resources }: { resources: Resource[] }) {
  const [tab, setTab] = useState<string>("All");
  const filtered = tab === "All" ? resources : resources.filter((r) => r.type === TAB_TYPE[tab]);
  const count = (t: string) => (t === "All" ? resources.length : resources.filter((r) => r.type === TAB_TYPE[t]).length);

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "2.5rem" }}>
        {TABS.map((t) => {
          const active = t === tab;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="btn btn-sm"
              style={{
                background: active ? "var(--apple-blue)" : "#fff",
                color: active ? "#fff" : "#1d1d1f",
                border: active ? "1px solid var(--apple-blue)" : "1px solid rgba(0,0,0,0.12)",
              }}
            >
              {t}
              <span style={{ opacity: 0.55, marginLeft: 4 }}>{count(t)}</span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((r) => (
          <div
            key={r.id}
            className="reslift"
            style={{ background: "#fff", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column" }}
          >
            <div style={{ position: "relative" }}>
              <ResourceCover kind={r.type.toLowerCase() as CoverKind} label={r.type} />
              {r.featured ? (
                <span style={pill("var(--apple-blue)", "#fff")}>Recommended</span>
              ) : r.free && r.download ? (
                <span style={pill("#fff", "#0071e3")}>Free download</span>
              ) : null}
            </div>
            <div style={{ padding: "1.25rem 1.25rem 1.5rem", display: "flex", flexDirection: "column", flex: 1 }}>
              <span className="eyebrow" style={{ color: "var(--apple-blue)" }}>{r.type}</span>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 600, margin: "0.4rem 0", color: "#1d1d1f" }}>{r.title}</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", flex: 1 }}>{r.desc}</p>
              {r.related ? (
                <Link href={r.related.href} style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--link-blue)" }}>
                  Related insight: {r.related.label} →
                </Link>
              ) : null}
              {r.download ? (
                <a href={r.href} download className="btn-link" style={{ marginTop: "0.9rem", color: "var(--link-blue)", fontWeight: 500 }}>
                  ↓ {r.actionLabel}
                </a>
              ) : (
                <Link href={r.href} className="btn-link" style={{ marginTop: "0.9rem", color: "var(--link-blue)", fontWeight: 500 }}>
                  {r.actionLabel} →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p style={{ textAlign: "center", color: "var(--text-secondary)", marginTop: "2rem" }}>Nothing here yet.</p>
      ) : null}
    </div>
  );
}

function pill(bg: string, color: string): React.CSSProperties {
  return {
    position: "absolute",
    top: 12,
    right: 12,
    background: bg,
    color,
    fontSize: "0.65rem",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "4px 10px",
    borderRadius: 999,
    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
  };
}
