"use client";

import { useState } from "react";
import Link from "next/link";
import { CALC_FIELD, CALC_LABEL, money } from "@/lib/calc";

export function RevenueLeakageCalc() {
  const [leads, setLeads] = useState(120);
  const [deal, setDeal] = useState(15000);
  const [close, setClose] = useState(18);
  const [target, setTarget] = useState(28);

  const eff = Math.max(close, target);
  const current = leads * (close / 100) * deal * 12;
  const potential = leads * (eff / 100) * deal * 12;
  const leak = Math.max(0, potential - current);

  const num = (v: string) => Math.max(0, Number(v) || 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#1c1c1e] p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={CALC_LABEL}>Qualified leads / month</label>
          <input type="number" value={leads} onChange={(e) => setLeads(num(e.target.value))} className={CALC_FIELD} />
        </div>
        <div>
          <label className={CALC_LABEL}>Average deal size ($)</label>
          <input type="number" value={deal} onChange={(e) => setDeal(num(e.target.value))} className={CALC_FIELD} />
        </div>
        <div>
          <label className={CALC_LABEL}>Current close rate (%)</label>
          <input type="number" value={close} onChange={(e) => setClose(num(e.target.value))} className={CALC_FIELD} />
        </div>
        <div>
          <label className={CALC_LABEL}>Achievable close rate (%)</label>
          <input type="number" value={target} onChange={(e) => setTarget(num(e.target.value))} className={CALC_FIELD} />
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-[#0071e3] p-6 text-center text-white">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/80">Annual revenue leaking out of your funnel</div>
        <div className="mt-1 text-4xl font-bold">{money(leak)}</div>
        <div className="mt-1 text-sm text-white/80">{money(leak / 12)} every month</div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 p-4 text-center">
          <div className="text-xs uppercase tracking-wide text-white/50">Current annual</div>
          <div className="mt-1 text-lg font-semibold text-white">{money(current)}</div>
        </div>
        <div className="rounded-lg border border-white/10 p-4 text-center">
          <div className="text-xs uppercase tracking-wide text-white/50">At achievable rate</div>
          <div className="mt-1 text-lg font-semibold text-[#5ab0ff]">{money(potential)}</div>
        </div>
      </div>

      <p className="mt-4 text-xs text-white/40">
        Illustrative. The gap between current and achievable close rate is where RevOps fixes pay back fastest.
      </p>
      <Link href="/tools/revops-audit" className="btn btn-primary mt-5 w-full">Find where it's leaking — run the RevOps Audit</Link>
    </div>
  );
}
