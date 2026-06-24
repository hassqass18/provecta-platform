import { prisma } from "@/lib/db";
import { saveAdkar } from "@/server/ops-actions";
import { adkarScore, barrierPoint, readinessTone, ADKAR_DIMENSIONS } from "@/lib/adkar";
import { Badge, Card, CardHeader, ProgressBar } from "@/components/ui";

export default async function ChangePage() {
  const [assessments, engagements] = await Promise.all([
    prisma.adoptionAssessment.findMany({ orderBy: { asOf: "desc" } }),
    prisma.engagement.findMany({ include: { tenant: true } }),
  ]);
  const engName = new Map(engagements.map((e) => [e.id, `${e.tenant.name} · ${e.code}`]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Change management — adoption (ADKAR)</h1>
        <p className="mt-1 text-sm text-slate-500">
          Productized change management: 60% of AI projects stall on adoption, not technology. Score
          readiness, find the barrier point, instrument the move to live.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {assessments.map((a) => {
          const score = adkarScore(a);
          const barrier = barrierPoint(a);
          return (
            <Card key={a.id} className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800">{a.stakeholder}</div>
                  <div className="text-xs text-slate-500">{engName.get(a.engagementId) ?? "—"}</div>
                </div>
                <Badge tone={readinessTone(score)}>{score}% ready</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {ADKAR_DIMENSIONS.map((d) => (
                  <div key={d}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className={`capitalize ${d === barrier ? "font-semibold text-rose-600" : "text-slate-600"}`}>
                        {d}
                        {d === barrier ? " · barrier" : ""}
                      </span>
                      <span className="text-slate-500">{a[d]}/5</span>
                    </div>
                    <ProgressBar value={(a[d] / 5) * 100} />
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader title="Add an assessment" />
        <form action={saveAdkar} className="grid gap-2 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <select name="engagementId" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm lg:col-span-2">
            <option value="">Engagement…</option>
            {engagements.map((e) => <option key={e.id} value={e.id}>{e.tenant.name} · {e.code}</option>)}
          </select>
          <input name="stakeholder" required placeholder="Stakeholder group" className="rounded-lg border border-slate-200 px-3 py-2 text-sm lg:col-span-2" />
          {ADKAR_DIMENSIONS.map((d) => (
            <label key={d} className="text-xs text-slate-500">
              <span className="capitalize">{d}</span> (1–5)
              <input name={d} type="number" min={1} max={5} defaultValue={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
            </label>
          ))}
          <div className="sm:col-span-2 lg:col-span-4"><button className="rounded-lg bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Save assessment</button></div>
        </form>
      </Card>
    </div>
  );
}
