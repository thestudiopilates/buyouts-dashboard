import Link from "next/link";
import { ReactNode } from "react";

const navItems = [
  { href: "/dashboard", label: "Home" },
  { href: "/buyouts", label: "Buyouts" },
  { href: "/dashboard/migration", label: "Migration" },
  { href: "#", label: "Projects" },
  { href: "#", label: "Studio Schedule" },
  { href: "#", label: "Front Desk" },
  { href: "#", label: "Reports" },
  { href: "#", label: "Settings" }
];

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
