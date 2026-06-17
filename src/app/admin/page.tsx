import Link from "next/link";
import { getAdminOverview } from "@/server/data";
import { Badge, Card, CardHeader, Stat } from "@/components/ui";
import { ENGAGEMENT_STATUS, toneFor, money } from "@/lib/types";

export default async function AdminOverview() {
  const o = await getAdminOverview();
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
