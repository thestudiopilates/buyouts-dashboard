import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand-mark" href="/">
          <span className="brand-badge">TSP</span>
          <span>The Studio Pilates Management Portal</span>
        </Link>
        <div className="header-actions">
          <Link className="btn btn-secondary" href="/dashboard">
            Internal Dashboard
          </Link>
          <Link className="btn btn-primary" href="/buyouts/inquire">
            Start a Buyout Inquiry
          </Link>
        </div>
      </div>
    </header>
  );
}
