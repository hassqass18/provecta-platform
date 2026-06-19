import { prisma } from "@/lib/db";
import { brainProvider } from "@/lib/brain";
import { createProposalFromTranscript } from "@/server/ops-actions";
import { approveDocument } from "@/server/crud";
import { getPendingBrainDocs } from "@/server/data";
import { Badge, Card, CardHeader } from "@/components/ui";
import { ABTN } from "@/components/admin-form";
import { shortDate } from "@/lib/types";

export default async function BrainPage() {
  const [clients, queries, transcripts, pendingDocs] = await Promise.all([
    prisma.tenant.findMany({ where: { type: "CLIENT" }, orderBy: { name: "asc" } }),
    prisma.brainQuery.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.transcript.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    getPendingBrainDocs(),
  ]);
  const provider = brainProvider();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Brain — proposal from transcript</h1>
          <p className="mt-1 text-sm text-slate-500">
            Record the discovery call → the brain drafts a proposal → engage the client.
          </p>
        </div>
        <Badge tone={provider === "STUB" ? "warn" : "success"}>
          brain: {provider === "STUB" ? "local stub (gated)" : provider}
        </Badge>
      </div>

      <Card>
        <CardHeader title="Generate a proposal" />
        <form action={createProposalFromTranscript} className="space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <select name="tenantId" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input name="title" required placeholder="Engagement title" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <textarea
            name="transcript"
            required
            rows={6}
            placeholder="Paste the discovery conversation transcript here…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Draft proposal →
          </button>
        </form>
      </Card>

      <Card>
        <CardHeader title={`Brain documents awaiting approval (${pendingDocs.length})`} />
        <p className="px-5 pt-3 text-xs text-slate-500">
          Pulled from the brain as FINAL but hidden from the client until you approve (client-approval finality).
        </p>
        <ul className="divide-y divide-slate-100">
          {pendingDocs.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <div className="text-sm font-medium text-slate-800">{d.name}</div>
                <div className="text-xs text-slate-500">
                  {d.tenant.name} · <Badge tone="info">BRAIN</Badge> · {shortDate(d.createdAt)}
                </div>
              </div>
              <form action={approveDocument}>
                <input type="hidden" name="id" value={d.id} />
                <button className={ABTN}>Approve for client</button>
              </form>
            </li>
          ))}
          {pendingDocs.length === 0 ? (
            <li className="px-5 py-4 text-center text-sm text-slate-400">Nothing awaiting approval.</li>
          ) : null}
        </ul>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent transcripts" />
          <ul className="divide-y divide-slate-100">
            {transcripts.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-slate-700">{t.title}</span>
                <span className="text-xs text-slate-400">{shortDate(t.createdAt)}</span>
              </li>
            ))}
            {transcripts.length === 0 ? <li className="px-5 py-4 text-center text-sm text-slate-400">No transcripts yet.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Brain query log" />
          <ul className="divide-y divide-slate-100">
            {queries.map((q) => (
              <li key={q.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="truncate text-slate-700">{q.prompt}</span>
                  <Badge>{q.provider}</Badge>
                </div>
              </li>
            ))}
            {queries.length === 0 ? <li className="px-5 py-4 text-center text-sm text-slate-400">No queries yet.</li> : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
