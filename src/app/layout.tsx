import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tide US · 美股潮汐",
  description:
    "US sector rotation & capital-flow proxy dashboard. Educational demo — not investment advice.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className="dark" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
