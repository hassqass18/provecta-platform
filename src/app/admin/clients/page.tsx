import { getClients } from "@/server/data";
import { Badge, Card, CardHeader } from "@/components/ui";
import { NewForm, AINPUT, ABTN } from "@/components/admin-form";
import { createClient } from "@/server/crud";

export default async function ClientsPage() {
  const clients = await getClients();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Clients</h1>
      <Card>
        <CardHeader title={`${clients.length} client workspaces`} />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Client</th>
              <th className="px-2 py-2.5">Engagements</th>
              <th className="px-2 py-2.5">Users</th>
              <th className="px-2 py-2.5">Tickets</th>
              <th className="px-2 py-2.5">Main channel</th>
              <th className="px-5 py-2.5 text-right">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">
                  {c.name} {c.isDemo ? <Badge tone="info">DEMO</Badge> : null}
                </td>
                <td className="px-2 py-3 text-slate-600">{c._count.engagements}</td>
                <td className="px-2 py-3 text-slate-600">{c._count.users}</td>
                <td className="px-2 py-3 text-slate-600">{c._count.tickets}</td>
                <td className="px-2 py-3 text-slate-600">
                  {c.preferredChannel ? (
                    <Badge>{c.preferredChannel}</Badge>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-slate-500">{c.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <NewForm label="New client">
          <form action={createClient} className="flex flex-wrap items-end gap-2">
            <input name="name" required placeholder="Client / company name" className={`${AINPUT} max-w-xs`} />
            <select name="preferredChannel" defaultValue="" className={AINPUT} aria-label="Main communication channel">
              <option value="">Main channel…</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
              <option value="SLACK">Slack</option>
              <option value="OPEN">Open / any</option>
            </select>
            <input name="channelAddress" placeholder="Channel address (phone / email / id)" className={`${AINPUT} max-w-xs`} />
            <button className={ABTN}>Create client</button>
          </form>
          <p className="mt-1.5 px-1 text-xs text-slate-500">
            The main channel is the client&apos;s single point of contact — inbound there routes to them and becomes
            their information source.
          </p>
        </NewForm>
      </Card>
    </div>
  );
}
