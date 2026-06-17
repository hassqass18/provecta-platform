import { prisma } from "@/lib/db";
import { setAutonomyState } from "@/server/ops-actions";
import { Badge, Card, CardHeader, ProgressBar } from "@/components/ui";
import { AUTONOMY_STATE, toneFor, type Tone } from "@/lib/types";

const RISK_TONE: Record<string, Tone> = {
  REVERSIBLE: "success",
  IRREVERSIBLE: "warn",
  REGULATED: "danger",
};

const STATES = ["SUGGEST", "AUTO_WITH_REVIEW", "AUTONOMOUS"];

export default async function AutonomyPage() {
  const policies = await prisma.autonomyPolicy.findMany({ orderBy: { actionCategory: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Autonomy ramp</h1>
        <p className="mt-1 text-sm text-slate-500">
          Actions graduate SUGGEST → AUTO&nbsp;WITH&nbsp;REVIEW → AUTONOMOUS as they earn approvals.
          Regulated / irreversible actions (payments, contracts) are hard-gated — never auto.
        </p>
      </div>

      <div className="space-y-4">
        {policies.map((p) => {
          const pct = p.threshold > 0 ? (p.approvedCount / p.threshold) * 100 : 0;
          const locked = p.riskClass === "IRREVERSIBLE" || p.riskClass === "REGULATED";
          return (
            <Card key={p.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{p.actionCategory}</span>
                    <Badge tone={toneFor(AUTONOMY_STATE, p.state)}>{p.state.replace(/_/g, " ")}</Badge>
                    <Badge tone={RISK_TONE[p.riskClass] ?? "neutral"}>{p.riskClass}</Badge>
                    {locked ? <span className="text-xs text-rose-600">🔒 human-gated</span> : null}
                  </div>
                  <div className="mt-2 w-64 max-w-full">
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>approvals</span>
                      <span>{p.approvedCount}/{p.threshold}</span>
                    </div>
                    <ProgressBar value={pct} />
                  </div>
                </div>
                {!locked ? (
                  <form action={setAutonomyState} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <select name="state" defaultValue={p.state} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
                      {STATES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                    </select>
                    <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Set</button>
                  </form>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
