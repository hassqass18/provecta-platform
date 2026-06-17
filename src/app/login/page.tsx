import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { defaultLandingFor } from "@/lib/rbac";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const u = await currentUser();
  if (u) redirect(defaultLandingFor(u.role));

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-navy)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold text-white">Provecta</div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Business Operations Platform
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-gold)]">built on bRRAIn</div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Admin credentials are in <code>ADMIN-CREDENTIALS.local.md</code>
        </p>
      </div>
    </div>
  );
}
