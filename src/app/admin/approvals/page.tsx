import { prisma } from "@/lib/db";
import { seedAutonomyPolicies } from "@/server/autonomy/seed";
import { approveRun, rejectRun } from "@/server/agent-actions";
import { Badge, Card, CardHeader } from "@/components/ui";
import { ABTN } from "@/components/admin-form";
import { shortDate } from "@/lib/types";

export default async function ApprovalsPage() {
  await seedAutonomyPolicies(); // idempotent — ensure the policy ladder exists
  const [runs, policies] = await Promise.all([
    prisma.agentRun.findMany({ where: { status: "AWAITING_REVIEW" }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.autonomyPolicy.findMany({ orderBy: { actionCategory: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Agent approvals</h1>
        <p className="mt-1 text-sm text-slate-500">
          Proposed agent actions awaiting human review. Approving advances the autonomy ramp for reversible categories;
          REGULATED/IRREVERSIBLE never auto-promote.
        </p>
      </div>

      <Card>
        <CardHeader title={`Awaiting review (${runs.length})`} />
        <ul className="divide-y divide-slate-100">
          {runs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <div className="text-sm font-medium text-slate-800">
                  {r.actionCategory} <span className="text-slate-400">·</span> {r.trigger}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  <Badge tone={r.riskClass === "REVERSIBLE" ? "info" : "danger"}>{r.riskClass}</Badge>
                  <span>state {r.autonomyState}</span>
                  {r.criticScore != null ? <span>· critic {r.criticScore}</span> : null}
                  <span>· {shortDate(r.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <form action={approveRun}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className={ABTN}>Approve</button>
                </form>
                <form action={rejectRun}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    Reject
                  </button>
                </form>
              </div>
            </li>
          ))}
          {runs.length === 0 ? (
            <li className="px-5 py-4 text-center text-sm text-slate-400">Nothing awaiting review.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Autonomy ladder" />
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {policies.map((p) => (
              <tr key={p.actionCategory}>
                <td className="px-5 py-2.5 text-slate-700">{p.actionCategory}</td>
                <td className="px-2 py-2.5">
                  <Badge tone={p.riskClass === "REVERSIBLE" ? "info" : "danger"}>{p.riskClass}</Badge>
                </td>
                <td className="px-2 py-2.5 text-slate-600">{p.state}</td>
                <td className="px-5 py-2.5 text-right text-slate-400">
                  {p.approvedCount}/{p.threshold} approvals
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
