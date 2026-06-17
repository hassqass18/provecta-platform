import { notFound } from "next/navigation";
import { getEngagementDetail } from "@/server/data";
import { advanceMilestone, setEngagementStatus } from "@/server/actions";
import { Badge, Card, CardHeader, Stat } from "@/components/ui";
import {
  ENGAGEMENT_STATUS,
  MILESTONE_STATUS,
  TASK_STATUS,
  toneFor,
  money,
  shortDate,
} from "@/lib/types";

const STATUSES = ["PROPOSED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];

export default async function EngagementDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await getEngagementDetail(id);
  if (!e) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{e.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {e.tenant.name} · {e.code} ·{" "}
            <Badge tone={toneFor(ENGAGEMENT_STATUS, e.status)}>{e.status}</Badge>
          </p>
        </div>
        <form action={setEngagementStatus} className="flex items-center gap-2">
          <input type="hidden" name="id" value={e.id} />
          <select
            name="status"
            defaultValue={e.status}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
            Update status
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Budget" value={money(e.budgetMinor, e.currency)} />
        <Stat label="Start" value={shortDate(e.startDate)} />
        <Stat label="Target end" value={shortDate(e.targetEndDate)} />
      </div>

      {e.charter ? (
        <Card>
          <CardHeader title="Project charter" />
          <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-500">Objectives</dt>
              <dd className="text-slate-700">{e.charter.objectives}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Sponsor</dt>
              <dd className="text-slate-700">{e.charter.sponsor}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Scope</dt>
              <dd className="text-slate-700">{e.charter.scope}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Success criteria</dt>
              <dd className="text-slate-700">{e.charter.successCriteria}</dd>
            </div>
          </dl>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Milestones — full control" />
        <ul className="divide-y divide-slate-100">
          {e.milestones.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <div className="text-sm font-medium text-slate-800">{m.title}</div>
                <div className="text-xs text-slate-500">
                  {m.tasks.length} tasks · due {shortDate(m.dueDate)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={toneFor(MILESTONE_STATUS, m.status)}>{m.status.replace("_", " ")}</Badge>
                {m.status !== "COMPLETED" ? (
                  <form action={advanceMilestone}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Advance →
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Tasks" />
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {e.tasks.map((t) => (
              <tr key={t.id}>
                <td className="px-5 py-3 text-slate-700">{t.title}</td>
                <td className="px-2 py-3 text-slate-500">{t.assignee?.name ?? "—"}</td>
                <td className="px-5 py-3 text-right">
                  <Badge tone={toneFor(TASK_STATUS, t.status)}>{t.status.replace("_", " ")}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Invoices" />
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {e.invoices.map((i) => (
                <tr key={i.id}>
                  <td className="px-5 py-3 text-slate-700">{i.number}</td>
                  <td className="px-2 py-3 text-slate-600">{money(i.amountMinor, i.currency)}</td>
                  <td className="px-5 py-3 text-right text-slate-500">{i.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <CardHeader title="Documents" />
          <ul className="divide-y divide-slate-100">
            {e.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-slate-700">{d.name}</span>
                <span className="text-xs text-slate-400">{d.kind}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
