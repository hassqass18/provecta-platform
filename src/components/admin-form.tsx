import type { ReactNode } from "react";

// Theme-adaptive input styling for admin CRUD forms. Uses the standard
// slate/white utilities that the .appdark / .applight scopes retone, so inputs
// are legible in BOTH light and dark (the old hardcoded white-on-white was
// invisible on the light theme's white cards).
export const AINPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0071e3] focus:outline-none";
export const ALABEL = "mb-1 block text-xs font-medium text-slate-500";
export const ABTN = "rounded-lg bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90";

// Collapsible "+ New …" disclosure (native <details>, no client JS).
export function NewForm({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="border-t border-white/10">
      <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium text-[#5ab0ff] hover:bg-white/5">
        + {label}
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}
