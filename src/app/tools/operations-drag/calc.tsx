"use client";

import { useState } from "react";
import Link from "next/link";
import { CALC_FIELD, CALC_LABEL, money } from "@/lib/calc";

export function OperationsDragCalc() {
  const [people, setPeople] = useState(8);
  const [hours, setHours] = useState(9);
  const [cost, setCost] = useState(45);
  const [automatable, setAutomatable] = useState(60);

  const num = (v: string) => Math.max(0, Number(v) || 0);
  const weekly = people * hours;
  const annualCost = weekly * 52 * cost;
  const monthlyCost = annualCost / 12;
  const reclaimable = annualCost * (automatable / 100);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#1c1c1e] p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={CALC_LABEL}>People doing manual work</label>
          <input type="number" value={people} onChange={(e) => setPeople(num(e.target.value))} className={CALC_FIELD} />
        </div>
        <div>
          <label className={CALC_LABEL}>Hours/week each on repeatable work</label>
          <input type="number" value={hours} onChange={(e) => setHours(num(e.target.value))} className={CALC_FIELD} />
        </div>
        <div>
          <label className={CALC_LABEL}>Loaded hourly cost ($)</label>
          <input type="number" value={cost} onChange={(e) => setCost(num(e.target.value))} className={CALC_FIELD} />
        </div>
        <div>
          <label className={CALC_LABEL}>% of that work that's automatable</label>
          <input type="number" value={automatable} onChange={(e) => setAutomatable(Math.min(100, num(e.target.value)))} className={CALC_FIELD} />
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-[#0071e3] p-6 text-center text-white">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/80">Annual cost of manual, repeatable work</div>
        <div className="mt-1 text-4xl font-bold">{money(annualCost)}</div>
        <div className="mt-1 text-sm text-white/80">{money(monthlyCost)} / month · {weekly} hours / week</div>
      </div>

      <div className="mt-4 rounded-lg border border-[#2997ff]/30 bg-[#2997ff]/10 p-4 text-center">
        <div className="text-xs uppercase tracking-wide text-white/60">Reclaimable with automation</div>
        <div className="mt-1 text-2xl font-bold text-[#5ab0ff]">{money(reclaimable)} / year</div>
      </div>

      <p className="mt-4 text-xs text-white/40">Illustrative. We split work into eliminate vs. automate before we touch a tool.</p>
      <Link href="/tools/os-health" className="btn btn-primary mt-5 w-full">Score your operating system</Link>
    </div>
  );
}
