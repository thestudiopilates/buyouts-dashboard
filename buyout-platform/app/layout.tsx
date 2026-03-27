import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "The Studio Pilates Management Portal",
  description: "Public intake and internal management dashboard for buyouts and operations."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
