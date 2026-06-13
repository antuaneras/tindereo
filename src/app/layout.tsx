import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/app/globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Tindereo",
  description:
    "App social para tardeos y eventos con matching, chats y panel de organizador.",
  applicationName: "Tindereo",
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: [
      { url: `${basePath}/favicon-32x32.png`, sizes: "32x32", type: "image/png" },
      { url: `${basePath}/favicon-16x16.png`, sizes: "16x16", type: "image/png" },
      { url: `${basePath}/favicon.jpg`, type: "image/jpeg" }
    ],
    apple: [
      {
        url: `${basePath}/apple-touch-icon.png`,
        sizes: "180x180",
        type: "image/png"
      }
    ],
    shortcut: [`${basePath}/favicon-32x32.png`]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tindereo"
  }
};

export const viewport: Viewport = {
  themeColor: "#f97316"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
