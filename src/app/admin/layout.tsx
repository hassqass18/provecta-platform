import { requireAdmin } from "@/lib/session";
import { Shell } from "@/components/shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const nav = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/clients", label: "Clients" },
    { href: "/admin/engagements", label: "Engagements" },
    { href: "/admin/brain", label: "Brain · Proposals" },
    { href: "/admin/tickets", label: "Tickets" },
    { href: "/admin/autonomy", label: "Autonomy" },
    { href: "/admin/finance", label: "Finance" },
    { href: "/admin/invoices", label: "Invoices" },
    { href: "/admin/esign", label: "E-signature" },
    { href: "/admin/change", label: "Change (ADKAR)" },
    { href: "/admin/client-view", label: "View as client (demo)" },
  ];
  return (
    <Shell brand="Back Office" nav={nav} user={user}>
      {children}
    </Shell>
  );
}
