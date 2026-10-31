import type { Metadata, Viewport } from "next";
import { SettingsProvider } from "@/components/settings-provider";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { getSettings } from "@/db/bootstrap";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Interprep",
  description: "Interpreter terminology trainer",
  applicationName: "Interprep",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Interprep",
    statusBarStyle: "default",
  },
};

export async function generateViewport(): Promise<Viewport> {
  const { theme } = getSettings();

  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    colorScheme: theme,
    themeColor: theme === "dark" ? "#0f172a" : "#f8fafc",
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = getSettings();

  return (
    <html lang={settings.language} data-theme={settings.theme}>
      <body className="min-h-dvh antialiased">
        <SettingsProvider
          initialTheme={settings.theme}
          initialLanguage={settings.language}
        >
          {children}
        </SettingsProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
