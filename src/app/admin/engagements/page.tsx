import Link from "next/link";
import { getEngagements } from "@/server/data";
import { Badge, Card, CardHeader } from "@/components/ui";
import { ENGAGEMENT_STATUS, toneFor, money, shortDate } from "@/lib/types";

export default async function EngagementsPage() {
  const engagements = await getEngagements();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Engagements</h1>
      <Card>
        <CardHeader title={`${engagements.length} engagements`} />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Engagement</th>
              <th className="px-2 py-2.5">Client</th>
              <th className="px-2 py-2.5">Code</th>
              <th className="px-2 py-2.5">Target</th>
              <th className="px-5 py-2.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {engagements.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-[var(--color-brand)]">
                  <Link href={`/admin/engagements/${e.id}`}>{e.name}</Link>
                </td>
                <td className="px-2 py-3 text-slate-600">{e.tenant.name}</td>
                <td className="px-2 py-3 text-slate-500">{e.code}</td>
                <td className="px-2 py-3 text-slate-500">{shortDate(e.targetEndDate)}</td>
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
