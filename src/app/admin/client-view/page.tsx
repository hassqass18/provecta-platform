import { getDemoTenantId, getClientDashboard } from "@/server/data";
import { ClientDashboard } from "@/components/client-dashboard";
import { Card } from "@/components/ui";

export default async function ClientViewPage() {
  const tenantId = await getDemoTenantId();
  if (!tenantId) {
    return <Card className="p-8 text-center text-slate-500">No demo client configured.</Card>;
  }
  const data = await getClientDashboard(tenantId);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-800">
        👁 Viewing the client dashboard exactly as <strong>{data.tenant?.name}</strong> sees it (demo
        data).
      </div>
      <ClientDashboard data={data} />
    </div>
  );
}
