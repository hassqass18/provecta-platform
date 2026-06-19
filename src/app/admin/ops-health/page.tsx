import { prisma } from "@/lib/db";
import { verifyAuditChain } from "@/lib/audit-chain";
import { Badge, Card, CardHeader, EmptyRow, Stat } from "@/components/ui";
import { AUTONOMY_STATE, shortDate, toneFor, type Tone } from "@/lib/types";

const RISK_TONE: Record<string, Tone> = {
  REVERSIBLE: "success",
  IRREVERSIBLE: "warn",
  REGULATED: "danger",
};

const AGENT_RUN_STATUSES = [
  "AWAITING_REVIEW",
  "AUTO_EXECUTED",
  "DONE",
  "REJECTED",
  "FAILED",
] as const;

function minutesSince(d: Date | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 60_000);
}

function countByStatus(
  rows: { status: string }[],
): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
}

function truncate(s: string | null | undefined, max = 80): string {
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export default async function OpsHealthPage() {
  const [
    domainEvents,
    ingestJobs,
    failedIngestJobs,
    brainRepo,
    agentRuns,
    policies,
    audit,
  ] = await Promise.all([
    prisma.domainEvent.findMany({ select: { status: true, createdAt: true } }),
    prisma.ingestJob.findMany({ select: { status: true } }),
    prisma.ingestJob.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, kind: true, lastError: true, createdAt: true },
    }),
    prisma.brainRepo.findFirst({
      orderBy: { lastSyncedAt: "desc" },
      select: { lastSyncedAt: true },
    }),
    prisma.agentRun.findMany({ select: { status: true } }),
    prisma.autonomyPolicy.findMany({ orderBy: { actionCategory: "asc" } }),
    verifyAuditChain(),
  ]);

  // ── DomainEvent queue ──────────────────────────────────────────────
  const eventCounts = countByStatus(domainEvents);
  const pending = eventCounts.PENDING ?? 0;
  const processing = eventCounts.PROCESSING ?? 0;
  const processed = eventCounts.PROCESSED ?? 0;
  const failedEvents = eventCounts.FAILED ?? 0;
  const queueDepth = pending + processing;

  const oldestPending = domainEvents
    .filter((e) => e.status === "PENDING")
    .reduce<Date | null>((oldest, e) => {
      if (!oldest || e.createdAt < oldest) return e.createdAt;
      return oldest;
    }, null);
  const oldestPendingMin = minutesSince(oldestPending) ?? 0;

  const healthTone: Tone =
    failedEvents > 0 || oldestPendingMin > 15
      ? "danger"
      : queueDepth > 20
        ? "warn"
        : "success";
  const healthLabel =
    healthTone === "danger" ? "RED" : healthTone === "warn" ? "AMBER" : "GREEN";

  // ── IngestJob ──────────────────────────────────────────────────────
  const ingestCounts = countByStatus(ingestJobs);

  // ── Connector heartbeat ────────────────────────────────────────────
  const syncMin = minutesSince(brainRepo?.lastSyncedAt);
  const heartbeatStale = syncMin === null || syncMin > 60;

  // ── AgentRun ───────────────────────────────────────────────────────
  const agentCounts = countByStatus(agentRuns);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Ops health</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live view of the event spine, ingest pipeline, connector heartbeat,
            agent runs and the tamper-evident audit chain.
          </p>
        </div>
        <Badge tone={healthTone}>System {healthLabel}</Badge>
      </div>

      {/* DomainEvent queue */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Queue depth"
          value={queueDepth}
          sub="PENDING + PROCESSING"
          tone={queueDepth > 20 ? "warn" : "neutral"}
        />
        <Stat
          label="Failed events"
          value={failedEvents}
          sub="DomainEvent FAILED"
          tone={failedEvents > 0 ? "danger" : "success"}
        />
        <Stat
          label="Oldest pending (min)"
          value={oldestPendingMin}
          sub={oldestPending ? shortDate(oldestPending) : "no pending events"}
          tone={oldestPendingMin > 15 ? "danger" : "neutral"}
        />
        <Stat
          label="Audit chain"
          value={audit.ok ? "OK" : "BROKEN"}
          sub={
            audit.ok
              ? `${audit.sealed} events sealed`
              : `break at seq ${audit.brokenAtSeq ?? "?"}`
          }
          tone={audit.ok ? "success" : "danger"}
        />
      </div>

      <Card>
        <CardHeader
          title="DomainEvent queue"
          action={<Badge tone={healthTone}>{healthLabel}</Badge>}
        />
        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
          {[
            ["PENDING", pending],
            ["PROCESSING", processing],
            ["PROCESSED", processed],
            ["FAILED", failedEvents],
          ].map(([label, n]) => (
            <div key={label} className="bg-white px-5 py-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">{n}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* IngestJob */}
        <Card>
          <CardHeader title="Ingest jobs" />
          <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
            {["PENDING", "PROCESSING", "DONE", "FAILED"].map((s) => (
              <div key={s} className="bg-white px-5 py-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {s}
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {ingestCounts[s] ?? 0}
                </div>
              </div>
            ))}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5 font-medium">Kind</th>
                <th className="px-5 py-2.5 font-medium">Last error</th>
                <th className="px-5 py-2.5 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {failedIngestJobs.length === 0 ? (
                <EmptyRow colSpan={3} label="No failed ingest jobs" />
              ) : (
                failedIngestJobs.map((j) => (
                  <tr key={j.id} className="border-b border-slate-50">
                    <td className="px-5 py-2.5 font-medium text-slate-800">
                      {j.kind}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">
                      {truncate(j.lastError)}
                    </td>
                    <td className="px-5 py-2.5 whitespace-nowrap text-slate-500">
                      {shortDate(j.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        {/* Connector heartbeat + AgentRun */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Connector heartbeat"
              action={
                <Badge tone={heartbeatStale ? "danger" : "success"}>
                  {heartbeatStale ? "STALE" : "LIVE"}
                </Badge>
              }
            />
            <div className="px-5 py-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Brain repo last sync
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {syncMin === null ? "never" : `${syncMin} min ago`}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {brainRepo?.lastSyncedAt
                  ? shortDate(brainRepo.lastSyncedAt)
                  : "no successful sync recorded"}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Agent runs" />
            <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3">
              {AGENT_RUN_STATUSES.map((s) => (
                <div key={s} className="bg-white px-5 py-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {s.replace(/_/g, " ")}
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-900">
                    {agentCounts[s] ?? 0}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Autonomy promotion log */}
      <Card>
        <CardHeader title="Autonomy promotion log" />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-2.5 font-medium">Action category</th>
              <th className="px-5 py-2.5 font-medium">Risk class</th>
              <th className="px-5 py-2.5 font-medium">State</th>
              <th className="px-5 py-2.5 font-medium">Approvals</th>
            </tr>
          </thead>
          <tbody>
            {policies.length === 0 ? (
              <EmptyRow colSpan={4} label="No autonomy policies" />
            ) : (
              policies.map((p) => (
                <tr key={p.id} className="border-b border-slate-50">
                  <td className="px-5 py-2.5 font-medium text-slate-800">
                    {p.actionCategory}
                  </td>
                  <td className="px-5 py-2.5">
                    <Badge tone={RISK_TONE[p.riskClass] ?? "neutral"}>
                      {p.riskClass}
                    </Badge>
                  </td>
                  <td className="px-5 py-2.5">
                    <Badge tone={toneFor(AUTONOMY_STATE, p.state)}>
                      {p.state.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-5 py-2.5 whitespace-nowrap text-slate-600">
                    {p.approvedCount}/{p.threshold}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
