"use client";

import { deleteClient } from "@/server/crud";

// Super-admin destructive control: permanently delete a client and its entire
// object graph. Two-step (confirm) so it's deliberate.
export default function DangerZone({ tenantId, name }: { tenantId: string; name: string }) {
  return (
    <details className="rounded-xl border border-[#ff3b30]/30 bg-[#ff3b30]/[0.03]">
      <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-[#d70015]">Danger zone</summary>
      <div className="space-y-3 px-5 pb-5">
        <p className="text-sm text-slate-600">
          Permanently delete <span className="font-semibold">{name}</span> — every engagement, document, proposal, contract,
          invoice, ticket, message and the client&apos;s login. This cannot be undone.
        </p>
        <form
          action={deleteClient}
          onSubmit={(e) => {
            if (!confirm(`Permanently delete "${name}" and ALL of its data?\n\nThis cannot be undone.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="tenantId" value={tenantId} />
          <button className="rounded-lg border border-[#ff3b30]/40 px-4 py-2 text-sm font-medium text-[#d70015] hover:bg-[#ff3b30]/10">
            Delete this client permanently
          </button>
        </form>
      </div>
    </details>
  );
}
