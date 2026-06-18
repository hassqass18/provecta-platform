import type { ReactNode } from "react";
import { HamburgerNav, type NavLink, type NavAction } from "./hamburger-nav";

const NAV: NavLink[] = [
  { href: "/#library", label: "Tools & Resources" },
  { href: "/#what-we-do", label: "What We Do" },
  { href: "/portfolio", label: "Our Work" },
  { href: "/blog", label: "Insights" },
  { href: "https://brrain.io/architecture?ref=957c790577", label: "bRRAIn", external: true },
];

const ACTIONS: NavAction[] = [
  { href: "/login", label: "Client Login", variant: "outline" },
  { href: "mailto:hello@pgco.world?subject=Book a working session", label: "Book a Working Session", variant: "primary" },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div>
      <HamburgerNav brand="Group" items={NAV} actions={ACTIONS} />
      {children}
      <footer className="section-dark">
        <div className="pgcontainer" style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
          <div style={{ color: "#fff", fontWeight: 600 }}>Provecta Group — Business Operations on bRRAIn</div>
          <p style={{ color: "var(--text-white-secondary)", marginTop: "0.5rem", fontSize: "0.9rem" }}>
            © 2026 Provecta Group. A Genius Co company.
          </p>
          <a
            href="https://brrain.io/architecture?ref=957c790577"
            style={{ color: "var(--bright-blue)", fontSize: "0.85rem", display: "inline-block", marginTop: "0.75rem" }}
          >
            Powered by bRRAIn
          </a>
        </div>
      </footer>
    </div>
  );
}
