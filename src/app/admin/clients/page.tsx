import { getClients } from "@/server/data";
import { Badge, Card, CardHeader } from "@/components/ui";

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
                <td className="px-5 py-3 text-right text-slate-500">{c.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
