"use client";

import { useState } from "react";

const FIELD = "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#2997ff] focus:outline-none";
const LABEL = "mb-1.5 block text-sm font-medium text-white";

type Q = { id: string; label: string; options: { value: string; label: string; points: number }[] };

const QUESTIONS: Q[] = [
  { id: "q1", label: "How widely is AI adopted across your team today?", options: [
    { value: "none", label: "No AI adoption yet", points: 0 },
    { value: "few", label: "1–5 early adopters", points: 1 },
    { value: "some", label: "6–25 people (growing)", points: 2 },
    { value: "most", label: "Company-wide adoption", points: 3 } ] },
  { id: "q2", label: "Which AI tools are in use today?", options: [
    { value: "none", label: "None", points: 0 },
    { value: "chatgpt", label: "ChatGPT / a chatbot", points: 1 },
    { value: "several", label: "Several point tools", points: 2 },
    { value: "integrated", label: "Integrated into workflows", points: 3 } ] },
  { id: "q3", label: "Where would AI help most?", options: [
    { value: "unsure", label: "Not sure yet", points: 0 },
    { value: "support", label: "Support / service", points: 1 },
    { value: "sales", label: "Sales / revenue", points: 2 },
    { value: "ops", label: "Operations / back office", points: 3 } ] },
  { id: "q4", label: "What is the state of your data?", options: [
    { value: "nowhere", label: "Siloed / inaccessible", points: 0 },
    { value: "scattered", label: "Exists but scattered", points: 1 },
    { value: "structured", label: "Structured, mostly clean", points: 2 },
    { value: "ai-ready", label: "AI-ready infrastructure", points: 3 } ] },
  { id: "q5", label: "Biggest barrier to AI?", options: [
    { value: "unsure", label: "Don't know where to start", points: 0 },
    { value: "budget", label: "Budget", points: 1 },
    { value: "skills", label: "Skills / capacity", points: 2 },
    { value: "trust", label: "Trust / governance", points: 3 } ] },
  { id: "q6", label: "Primary success metric?", options: [
    { value: "none", label: "Not defined", points: 0 },
    { value: "time", label: "Time saved", points: 1 },
    { value: "cost", label: "Cost reduced", points: 2 },
    { value: "revenue", label: "Revenue grown", points: 3 } ] },
  { id: "q7", label: "Implementation timeline?", options: [
    { value: "future", label: "6–12+ months out", points: 0 },
    { value: "exploring", label: "Exploring options", points: 1 },
    { value: "soon", label: "Within 3–6 months", points: 2 },
    { value: "now", label: "Ready to start now", points: 3 } ] },
];

export function AIForm() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tier: string; score: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function points(qid: string): number {
    const q = QUESTIONS.find((x) => x.id === qid);
    return q?.options.find((o) => o.value === answers[qid])?.points ?? 0;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const score = QUESTIONS.reduce((s, q) => s + points(q.id), 0);
    const body = {
      firstName: fd.get("firstName"),
      lastName: fd.get("lastName"),
      email: fd.get("email"),
      company: fd.get("company"),
      role: fd.get("role"),
      phone: fd.get("phone"),
      answers,
      score,
    };
    try {
      const res = await fetch("/api/ai-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Submission failed");
      setResult({ tier: data.tier, score: data.score });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#1c1c1e] p-8 text-center">
        <p className="eyebrow" style={{ color: "var(--bright-blue)" }}>Your AI readiness</p>
        <div className="mt-2 text-4xl font-bold text-white">{result.score}/21</div>
        <div className="mt-1 text-lg font-semibold text-[#5ab0ff]">{result.tier}</div>
        <p className="mt-3 text-white/60">
          Saved to our CRM — a Provecta specialist will send your sequenced rollout and the first use-cases for your tier.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-[#1c1c1e] p-6 sm:p-8">
      <div className="space-y-5">
        {QUESTIONS.map((q) => (
          <div key={q.id}>
            <label className={LABEL}>{q.label}</label>
            <select
              className={FIELD}
              required
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            >
              <option value="">Select…</option>
              {q.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-2">
        <input name="firstName" required placeholder="First name *" className={FIELD} />
        <input name="lastName" placeholder="Last name" className={FIELD} />
        <input name="email" type="email" required placeholder="Work email *" className={FIELD} />
        <input name="company" required placeholder="Company *" className={FIELD} />
        <input name="role" placeholder="Role" className={FIELD} />
        <input name="phone" placeholder="Phone" className={FIELD} />
      </div>

      {error ? <div className="mt-4 text-sm text-[#ff6961]">{error}</div> : null}

      <button type="submit" disabled={submitting} className="btn btn-primary mt-6 w-full disabled:opacity-60">
        {submitting ? "Scoring…" : "Get my AI readiness score"}
      </button>
      <p className="mt-3 text-center text-xs text-white/40">Free. Built on bRRAIn — the system we run our own firm on.</p>
    </form>
  );
}
