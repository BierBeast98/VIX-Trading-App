import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { SWRProvider } from "@/lib/swr-config";
import { AccessGate } from "@/components/auth/access-gate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VIX Trading — Personal Dashboard",
  description: "Personal VIX monitoring and trading dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // aktiviert env(safe-area-inset-*) auf dem iPhone
  themeColor: "#0C0C0F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SWRProvider>
          <AccessGate>
          {/* Mobil: das Dokument selbst scrollt (iOS-Toolbar fährt ein, Momentum-Scroll funktioniert).
              Desktop (lg): fixe Höhe mit innerem Scroll-Container wie zuvor. */}
          <div className="flex min-h-[100dvh] lg:h-screen lg:overflow-hidden" style={{ background: "#0C0C0F" }}>
            <Sidebar />
            <main className="min-w-0 flex-1 lg:overflow-y-auto pt-[calc(52px_+_env(safe-area-inset-top))] pb-[calc(64px_+_env(safe-area-inset-bottom))] lg:pt-0 lg:pb-0">
              {children}
            </main>
            <BottomTabBar />
          </div>
          </AccessGate>
        </SWRProvider>
      </body>
    </html>
  );
}
