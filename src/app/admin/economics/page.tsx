import { prisma } from "@/lib/db";
import { Badge, Card, CardHeader, EmptyRow, Stat } from "@/components/ui";
import { COGS_ACCOUNTS } from "@/lib/cogs";
import { money, toneFor, AUTONOMY_STATE, type Tone } from "@/lib/types";

const COGS_PREFIX = "cogs_";

const RISK_TONE: Record<string, Tone> = {
  REVERSIBLE: "info",
  IRREVERSIBLE: "danger",
  REGULATED: "danger",
};

type EngagementRow = {
  id: string;
  name: string;
  tenantName: string;
  revenueMinor: number;
  cogsMinor: number;
  marginMinor: number;
};

export default async function AdminEconomicsPage() {
  const [paidInvoices, journalLines, engagements, policies] = await Promise.all([
    prisma.invoice.findMany({ where: { status: "PAID" } }),
    prisma.journalLine.findMany({ include: { entry: true } }),
    prisma.engagement.findMany({ include: { tenant: true } }),
    prisma.autonomyPolicy.findMany({ orderBy: { actionCategory: "asc" } }),
  ]);

  // Reference COGS account codes (keeps the cogs.ts contract in scope; all
  // current codes share the cogs_ prefix we filter on below).
  void COGS_ACCOUNTS;

  // Revenue (collected): sum of PAID invoice amounts, overall + per engagement.
  const revenueByEngagement = new Map<string, number>();
  let revenueMinor = 0;
  for (const inv of paidInvoices) {
    revenueMinor += inv.amountMinor;
    if (inv.engagementId) {
      revenueByEngagement.set(
        inv.engagementId,
        (revenueByEngagement.get(inv.engagementId) ?? 0) + inv.amountMinor,
      );
    }
  }

  // COGS: sum of debits on lines whose account code starts with cogs_,
  // attributed to entry.engagementId, overall + per engagement.
  const cogsByEngagement = new Map<string, number>();
  let cogsMinor = 0;
  for (const line of journalLines) {
    if (!line.accountCode.startsWith(COGS_PREFIX)) continue;
    cogsMinor += line.debitMinor;
    const engagementId = line.entry.engagementId;
    if (engagementId) {
      cogsByEngagement.set(
        engagementId,
        (cogsByEngagement.get(engagementId) ?? 0) + line.debitMinor,
      );
    }
  }

  const marginMinor = revenueMinor - cogsMinor;

  // Autonomy graduation rate = % of policies in AUTONOMOUS state.
  const autonomousCount = policies.filter((p) => p.state === "AUTONOMOUS").length;
  const graduationRate = Math.round((100 * autonomousCount) / Math.max(1, policies.length));

  // Per-engagement table rows — only engagements with revenue or COGS activity.
  const rows: EngagementRow[] = engagements
    .map((e) => {
      const rev = revenueByEngagement.get(e.id) ?? 0;
      const cogs = cogsByEngagement.get(e.id) ?? 0;
      return {
        id: e.id,
        name: e.name,
        tenantName: e.tenant.name,
        revenueMinor: rev,
        cogsMinor: cogs,
        marginMinor: rev - cogs,
      };
    })
    .filter((r) => r.revenueMinor !== 0 || r.cogsMinor !== 0)
    .sort((a, b) => b.marginMinor - a.marginMinor);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Economics — cost to serve &amp; autonomy ROI</h1>
        <p className="mt-1 text-sm text-slate-500">
          Contribution margin per engagement (collected revenue minus ledger COGS) and how far the
          autonomy policies have graduated to fully autonomous operation.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue (collected)" value={money(revenueMinor)} tone="success" />
        <Stat label="COGS" value={money(cogsMinor)} />
        <Stat
          label="Contribution margin"
          value={money(marginMinor)}
          tone={marginMinor < 0 ? "danger" : "success"}
        />
        <Stat
          label="Autonomy graduation rate"
          value={`${graduationRate}%`}
          tone="info"
          sub={`${autonomousCount} of ${policies.length} policies autonomous`}
        />
      </div>

      <Card>
        <CardHeader title="Cost to serve by engagement" />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Engagement</th>
              <th className="px-2 py-2.5 text-right">Revenue</th>
              <th className="px-2 py-2.5 text-right">COGS</th>
              <th className="px-5 py-2.5 text-right">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="font-medium text-slate-800">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.tenantName}</div>
                </td>
                <td className="px-2 py-3 text-right text-slate-700">{money(r.revenueMinor)}</td>
                <td className="px-2 py-3 text-right text-slate-700">{money(r.cogsMinor)}</td>
                <td
                  className={`px-5 py-3 text-right font-medium ${
                    r.marginMinor < 0 ? "text-[#d70015]" : "text-slate-800"
                  }`}
                >
                  {money(r.marginMinor)}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? <EmptyRow colSpan={4} label="No data yet" /> : null}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader title="Autonomy policies" />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Action category</th>
              <th className="px-2 py-2.5">Risk class</th>
              <th className="px-5 py-2.5">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {policies.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{p.actionCategory}</td>
                <td className="px-2 py-3">
                  <Badge tone={RISK_TONE[p.riskClass] ?? "info"}>{p.riskClass}</Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={toneFor(AUTONOMY_STATE, p.state)}>{p.state}</Badge>
                </td>
              </tr>
            ))}
            {policies.length === 0 ? <EmptyRow colSpan={3} label="No data yet" /> : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
