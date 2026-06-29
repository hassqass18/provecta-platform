import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { Badge, Card, CardHeader } from "@/components/ui";
import { resetUserPasswordAction, setUserBlockedAction } from "@/server/crud";

export const dynamic = "force-dynamic";

const BTN = "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50";
const BLOCK_BTN = "rounded-lg border border-[#ff3b30]/40 px-3 py-1.5 text-xs font-medium text-[#d70015] hover:bg-[#ff3b30]/10";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ pwuser?: string; pw?: string }> }) {
  const sp = await searchParams;
  const me = await currentUser();
  const isSuper = me?.role === "SUPER_ADMIN" || me?.role === "ADMIN";

  if (!isSuper) {
    return <div className="text-sm text-slate-500">User management is restricted to admins.</div>;
  }

  const users = await prisma.user.findMany({
    orderBy: [{ disabled: "asc" }, { role: "asc" }, { email: "asc" }],
    include: { tenant: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Users &amp; access</h1>

      {sp.pwuser && sp.pw ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="font-semibold">Password reset for {sp.pwuser}.</span> Share securely — shown once:{" "}
          <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono">{sp.pw}</code>
        </div>
      ) : null}

      <Card>
        <CardHeader title={`${users.length} users`} />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">User</th>
              <th className="px-2 py-2.5">Role</th>
              <th className="px-2 py-2.5">Client</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="px-5 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="font-medium text-slate-800">{u.name || u.email}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="px-2 py-3"><Badge>{u.role}</Badge></td>
                <td className="px-2 py-3 text-slate-600">{u.tenant?.name ?? <span className="text-slate-400">—</span>}</td>
                <td className="px-2 py-3">
                  {u.disabled ? <Badge tone="danger">BLOCKED</Badge> : <Badge tone="success">Active</Badge>}
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <form action={resetUserPasswordAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="returnTo" value="/admin/users" />
                      <button className={BTN}>Reset password</button>
                    </form>
                    {u.id === me?.id ? (
                      <span className="text-xs text-slate-400">(you)</span>
                    ) : (
                      <form action={setUserBlockedAction}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="blocked" value={u.disabled ? "false" : "true"} />
                        <input type="hidden" name="returnTo" value="/admin/users" />
                        <button className={u.disabled ? BTN : BLOCK_BTN}>{u.disabled ? "Unblock" : "Block"}</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
