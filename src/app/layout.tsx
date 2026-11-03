import type { Metadata, Viewport } from "next";
import { SettingsProvider } from "@/components/settings-provider";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { DEFAULT_SETTINGS, getSettings } from "@/db/workspace";
import { isEmailAllowed } from "@/lib/env";
import { getCurrentUser } from "@/server/auth";
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

/** Public pages use the defaults; only allowed users get a workspace. */
async function getRequestSettings() {
  const user = await getCurrentUser();
  if (!user || !isEmailAllowed(user.email)) {
    return DEFAULT_SETTINGS;
  }
  return getSettings(user.id);
}

export async function generateViewport(): Promise<Viewport> {
  const { theme } = await getRequestSettings();

  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    colorScheme: theme,
    themeColor: theme === "dark" ? "#0f172a" : "#f8fafc",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await getRequestSettings();

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
