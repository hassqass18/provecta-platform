import { requireUser } from "@/lib/session";
import { Shell } from "@/components/shell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nav = [{ href: "/portal", label: "Overview" }];
  return (
    <Shell brand="Client Portal" nav={nav} user={user}>
      {children}
    </Shell>
  );
}
