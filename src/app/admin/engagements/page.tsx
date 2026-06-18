import Link from "next/link";
import { getEngagements, getClients } from "@/server/data";
import { Badge, Card, CardHeader } from "@/components/ui";
import { ENGAGEMENT_STATUS, toneFor, money, shortDate } from "@/lib/types";
import { NewForm, AINPUT, ALABEL, ABTN } from "@/components/admin-form";
import { createEngagement } from "@/server/crud";

export default async function EngagementsPage() {
  const [engagements, clients] = await Promise.all([getEngagements(), getClients()]);
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
        <NewForm label="New engagement">
          <form action={createEngagement} className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={ALABEL}>Client *</label>
              <select name="tenantId" required className={AINPUT} defaultValue="">
                <option value="">Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={ALABEL}>Engagement name *</label>
              <input name="name" required className={AINPUT} placeholder="RevOps Build" />
            </div>
            <div>
              <label className={ALABEL}>Budget (USD)</label>
              <input name="budget" type="number" className={AINPUT} placeholder="42000" />
            </div>
            <div>
              <label className={ALABEL}>Target end date</label>
              <input name="targetEndDate" type="date" className={AINPUT} />
            </div>
            <div className="sm:col-span-2">
              <label className={ALABEL}>Objectives (creates the charter)</label>
              <input name="objectives" className={AINPUT} placeholder="What does this engagement achieve?" />
            </div>
            <div className="sm:col-span-2">
              <button className={ABTN}>Create engagement</button>
            </div>
          </form>
        </NewForm>
      </Card>
    </div>
  );
}
