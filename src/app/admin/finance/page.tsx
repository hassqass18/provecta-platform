import { prisma } from "@/lib/db";
import { Badge, Card, CardHeader, EmptyRow, Stat } from "@/components/ui";
import {
  money,
  shortDate,
  toneFor,
  INVOICE_STATUS,
  AUTONOMY_STATE,
  type Tone,
} from "@/lib/types";

// Unified finance hub: Economics merged into Finance so the back office has one
// place for the ledger, accounts receivable / billables, per-engagement
// contribution margin, and autonomy economics. All computations are ported
// verbatim from the former finance, economics, and invoices pages.

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

export default async function FinancePage() {
  const [accounts, journalLines, journalEntries, payments, invoices, engagements, policies] =
    await Promise.all([
      prisma.ledgerAccount.findMany({ orderBy: { code: "asc" } }),
      prisma.journalLine.findMany({ include: { entry: true } }),
      prisma.journalEntry.findMany({
        include: { lines: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.payment.findMany({ orderBy: { receivedAt: "desc" } }),
      prisma.invoice.findMany({
        include: { tenant: true, engagement: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.engagement.findMany({ include: { tenant: true } }),
      prisma.autonomyPolicy.findMany({ orderBy: { actionCategory: "asc" } }),
    ]);

  // ── Ledger / trial balance (ported from finance/page.tsx + lib/ledger) ──
  // Balances are derived from journal lines, never stored.
  const balanceByAccount = new Map<string, number>();
  for (const l of journalLines) {
    balanceByAccount.set(
      l.accountCode,
      (balanceByAccount.get(l.accountCode) ?? 0) + l.debitMinor - l.creditMinor,
    );
  }
  const balances = accounts.map((a) => ({
    ...a,
    balanceMinor: balanceByAccount.get(a.code) ?? 0,
  }));
  const debits = balances.reduce((s, b) => s + Math.max(0, b.balanceMinor), 0);

  // Payment intake by method (ported from finance/page.tsx).
  const byMethod = new Map<string, number>();
  for (const p of payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amountMinor);
  const totalIntake = payments.reduce((s, p) => s + p.amountMinor, 0);

  // ── Accounts receivable / billables (ported from invoices/page.tsx) ──
  const billedMinor = invoices.reduce((s, i) => s + i.amountMinor, 0);
  const collectedMinor = invoices
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + i.amountMinor, 0);
  const outstandingMinor = invoices
    .filter((i) => i.status !== "PAID" && i.status !== "VOID")
    .reduce((s, i) => s + i.amountMinor, 0);
  const overdueMinor = invoices
    .filter((i) => i.status === "OVERDUE")
    .reduce((s, i) => s + i.amountMinor, 0);

  // ── Per-engagement economics (ported from economics/page.tsx) ──
  // Revenue (collected): sum of PAID invoice amounts, overall + per engagement.
  const revenueByEngagement = new Map<string, number>();
  let revenueMinor = 0;
  for (const inv of invoices) {
    if (inv.status !== "PAID") continue;
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

  const engagementRows: EngagementRow[] = engagements
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

  // ── Autonomy economics (ported from economics/page.tsx) ──
  // Graduation rate = % of policies in AUTONOMOUS state.
  const autonomousCount = policies.filter((p) => p.state === "AUTONOMOUS").length;
  const graduationRate = Math.round((100 * autonomousCount) / Math.max(1, policies.length));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Finance &amp; economics</h1>
        <p className="mt-1 text-sm text-slate-500">
          One finance hub: double-entry ledger as source of truth, accounts receivable, contribution
          margin per engagement, and autonomy economics.
        </p>
      </div>

      {/* 1. Top stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue collected" value={money(collectedMinor)} tone="success" />
        <Stat
          label="Outstanding AR"
          value={money(outstandingMinor)}
          tone={outstandingMinor > 0 ? "warn" : "neutral"}
          sub={overdueMinor > 0 ? `${money(overdueMinor)} overdue` : undefined}
        />
        <Stat
          label="Contribution margin"
          value={money(marginMinor)}
          tone={marginMinor < 0 ? "danger" : "success"}
          sub={`${money(revenueMinor)} revenue − ${money(cogsMinor)} COGS`}
        />
        <Stat
          label="Autonomy graduation rate"
          value={`${graduationRate}%`}
          tone="info"
          sub={`${autonomousCount} of ${policies.length} policies autonomous`}
        />
      </div>

      {/* 2. Accounts receivable / billables */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Billed" value={money(billedMinor)} />
        <Stat label="Collected" value={money(collectedMinor)} tone="success" />
        <Stat label="Outstanding" value={money(outstandingMinor)} />
        <Stat
          label="Overdue"
          value={money(overdueMinor)}
          tone={overdueMinor > 0 ? "danger" : "neutral"}
        />
      </div>

      <Card>
        <CardHeader title={`Accounts receivable — ${invoices.length} invoices`} />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Invoice</th>
              <th className="px-2 py-2.5">Client / engagement</th>
              <th className="px-2 py-2.5 text-right">Amount</th>
              <th className="px-2 py-2.5">Due</th>
              <th className="px-5 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((i) => (
              <tr key={i.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{i.number}</td>
                <td className="px-2 py-3">
                  <div className="text-slate-700">{i.tenant.name}</div>
                  {i.engagement ? (
                    <div className="text-xs text-slate-500">{i.engagement.name}</div>
                  ) : null}
                </td>
                <td className="px-2 py-3 text-right text-slate-700">
                  {money(i.amountMinor, i.currency)}
                </td>
                <td className="px-2 py-3 text-slate-500">{shortDate(i.dueAt)}</td>
                <td className="px-5 py-3">
                  <Badge tone={toneFor(INVOICE_STATUS, i.status)}>{i.status}</Badge>
                </td>
              </tr>
            ))}
            {invoices.length === 0 ? <EmptyRow colSpan={5} label="No invoices yet" /> : null}
          </tbody>
        </table>
      </Card>

      {/* 3. Per-engagement economics */}
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
            {engagementRows.map((r) => (
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
            {engagementRows.length === 0 ? <EmptyRow colSpan={4} label="No data yet" /> : null}
          </tbody>
        </table>
      </Card>

      {/* 4. Ledger */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total intake" value={money(totalIntake)} tone="success" />
        <Stat label="Payments" value={payments.length} />
        <Stat label="Ledger (Σ debit balances)" value={money(debits)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Trial balance" />
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {balances.map((b) => (
                <tr key={b.code}>
                  <td className="px-5 py-3 text-slate-500">{b.code}</td>
                  <td className="px-2 py-3 text-slate-700">{b.name}</td>
                  <td className="px-2 py-3 text-slate-400">{b.type}</td>
                  <td className="px-5 py-3 text-right font-medium text-slate-800">
                    {money(b.balanceMinor)}
                  </td>
                </tr>
              ))}
              {balances.length === 0 ? <EmptyRow colSpan={4} label="No accounts yet" /> : null}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader title="Payment intake by method" />
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {[...byMethod.entries()].map(([method, amt]) => (
                <tr key={method}>
                  <td className="px-5 py-3 text-slate-700">
                    <Badge>{method}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-slate-800">{money(amt)}</td>
                </tr>
              ))}
              {byMethod.size === 0 ? (
                <tr>
                  <td className="px-5 py-4 text-center text-sm text-slate-400">No payments yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </div>

      <Card>
        <CardHeader title="Journal" />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Date</th>
              <th className="px-2 py-2.5">Memo</th>
              <th className="px-2 py-2.5">Source</th>
              <th className="px-5 py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {journalEntries.map((e) => {
              const amt = e.lines.reduce((s, l) => s + l.debitMinor, 0);
              return (
                <tr key={e.id}>
                  <td className="px-5 py-3 text-slate-500">{shortDate(e.date)}</td>
                  <td className="px-2 py-3 text-slate-700">{e.memo}</td>
                  <td className="px-2 py-3">
                    <Badge>{e.source}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right text-slate-800">{money(amt)}</td>
                </tr>
              );
            })}
            {journalEntries.length === 0 ? <EmptyRow colSpan={4} label="No entries yet" /> : null}
          </tbody>
        </table>
      </Card>

      {/* 5. Autonomy economics */}
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
