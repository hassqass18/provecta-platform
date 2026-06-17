import { prisma } from "@/lib/db";
import { trialBalance } from "@/lib/ledger";
import { Badge, Card, CardHeader, Stat } from "@/components/ui";
import { money, shortDate } from "@/lib/types";

export default async function FinancePage() {
  const [balances, payments, entries] = await Promise.all([
    trialBalance(),
    prisma.payment.findMany({ orderBy: { receivedAt: "desc" } }),
    prisma.journalEntry.findMany({ include: { lines: true }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const byMethod = new Map<string, number>();
  for (const p of payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amountMinor);
  const totalIntake = payments.reduce((s, p) => s + p.amountMinor, 0);
  const debits = balances.reduce((s, b) => s + Math.max(0, b.balanceMinor), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Finance — ledger &amp; unified intake</h1>
        <p className="mt-1 text-sm text-slate-500">
          Double-entry ledger as source of truth. Every payment intake on one dashboard, regardless of method.
        </p>
      </div>

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
                  <td className="px-5 py-3 text-right font-medium text-slate-800">{money(b.balanceMinor)}</td>
                </tr>
              ))}
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
                <tr><td className="px-5 py-4 text-center text-sm text-slate-400">No payments yet.</td></tr>
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
            {entries.map((e) => {
              const amt = e.lines.reduce((s, l) => s + l.debitMinor, 0);
              return (
                <tr key={e.id}>
                  <td className="px-5 py-3 text-slate-500">{shortDate(e.date)}</td>
                  <td className="px-2 py-3 text-slate-700">{e.memo}</td>
                  <td className="px-2 py-3"><Badge>{e.source}</Badge></td>
                  <td className="px-5 py-3 text-right text-slate-800">{money(amt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
