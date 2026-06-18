"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

export type NavLink = { href: string; label: string; desc?: string; external?: boolean };
export type NavAction = { href: string; label: string; variant?: "primary" | "outline" };

// All-width hamburger nav (founder directive: every menu item lives in the
// hamburger). Glass bar + full-screen overlay — matches pgco.world, used by
// BOTH the landing and the portal/back-office.
export function HamburgerNav({
  brand,
  items,
  actions = [],
  showSignOut = false,
  user,
}: {
  brand: string;
  items: NavLink[];
  actions?: NavAction[];
  showSignOut?: boolean;
  user?: { name?: string | null; email: string; role?: string };
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <nav className="pgnav">
        <div className="pgnav__inner">
          <Link href="/" className="pgnav__logo" onClick={close}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/provecta-logo.png" alt="Provecta Group" />
            Provecta <span>{brand}</span>
          </Link>
          <button className="hamburger" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      <div className={`navmobile ${open ? "open" : ""}`} role="dialog" aria-modal="true">
        <button className="navmobile__close" aria-label="Close menu" onClick={close}>
          ✕
        </button>

        {user ? (
          <div style={{ textAlign: "center", marginBottom: "0.25rem" }}>
            <div style={{ color: "#fff", fontWeight: 600, fontSize: "1rem" }}>{user.name ?? user.email}</div>
            {user.role ? (
              <div style={{ color: "var(--text-white-secondary)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                {user.role}
              </div>
            ) : null}
          </div>
        ) : null}

        {items.map((i) =>
          i.external ? (
            <a key={i.href + i.label} href={i.href} target="_blank" rel="noopener noreferrer" onClick={close} style={{ textAlign: "center" }}>
              {i.label} ↗
            </a>
          ) : (
            <Link key={i.href + i.label} href={i.href} onClick={close} style={{ textAlign: "center" }}>
              {i.label}
              {i.desc ? (
                <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 400, color: "var(--text-white-secondary)" }}>
                  {i.desc}
                </span>
              ) : null}
            </Link>
          )
        )}

        {(actions.length > 0 || showSignOut) ? (
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
            {actions.map((a) => (
              <Link
                key={a.href + a.label}
                href={a.href}
                onClick={close}
                className={`btn ${a.variant === "outline" ? "btn-outline-light" : "btn-primary"}`}
              >
                {a.label}
              </Link>
            ))}
            {showSignOut ? (
              <button className="btn btn-outline-light" onClick={() => signOut({ callbackUrl: "/login" })}>
                Sign out
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* spacer for the fixed 48px nav */}
      <div style={{ height: 48 }} />
    </>
  );
}
