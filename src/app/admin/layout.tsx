import { requireAdmin } from "@/lib/session";
import { Shell } from "@/components/shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const nav = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/clients", label: "Clients" },
    { href: "/admin/users", label: "Users & access" },
    { href: "/admin/engagements", label: "Engagements" },
    { href: "/admin/brain", label: "bRRAIn" },
    { href: "/admin/tickets", label: "Tickets" },
    { href: "/admin/approvals", label: "Approvals" },
    { href: "/admin/notifications", label: "Notifications" },
    { href: "/admin/finance", label: "Finance & economics" },
    { href: "/admin/invoices", label: "Invoices" },
    { href: "/admin/ops-health", label: "Ops health" },
    { href: "/admin/esign", label: "E-signature" },
    { href: "/admin/client-view", label: "View as client" },
  ];
  return (
    <Shell brand="Back Office" nav={nav} user={user}>
      {children}
    </Shell>
  );
}
