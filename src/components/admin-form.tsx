import type { ReactNode } from "react";

// Dark-theme input styling for admin CRUD forms.
export const AINPUT =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-[#2997ff] focus:outline-none";
export const ALABEL = "mb-1 block text-xs font-medium text-white/55";
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
