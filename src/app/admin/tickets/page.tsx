import { getAllTickets } from "@/server/data";
import { approveTicketAction, setTicketStatus } from "@/server/actions";
import { Badge, Card, CardHeader } from "@/components/ui";
import { TICKET_STATUS, AUTONOMY_STATE, toneFor } from "@/lib/types";

export default async function TicketsPage() {
  const tickets = await getAllTickets();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Tickets</h1>
        <p className="mt-1 text-sm text-slate-500">
          Omnichannel intake (WhatsApp · Slack · Telegram · Discord · Email · Portal). The system
          proposes an action; you approve until it earns autonomy.
        </p>
      </div>

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
