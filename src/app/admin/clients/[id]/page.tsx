import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getClientOverview } from "@/server/client-data";
import DangerZone from "./danger-zone";
import { Badge, Card, CardHeader, Stat, EmptyRow } from "@/components/ui";
import { uploadClientDocument } from "@/server/crud";
import { signDocPath } from "@/lib/doc-link";
import {
  ENGAGEMENT_STATUS,
  MILESTONE_STATUS,
  TICKET_STATUS,
  toneFor,
  money,
  shortDate,
} from "@/lib/types";

export default async function ClientOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ login?: string; pw?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await getClientOverview(id);
  if (!data) notFound();

  const { tenant, engagements, documents, tickets, aggregates } = data;
  const me = await currentUser();
  const hasBytes = (u: string | null | undefined) => !!u && (u.startsWith("db:") || u.startsWith("blob:"));

  // All milestones across engagements, tagged with their engagement name and
  // sorted by due date (nulls last) for the timeline.
  const milestones = engagements
    .flatMap((e) => e.milestones.map((m) => ({ ...m, engagementName: e.name })))
    .sort((a, b) => {
      const at = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bt = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return at - bt;
    });

  return (
    <div className="space-y-6">
      {sp.login && sp.pw ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="font-semibold">Client login created.</span> Share securely — shown once:
          <span className="ml-2 font-mono">{sp.login}</span> / <span className="font-mono">{sp.pw}</span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{tenant.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{tenant.type}</span>
            <span>·</span>
            {tenant.preferredChannel ? (
              <Badge tone="info">
                {tenant.preferredChannel}
                {tenant.channelAddress ? ` — ${tenant.channelAddress}` : ""}
              </Badge>
            ) : (
              <span className="text-slate-400">No main channel set</span>
            )}
          </p>
        </div>
        <Link
          href="/admin/clients"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ← All clients
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Engagements" value={aggregates.engagementCount} />
        <Stat label="Total budget" value={money(aggregates.budgetMinor)} />
        <Stat label="Billed" value={money(aggregates.billedMinor)} />
        <Stat label="Collected" value={money(aggregates.collectedMinor)} tone="success" />
        <Stat
          label="Outstanding"
          value={money(aggregates.outstandingMinor)}
          tone={aggregates.outstandingMinor > 0 ? "danger" : "neutral"}
        />
        <Stat
          label="Milestones"
          value={`${aggregates.milestonesComplete} / ${aggregates.milestonesTotal}`}
          sub="completed"
        />
      </div>

      <Card>
        <CardHeader title={`Engagements (${engagements.length})`} />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Engagement</th>
              <th className="px-2 py-2.5">Code</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="px-2 py-2.5">Budget</th>
              <th className="px-2 py-2.5">Target end</th>
              <th className="px-5 py-2.5 text-right">Milestones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {engagements.length === 0 ? (
              <EmptyRow colSpan={6} label="No engagements yet." />
            ) : (
              engagements.map((e) => {
                const done = e.milestones.filter((m) => m.status === "COMPLETED").length;
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium">
                      <Link
                        href={`/admin/engagements/${e.id}`}
                        className="text-[var(--color-brand)] hover:underline"
                      >
                        {e.name}
                      </Link>
                    </td>
                    <td className="px-2 py-3 text-slate-500">{e.code}</td>
                    <td className="px-2 py-3">
                      <Badge tone={toneFor(ENGAGEMENT_STATUS, e.status)}>{e.status}</Badge>
                    </td>
                    <td className="px-2 py-3 text-slate-600">{money(e.budgetMinor, e.currency)}</td>
                    <td className="px-2 py-3 text-slate-500">{shortDate(e.targetEndDate)}</td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {done} / {e.milestones.length}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader title={`Documents, deliverables & contracts (${documents.length})`} />
        <form action={uploadClientDocument} encType="multipart/form-data" className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <input type="file" name="file" required className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-brand)] file:px-3 file:py-1.5 file:text-white" />
          <input name="name" placeholder="Display name (optional)" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
          <select name="kind" className="rounded-md border border-slate-200 px-2 py-1.5 text-sm">
            <option value="DOCUMENT">Document</option>
            <option value="CONTRACT">Contract</option>
            <option value="MEDIA">Media</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" name="clientVisible" defaultChecked /> Client-visible</label>
          <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" name="isFinal" /> Final</label>
          <button className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-semibold text-white">Upload</button>
        </form>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Name</th>
              <th className="px-2 py-2.5">Kind</th>
              <th className="px-2 py-2.5">Source</th>
              <th className="px-2 py-2.5">Engagement</th>
              <th className="px-5 py-2.5 text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.length === 0 ? (
              <EmptyRow colSpan={5} label="No documents, deliverables or contracts yet." />
            ) : (
              documents.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {d.name}
                    {d.isFinal ? <span className="ml-2 text-xs text-slate-400">FINAL</span> : null}
                  </td>
                  <td className="px-2 py-3 text-slate-500">{d.kind}</td>
                  <td className="px-2 py-3">
                    <Badge tone={d.source === "BRAIN" ? "info" : "neutral"}>{d.source === "BRAIN" ? "bRRAIn" : d.source}</Badge>
                  </td>
                  <td className="px-2 py-3 text-slate-600">{d.engagementName}</td>
                  <td className="px-5 py-3 text-right text-slate-500">
                    {hasBytes(d.url) ? (
                      <a href={signDocPath(d.id)} target="_blank" rel="noreferrer" className="mr-3 text-[var(--color-brand)] hover:underline">Open</a>
                    ) : null}
                    {shortDate(d.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader title={`Milestone timeline (${milestones.length})`} />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Milestone</th>
              <th className="px-2 py-2.5">Engagement</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="px-5 py-2.5 text-right">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {milestones.length === 0 ? (
              <EmptyRow colSpan={4} label="No milestones yet." />
            ) : (
              milestones.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{m.title}</td>
                  <td className="px-2 py-3 text-slate-600">{m.engagementName}</td>
                  <td className="px-2 py-3">
                    <Badge tone={toneFor(MILESTONE_STATUS, m.status)}>
                      {m.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right text-slate-500">{shortDate(m.dueDate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader title={`Support tickets (${tickets.length})`} />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Subject</th>
              <th className="px-2 py-2.5">Channel</th>
              <th className="px-5 py-2.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.length === 0 ? (
              <EmptyRow colSpan={3} label="No support tickets." />
            ) : (
              tickets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{t.subject}</td>
                  <td className="px-2 py-3 text-slate-500">{t.channel}</td>
                  <td className="px-5 py-3 text-right">
                    <Badge tone={toneFor(TICKET_STATUS, t.status)}>
                      {t.status.replace("_", " ")}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {me?.role === "SUPER_ADMIN" ? <DangerZone tenantId={tenant.id} name={tenant.name} /> : null}
    </div>
  );
}
