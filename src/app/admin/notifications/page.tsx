import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { markAllRead } from "@/server/actions";
import { Card } from "@/components/ui";
import { shortDate } from "@/lib/types";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notes = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = notes.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">{unread} unread · {notes.length} total</p>
        </div>
        {unread > 0 ? (
          <form action={markAllRead}>
            <button className="rounded-lg bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              Mark all read
            </button>
          </form>
        ) : null}
      </div>
      <Card>
        <ul className="divide-y divide-slate-100">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 px-5 py-3">
              <span className={n.read ? "text-sm text-slate-500" : "text-sm font-medium text-slate-800"}>
                {!n.read ? <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#0071e3] align-middle" /> : null}
                {n.body}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{shortDate(n.createdAt)}</span>
            </li>
          ))}
          {notes.length === 0 ? <li className="px-5 py-8 text-center text-sm text-slate-400">No notifications yet.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
