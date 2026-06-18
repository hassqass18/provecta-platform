"use client";

import { useState } from "react";
import Link from "next/link";
import { CALC_FIELD, CALC_LABEL } from "@/lib/calc";

const DIMS = [
  { id: "awareness", label: "Awareness — does the team know where work, money, and decisions live?" },
  { id: "ssot", label: "Single source of truth — is there one record per client, or scattered copies?" },
  { id: "automation", label: "Automation — how much manual, repeatable work is automated?" },
  { id: "reporting", label: "Reporting — can leadership see the KPIs that matter, live?" },
  { id: "reinforcement", label: "Reinforcement — do new ways of working actually stick?" },
];

function band(score: number): { label: string; note: string } {
  if (score >= 21) return { label: "Optimized", note: "You're operating like a system. Focus on the brain layer and earned autonomy." };
  if (score >= 16) return { label: "Managed", note: "Strong foundation. The fastest wins are in automation and live reporting." };
  if (score >= 11) return { label: "Defined", note: "Processes exist but leak. A single source of truth pays back first." };
  if (score >= 6) return { label: "Reactive", note: "You're running on heroics. Start by mapping the operating system onto one spine." };
  return { label: "Ad-hoc", note: "Everything lives in someone's head. The one-pager is your first 90-day artifact." };
}

export function OsHealthCalc() {
  const [vals, setVals] = useState<Record<string, number>>(Object.fromEntries(DIMS.map((d) => [d.id, 3])));
  const score = Object.values(vals).reduce((s, v) => s + v, 0);
  const pct = Math.round((score / 25) * 100);
  const b = band(score);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#1c1c1e] p-6 sm:p-8">
      <div className="space-y-5">
        {DIMS.map((d) => (
          <div key={d.id}>
            <label className={CALC_LABEL}>{d.label}</label>
            <select
              className={CALC_FIELD}
              value={vals[d.id]}
              onChange={(e) => setVals((v) => ({ ...v, [d.id]: Number(e.target.value) }))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n} — {["Ad-hoc", "Reactive", "Defined", "Managed", "Optimized"][n - 1]}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-[#0071e3] p-6 text-center text-white">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/80">Your operating-system score</div>
        <div className="mt-1 text-4xl font-bold">{score}/25</div>
        <div className="mt-1 text-lg font-semibold">{b.label} · {pct}%</div>
        <p className="mt-2 text-sm text-white/85">{b.note}</p>
      </div>

      <Link href="mailto:hello@pgco.world?subject=Operating-System health review" className="btn btn-primary mt-5 w-full">
        Get your sequenced 90-day roadmap
      </Link>
    </div>
  );
}
