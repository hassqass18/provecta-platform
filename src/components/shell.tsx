import type { ReactNode } from "react";
import { HamburgerNav } from "./hamburger-nav";

export type NavItem = { href: string; label: string };

// Portal / back-office shell. Founder directive: same glass hamburger nav as
// the landing, every menu item inside it — no sidebar, no mobile strip.
export function Shell({
  brand,
  nav,
  user,
  banner,
  children,
}: {
  brand: string;
  nav: NavItem[];
  user: { name?: string | null; email: string; role: string };
  banner?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="appdark">
      <HamburgerNav brand={brand} items={nav} user={user} showSignOut />
      <div style={{ position: "relative", zIndex: 1 }}>
        {banner}
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem" }}>{children}</main>
      </div>
    </div>
  );
}
