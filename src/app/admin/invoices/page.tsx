import { getAllInvoices, getClients } from "@/server/data";
import { markInvoicePaid } from "@/server/actions";
import { createInvoice } from "@/server/crud";
import { Badge, Card, CardHeader } from "@/components/ui";
import { NewForm, AINPUT, ALABEL, ABTN } from "@/components/admin-form";
import { FilterBar } from "@/components/filter-bar";
import { INVOICE_STATUS, toneFor, money, shortDate } from "@/lib/types";
import Link from "next/link";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; sort?: string }> }) {
  const sp = await searchParams;
  const [invoices, clients] = await Promise.all([getAllInvoices(sp), getClients()]);
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar basePath="/admin/invoices" q={sp.q} activeStatus={sp.status} placeholder="Search invoices…"
          statuses={["DRAFT", "SENT", "PAID", "OVERDUE", "VOID"]} />
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500">Sort:</span>
          {([["createdAt", "Newest"], ["amount", "Amount"], ["due", "Due date"]] as const).map(([k, l]) => {
            const p = new URLSearchParams();
            if (sp.q) p.set("q", sp.q);
            if (sp.status) p.set("status", sp.status);
            if (k !== "createdAt") p.set("sort", k);
            const active = (sp.sort || "createdAt") === k;
            return (
              <Link key={k} href={`/admin/invoices${p.toString() ? `?${p}` : ""}`} className={active ? "font-semibold text-[#0071e3]" : "text-slate-500"}>
                {l}
              </Link>
            );
          })}
        </div>
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
        <NewForm label="New invoice">
          <form action={createInvoice} className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={ALABEL}>Client *</label>
              <select name="tenantId" required className={AINPUT} defaultValue="">
                <option value="">Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={ALABEL}>Amount (USD) *</label>
              <input name="amount" type="number" required className={AINPUT} placeholder="2100" />
            </div>
            <div>
              <label className={ALABEL}>Due date</label>
              <input name="dueAt" type="date" className={AINPUT} />
            </div>
            <div>
              <label className={ALABEL}>Method</label>
              <select name="method" className={AINPUT} defaultValue="STRIPE">
                {["STRIPE", "MPESA", "WISE", "MANUAL"].map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button className={ABTN}>Create invoice</button>
            </div>
          </form>
        </NewForm>
      </Card>
    </div>
  );
}
