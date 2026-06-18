"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login(e: string, p: string, dest: string) {
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email: e, password: p, redirect: false });
    setLoading(false);
    if (!res || res.error) {
      setError("Invalid email or password");
      return;
    }
    router.push(dest);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          login(email, password, "/go");
        }}
        className="space-y-3"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none"
            placeholder="••••••••"
          />
        </div>
        {error ? <div className="text-sm text-rose-600">{error}</div> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[var(--color-brand)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-slate-300">
        <span className="h-px flex-1 bg-slate-200" />
        demo
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <button
        onClick={() => login("demo.client@provecta.dev", "demo1234", "/portal")}
        disabled={loading}
        className="w-full rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        View demo client dashboard →
      </button>
    </div>
  );
}
