import Link from "next/link";
import { ReactNode } from "react";

const navItems = [
  { href: "/dashboard", label: "Home" },
  { href: "/buyouts", label: "Buyouts" },
  { href: "/dashboard/migration", label: "Migration" },
  { href: "/projects", label: "Projects" },
  { href: "/studio-schedule", label: "Studio Schedule" },
  { href: "/front-desk", label: "Front Desk" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" }
] as const;

export function PortalShell({
  children,
  activeHref
}: {
  children: ReactNode;
  activeHref: string;
}) {
  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div className="portal-header-row">
          <Link className="brand-mark" href="/dashboard">
            <span className="brand-badge">TSP</span>
            <span className="brand-wordmark">
              <strong>The Studio Pilates</strong>
              <em>Management Portal</em>
            </span>
          </Link>
        </div>
        <nav className="portal-nav-list">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`nav-item${activeHref === item.href ? " active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="portal-main">{children}</main>
    </div>
  );
}
