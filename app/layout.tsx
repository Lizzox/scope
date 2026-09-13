import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scope — Project planner",
  description: "A focused, self-hosted project planner for people and teams.",
  applicationName: "Scope",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Scope", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7F9" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0D10" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body><ServiceWorkerRegistration />{children}</body>
    </html>
  );
}
