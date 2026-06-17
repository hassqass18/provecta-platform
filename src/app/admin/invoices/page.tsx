import { getAllInvoices } from "@/server/data";
import { markInvoicePaid } from "@/server/actions";
import { Badge, Card, CardHeader } from "@/components/ui";
import { INVOICE_STATUS, toneFor, money, shortDate } from "@/lib/types";

export default async function InvoicesPage() {
  const invoices = await getAllInvoices();
  const total = invoices.reduce((s, i) => s + i.amountMinor, 0);
  const collected = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amountMinor, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Invoices &amp; payments</h1>
        <p className="mt-1 text-sm text-slate-500">
          One ledger for every intake, regardless of method. Billed {money(total)} · collected{" "}
          {money(collected)}.
        </p>
      </div>

      <Card>
        <CardHeader title={`${invoices.length} invoices`} />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Invoice</th>
              <th className="px-2 py-2.5">Client</th>
              <th className="px-2 py-2.5">Amount</th>
              <th className="px-2 py-2.5">Method</th>
              <th className="px-2 py-2.5">Due</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="px-5 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((i) => (
              <tr key={i.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{i.number}</td>
                <td className="px-2 py-3 text-slate-600">{i.tenant.name}</td>
                <td className="px-2 py-3 text-slate-700">{money(i.amountMinor, i.currency)}</td>
                <td className="px-2 py-3 text-slate-500">{i.method ?? "—"}</td>
                <td className="px-2 py-3 text-slate-500">{shortDate(i.dueAt)}</td>
                <td className="px-2 py-3">
                  <Badge tone={toneFor(INVOICE_STATUS, i.status)}>{i.status}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  {i.status !== "PAID" && i.status !== "VOID" ? (
                    <form action={markInvoicePaid}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                        Mark paid
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
