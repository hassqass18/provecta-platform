import { Badge, Card, CardHeader, Stat, ProgressBar } from "./ui";
import {
  ENGAGEMENT_STATUS,
  MILESTONE_STATUS,
  INVOICE_STATUS,
  SLA_STATUS,
  TICKET_STATUS,
  toneFor,
  money,
  shortDate,
} from "@/lib/types";
import { createPortalTicket } from "@/server/actions";

type DashboardData = Awaited<
  ReturnType<typeof import("@/server/data").getClientDashboardProjection>
>;

export function ClientDashboard({
  data,
  canRaiseTicket = false,
}: {
  data: DashboardData;
  canRaiseTicket?: boolean;
}) {
  const { tenant, engagement } = data;

  if (!engagement) {
    return (
      <Card className="p-8 text-center text-slate-500">
        No active engagement yet for {tenant?.name ?? "this client"}.
      </Card>
    );
  }

  const completion = engagement.kpis.find((k) => k.label === "Project completion")?.value ?? 0;
  const milestonesDone = engagement.milestones.filter((m) => m.status === "COMPLETED").length;
  const outstanding = engagement.invoices
    .filter((i) => i.status !== "PAID" && i.status !== "VOID")
    .reduce((s, i) => s + i.amountMinor, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{engagement.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tenant?.name} · {engagement.code} ·{" "}
            <Badge tone={toneFor(ENGAGEMENT_STATUS, engagement.status)}>{engagement.status}</Badge>
          </p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <div>Start: {shortDate(engagement.startDate)}</div>
          <div>Target: {shortDate(engagement.targetEndDate)}</div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Project completion" value={`${completion}%`} tone="success" />
        <Stat label="Milestones" value={`${milestonesDone}/${engagement.milestones.length}`} tone="info" />
        <Stat label="Budget" value={money(engagement.budgetMinor, engagement.currency)} sub="Total engagement value" />
        <Stat
          label="Outstanding"
          value={money(outstanding, engagement.currency)}
          tone={outstanding > 0 ? "warn" : "success"}
          sub={outstanding > 0 ? "Awaiting payment" : "All settled"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Milestones */}
        <Card className="lg:col-span-2">
          <CardHeader title="Milestones" />
          <ul className="divide-y divide-slate-100">
            {engagement.milestones.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-800">{m.title}</div>
                  <div className="text-xs text-slate-500">
                    {m.description} · due {shortDate(m.dueDate)}
                  </div>
                </div>
                <Badge tone={toneFor(MILESTONE_STATUS, m.status)}>{m.status.replace("_", " ")}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        {/* KPIs detail + progress */}
        <Card>
          <CardHeader title="Live KPIs" />
          <div className="space-y-4 p-5">
            {engagement.kpis.map((k) => (
              <div key={k.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-600">{k.label}</span>
                  <span className="font-semibold text-slate-900">
                    {k.value}
                    {k.unit === "%" ? "%" : k.unit ? ` ${k.unit}` : ""}
                  </span>
                </div>
                {k.unit === "%" ? <ProgressBar value={k.value} /> : null}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* SLAs */}
        <Card>
          <CardHeader title="Service levels (SLAs)" />
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {engagement.slas.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-3 text-slate-700">{s.metric}</td>
                  <td className="px-2 py-3 text-slate-500">{s.target}</td>
                  <td className="px-5 py-3 text-right">
                    <Badge tone={toneFor(SLA_STATUS, s.status)}>{s.status.replace("_", " ")}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Invoices */}
        <Card>
          <CardHeader title="Invoices" />
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {engagement.invoices.map((i) => (
                <tr key={i.id}>
                  <td className="px-5 py-3 font-medium text-slate-700">{i.number}</td>
                  <td className="px-2 py-3 text-slate-600">{money(i.amountMinor, i.currency)}</td>
                  <td className="px-2 py-3 text-slate-400">due {shortDate(i.dueAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <Badge tone={toneFor(INVOICE_STATUS, i.status)}>{i.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Documents */}
      <Card>
        <CardHeader title="Document & media vault" />
        <ul className="divide-y divide-slate-100">
          {engagement.documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-700">{d.name}</span>
                {d.isFinal ? <Badge tone="success">FINAL</Badge> : null}
                {d.signed ? <Badge tone="info">SIGNED</Badge> : null}
              </div>
              <span className="text-xs text-slate-400">
                {d.kind} · v{d.version} · {(d.sizeBytes / 1024 / 1024).toFixed(1)} MB
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Tickets */}
      <Card>
        <CardHeader title="Support tickets" />
        <ul className="divide-y divide-slate-100">
          {engagement.tickets.map((t) => (
            <li key={t.id} className="px-5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800">{t.subject}</span>
                <div className="flex items-center gap-2">
                  <Badge>{t.channel}</Badge>
                  <Badge tone={toneFor(TICKET_STATUS, t.status)}>{t.status.replace("_", " ")}</Badge>
                </div>
              </div>
              {t.proposedAction ? (
                <div className="mt-1 text-xs text-slate-500">Proposed: {t.proposedAction}</div>
              ) : null}
            </li>
          ))}
          {engagement.tickets.length === 0 ? (
            <li className="px-5 py-4 text-center text-sm text-slate-400">No tickets yet.</li>
          ) : null}
        </ul>

        {canRaiseTicket ? (
          <form action={createPortalTicket} className="space-y-2 border-t border-slate-100 p-5">
            <div className="text-sm font-semibold text-slate-700">Raise a ticket</div>
            <input
              name="subject"
              required
              placeholder="Subject"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <textarea
              name="body"
              placeholder="Describe your request…"
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              Submit ticket
            </button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
