import { getAllTickets, getClients } from "@/server/data";
import { approveTicketAction, setTicketStatus } from "@/server/actions";
import { createTicketAdmin } from "@/server/crud";
import { Badge, Card, CardHeader } from "@/components/ui";
import { NewForm, AINPUT, ALABEL, ABTN } from "@/components/admin-form";
import { TICKET_STATUS, AUTONOMY_STATE, toneFor } from "@/lib/types";

export default async function TicketsPage() {
  const [tickets, clients] = await Promise.all([getAllTickets(), getClients()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Tickets</h1>
        <p className="mt-1 text-sm text-slate-500">
          Omnichannel intake (WhatsApp · Slack · Telegram · Discord · Email · Portal). The system
          proposes an action; you approve until it earns autonomy.
        </p>
      </div>

      <Card>
        <CardHeader title="Raise a ticket" />
        <NewForm label="New ticket">
          <form action={createTicketAdmin} className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={ALABEL}>Client *</label>
              <select name="tenantId" required className={AINPUT} defaultValue="">
                <option value="">Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={ALABEL}>Channel</label>
              <select name="channel" className={AINPUT} defaultValue="PORTAL">
                {["PORTAL", "WHATSAPP", "SLACK", "TELEGRAM", "DISCORD", "EMAIL"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={ALABEL}>Subject *</label>
              <input name="subject" required className={AINPUT} placeholder="What does the client need?" />
            </div>
            <div>
              <label className={ALABEL}>Priority</label>
              <select name="priority" className={AINPUT} defaultValue="MEDIUM">
                {["LOW", "MEDIUM", "HIGH"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button className={ABTN}>Create ticket</button>
            </div>
          </form>
        </NewForm>
      </Card>

      <div className="space-y-4">
        {tickets.map((t) => (
          <Card key={t.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{t.subject}</span>
                  <Badge>{t.channel}</Badge>
                  <Badge tone={toneFor(TICKET_STATUS, t.status)}>{t.status.replace("_", " ")}</Badge>
                  <Badge tone={toneFor(AUTONOMY_STATE, t.autonomyState)}>
                    {t.autonomyState.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {t.tenant.name}
                  {t.engagement ? ` · ${t.engagement.code}` : ""}
                </div>
                {t.proposedAction ? (
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <span className="font-medium text-slate-700">Proposed action: </span>
                    {t.proposedAction}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {t.status !== "RESOLVED" && t.status !== "CLOSED" ? (
                  <form action={approveTicketAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                      Approve action
                    </button>
                  </form>
                ) : null}
                <form action={setTicketStatus}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="status" value="CLOSED" />
                  <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    Close
                  </button>
                </form>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
