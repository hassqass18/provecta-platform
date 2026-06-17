"use client";

import { useState } from "react";

const FIELD = "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#2997ff] focus:outline-none";
const LABEL = "mb-1 block text-xs font-medium text-white/60";

export function RevOpsForm() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    try {
      const res = await fetch("/api/revops-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Submission failed");
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#1c1c1e] p-8 text-center">
        <div className="text-2xl font-semibold text-white">Audit received.</div>
        <p className="mt-2 text-white/60">
          Your RevOps audit is in. A Provecta specialist will review your gap map and follow up within one business day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-[#1c1c1e] p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL}>First name *</label>
          <input name="firstName" required className={FIELD} placeholder="Jane" />
        </div>
        <div>
          <label className={LABEL}>Last name</label>
          <input name="lastName" className={FIELD} placeholder="Doe" />
        </div>
        <div>
          <label className={LABEL}>Work email *</label>
          <input name="email" type="email" required className={FIELD} placeholder="jane@company.com" />
        </div>
        <div>
          <label className={LABEL}>Company *</label>
          <input name="company" required className={FIELD} placeholder="Company Inc." />
        </div>
        <div>
          <label className={LABEL}>Role</label>
          <input name="role" className={FIELD} placeholder="VP Revenue" />
        </div>
        <div>
          <label className={LABEL}>Phone</label>
          <input name="phone" className={FIELD} placeholder="+1…" />
        </div>
        <div>
          <label className={LABEL}>Current CRM</label>
          <select name="currentCRM" className={FIELD} defaultValue="">
            <option value="">Select…</option>
            <option>None / spreadsheets</option>
            <option>HubSpot</option>
            <option>Salesforce</option>
            <option>Zoho</option>
            <option>Pipedrive</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>Avg deal size</label>
          <select name="avgDealSize" className={FIELD} defaultValue="">
            <option value="">Select…</option>
            <option>Under $5K</option>
            <option>$5K–$25K</option>
            <option>$25K–$100K</option>
            <option>$100K+</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>Sales cycle length</label>
          <select name="salesCycleLength" className={FIELD} defaultValue="">
            <option value="">Select…</option>
            <option>Under 30 days</option>
            <option>1–3 months</option>
            <option>3–6 months</option>
            <option>6+ months</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>Urgency</label>
          <select name="urgencyLevel" className={FIELD} defaultValue="">
            <option value="">Select…</option>
            <option>Exploring</option>
            <option>This quarter</option>
            <option>Urgent — actively losing revenue</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>Budget status</label>
          <select name="budgetStatus" className={FIELD} defaultValue="">
            <option value="">Select…</option>
            <option>No budget yet</option>
            <option>Budget being scoped</option>
            <option>Budget approved</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>Industry</label>
          <input name="industry" className={FIELD} placeholder="SaaS, Real Estate…" />
        </div>
      </div>
      <div className="mt-4">
        <label className={LABEL}>Biggest revenue challenge</label>
        <textarea name="revenueChallenge" rows={3} className={FIELD} placeholder="What's the #1 thing leaking revenue or dragging on the team?" />
      </div>
      <div className="mt-4">
        <label className={LABEL}>6-month goal</label>
        <input name="sixMonthGoal" className={FIELD} placeholder="What does success look like in 6 months?" />
      </div>

      {error ? <div className="mt-4 text-sm text-[#ff6961]">{error}</div> : null}

      <button type="submit" disabled={submitting} className="btn btn-primary mt-6 w-full disabled:opacity-60">
        {submitting ? "Submitting…" : "Get my RevOps gap map"}
      </button>
      <p className="mt-3 text-center text-xs text-white/40">Free. No sales call to get started. Goes straight to Provecta.</p>
    </form>
  );
}
