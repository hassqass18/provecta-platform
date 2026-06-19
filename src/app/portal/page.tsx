import { requireUser } from "@/lib/session";
import { getClientDashboardProjection } from "@/server/data";
import { ClientDashboard } from "@/components/client-dashboard";
import { Card } from "@/components/ui";
import { prisma } from "@/lib/db";
import { shortDate } from "@/lib/types";

export default async function PortalPage() {
  const user = await requireUser();
  if (!user.tenantId) {
    return <Card className="p-8 text-center text-slate-500">No client workspace linked to this account.</Card>;
  }
  const [data, notifications] = await Promise.all([
    getClientDashboardProjection(user.tenantId),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return (
    <div className="space-y-6">
      {notifications.length > 0 ? (
        <Card className="p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            🔔 Updates from Provecta
          </div>
          <ul className="space-y-1.5">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-center justify-between text-sm">
                <span className={n.read ? "text-slate-500" : "font-medium text-slate-800"}>{n.body}</span>
                <span className="text-xs text-slate-400">{shortDate(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <ClientDashboard data={data} canRaiseTicket />
    </div>
  );
}
