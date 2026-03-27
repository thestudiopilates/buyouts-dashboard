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
    <div className="portal-layout">
      <aside className="portal-sidebar">
        <Link className="brand-mark" href="/dashboard">
          <span className="brand-badge">TSP</span>
          <span>Manager Portal</span>
        </Link>
        <nav className="nav-list">
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
      </aside>
      <main className="portal-main">{children}</main>
    </div>
  );
}
