import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import AppShell from "@/components/AppShell";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "JARVIS — Life OS",
  description: "Your AI life operating system — calendar, inbox, subscriptions, projects, fitness, and an agent that acts.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JARVIS",
  },
};

export const viewport: Viewport = {
  themeColor: "#080a0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "#080a0f" }}>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
