import Link from "next/link";
import { getAdminOverview } from "@/server/data";
import { Badge, Card, CardHeader, Stat } from "@/components/ui";
import { ENGAGEMENT_STATUS, toneFor, money, shortDate } from "@/lib/types";

function Bar({ label, value, max, color, display }: { label: string; value: number; max: number; color: string; display: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span className="capitalize">{label.toLowerCase().replace(/_/g, " ")}</span>
        <span>{display}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
      </div>
    </div>
  );
}

export default async function AdminOverview() {
  const o = await getAdminOverview();
  const pipelineMax = Math.max(1, ...o.engagementsByStatus.map((s) => s.value));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Back office overview</h1>
        <p className="mt-1 text-sm text-slate-500">Single source of truth across every client engagement.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Clients" value={o.tenants} />
        <Stat label="Active engagements" value={o.activeEngagements} tone="info" />
        <Stat label="Open tickets" value={o.openTickets} tone={o.openTickets > 0 ? "warn" : "success"} />
        <Stat label="Billed" value={money(o.billedMinor)} />
        <Stat label="Collected" value={money(o.collectedMinor)} tone="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-3 text-sm font-semibold text-slate-800">Collections</div>
          <Bar label="Billed" value={o.billedMinor} max={o.billedMinor} color="#1d1d1f" display={money(o.billedMinor)} />
          <Bar label="Collected" value={o.collectedMinor} max={o.billedMinor} color="#0071e3" display={money(o.collectedMinor)} />
          <Bar label="Outstanding" value={o.outstandingMinor} max={o.billedMinor} color="#8e8e93" display={money(o.outstandingMinor)} />
        </Card>

        <Card className="p-5">
          <div className="mb-3 text-sm font-semibold text-slate-800">Engagements by status</div>
          {o.engagementsByStatus.length === 0 ? (
            <p className="text-sm text-slate-400">No engagements yet.</p>
          ) : (
            o.engagementsByStatus.map((s) => (
              <Bar key={s.label} label={s.label} value={s.value} max={pipelineMax} color="#2997ff" display={String(s.value)} />
            ))
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 text-sm font-semibold text-slate-800">Recent activity</div>
          <ul className="space-y-2 text-sm">
            {o.recentActivity.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3">
                <span className="text-slate-700">
                  <span className="capitalize">{a.action.toLowerCase().replace(/_/g, " ")}</span>
                  <span className="text-slate-400"> · {a.entity}</span>
                  {a.actor?.name ? <span className="text-slate-400"> · {a.actor.name}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-slate-400">{shortDate(a.createdAt)}</span>
              </li>
            ))}
            {o.recentActivity.length === 0 ? <li className="text-slate-400">No activity yet.</li> : null}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Engagements" />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Engagement</th>
              <th className="px-2 py-2.5">Client</th>
              <th className="px-2 py-2.5">Milestones</th>
              <th className="px-2 py-2.5">Budget</th>
              <th className="px-5 py-2.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {o.engagements.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-[var(--color-brand)]">
                  <Link href={`/admin/engagements/${e.id}`}>{e.name}</Link>
                </td>
                <td className="px-2 py-3 text-slate-600">{e.tenant.name}</td>
                <td className="px-2 py-3 text-slate-500">{e._count.milestones}</td>
                <td className="px-2 py-3 text-slate-600">{money(e.budgetMinor, e.currency)}</td>
                <td className="px-5 py-3 text-right">
                  <Badge tone={toneFor(ENGAGEMENT_STATUS, e.status)}>{e.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
