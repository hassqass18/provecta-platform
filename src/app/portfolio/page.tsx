import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = {
  title: "Portfolio — Provecta Group",
  description: "Selected business-operations and AI-implementation engagements by Provecta Group.",
};

export default async function Portfolio() {
  const items = await prisma.portfolioItem.findMany({ orderBy: { orderIndex: "asc" } });
  return (
    <MarketingShell>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-3xl font-bold text-slate-900">Portfolio</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          A company of the future: what we deliver, and the budget we deliver it in, is very different
          from how most companies engage one another.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 p-6">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                {p.sector} · {p.location} · {p.year}
              </div>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">{p.name}</h2>
              <p className="mt-1 text-xs text-slate-400">Client: {p.client}</p>
              <p className="mt-3 text-sm text-slate-600">{p.summary}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
