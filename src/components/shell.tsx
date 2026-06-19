import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { HamburgerNav } from "./hamburger-nav";

export type NavItem = { href: string; label: string };

// Portal / back-office shell. Same glass hamburger nav as the landing; every
// menu item inside it. Theme (dark/light) is read from a cookie and applied to
// the wrapper scope; default is dark.
export async function Shell({
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
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
  return (
    <div className={theme === "light" ? "applight" : "appdark"}>
      <HamburgerNav brand={brand} items={nav} user={user} showSignOut theme={theme} drawer />
      <div style={{ position: "relative", zIndex: 1 }}>
        {banner}
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem" }}>{children}</main>
      </div>
    </div>
  );
}
