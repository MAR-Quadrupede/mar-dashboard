import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "M.A.R. Console",
  description: "Teleoperation & Telemetry Dashboard for M.A.R. Quadruped Platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
