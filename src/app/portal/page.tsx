import { requireUser } from "@/lib/session";
import { getClientDashboardProjection } from "@/server/data";
import { ClientDashboard } from "@/components/client-dashboard";
import { Card } from "@/components/ui";
import { prisma } from "@/lib/db";
import { shortDate } from "@/lib/types";
import { changePasswordAction } from "@/server/account-actions";

const PW_MSG: Record<string, { text: string; ok: boolean }> = {
  ok: { text: "Password changed.", ok: true },
  wrong: { text: "Your current password is incorrect.", ok: false },
  short: { text: "Your new password must be at least 8 characters.", ok: false },
  err: { text: "Couldn't change your password.", ok: false },
};

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ pw?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
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

      <Card className="p-0">
        <details>
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-[var(--color-brand)]">Account &amp; security — change password</summary>
          <div className="space-y-3 px-5 pb-5">
            {sp.pw && PW_MSG[sp.pw] ? (
              <div className={`rounded-lg px-3 py-2 text-sm ${PW_MSG[sp.pw].ok ? "bg-emerald-50 text-emerald-800" : "bg-[#ff3b30]/10 text-[#d70015]"}`}>{PW_MSG[sp.pw].text}</div>
            ) : null}
            <p className="text-sm text-slate-500">Replace your temporary password with one only you know.</p>
            <form action={changePasswordAction} className="flex max-w-md flex-col gap-2">
              <input name="currentPassword" type="password" required placeholder="Current password" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" />
              <input name="newPassword" type="password" required minLength={8} placeholder="New password (min 8 characters)" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" />
              <button className="self-start rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">Update password</button>
            </form>
          </div>
        </details>
      </Card>
    </div>
  );
}
