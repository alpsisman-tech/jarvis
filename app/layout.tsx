import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import AppShell from "@/components/AppShell";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "JARVIS",
  description: "Personal operations dashboard — health, training, nutrition, weather, projects, and an AI agent.",
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
  themeColor: "#0a0e14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "#0a0e14" }}>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
