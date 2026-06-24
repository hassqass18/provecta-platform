import { prisma } from "@/lib/db";
import { esignProvider } from "@/lib/esign";
import { createEnvelope, sendEnvelopeAction, simulateSign, uploadWetInk } from "@/server/ops-actions";
import { Badge, Card, CardHeader } from "@/components/ui";
import { shortDate, type Tone } from "@/lib/types";

const ENV_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  SENT: "info",
  SIGNED: "success",
  DECLINED: "danger",
  WET_INK_REQUIRED: "warn",
};

export default async function EsignPage() {
  const [envelopes, policies, clients] = await Promise.all([
    prisma.envelope.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.jurisdictionPolicy.findMany({ orderBy: [{ country: "asc" }, { docType: "asc" }] }),
    prisma.tenant.findMany({ where: { type: "CLIENT" }, orderBy: { name: "asc" } }),
  ]);
  const provider = esignProvider();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">E-signature</h1>
          <p className="mt-1 text-sm text-slate-500">
            E-sign by default; wet-ink upload only where a jurisdiction requires it.
          </p>
        </div>
        <Badge tone={provider === "STUB" ? "warn" : "success"}>
          provider: {provider === "STUB" ? "stub (gated)" : provider}
        </Badge>
      </div>

      <Card>
        <CardHeader title="Envelopes" />
        <div className="divide-y divide-slate-100">
          {envelopes.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{e.title}</span>
                  <Badge tone={ENV_TONE[e.status] ?? "neutral"}>{e.status.replace(/_/g, " ")}</Badge>
                  <span className="text-xs text-slate-400">{e.country}/{e.docType}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {e.signerName} · {e.signerEmail} · {shortDate(e.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {e.status === "DRAFT" ? (
                  <form action={sendEnvelopeAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <button className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-xs font-semibold text-white">Send</button>
                  </form>
                ) : null}
                {e.status === "SENT" ? (
                  <form action={simulateSign}>
                    <input type="hidden" name="id" value={e.id} />
                    <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Mark signed</button>
                  </form>
                ) : null}
                {e.status === "WET_INK_REQUIRED" ? (
                  <form action={uploadWetInk}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="url" value="uploaded://wet-ink-signed.pdf" />
                    <button className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">Upload wet-ink PDF</button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <form action={createEnvelope} className="grid gap-2 border-t border-slate-100 p-5 sm:grid-cols-3">
          <select name="tenantId" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">Client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input name="title" required placeholder="Document title" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input name="signerName" placeholder="Signer name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input name="signerEmail" placeholder="Signer email" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input name="country" placeholder="Country (US/KE/ZA)" defaultValue="US" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <select name="docType" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="AGREEMENT">AGREEMENT</option>
            <option value="LAND_TRANSFER">LAND_TRANSFER</option>
            <option value="LONG_LEASE">LONG_LEASE</option>
          </select>
          <div className="sm:col-span-3"><button className="rounded-lg bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Create envelope</button></div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Jurisdiction policy (wet-ink matrix)" />
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {policies.map((p) => (
              <tr key={p.id}>
                <td className="px-5 py-3 font-medium text-slate-700">{p.country}</td>
                <td className="px-2 py-3 text-slate-600">{p.docType}</td>
                <td className="px-5 py-3 text-right">
                  {p.requireWetInk ? <Badge tone="warn">WET-INK REQUIRED</Badge> : <Badge tone="success">E-SIGN OK</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
