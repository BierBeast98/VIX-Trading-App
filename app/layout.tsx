import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { SWRProvider } from "@/lib/swr-config";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SWRProvider>
          <div className="flex h-screen overflow-hidden" style={{ background: "#0C0C0F" }}>
            <Sidebar />
            <main className="flex-1 overflow-y-auto pt-[52px] pb-[64px] lg:pt-0 lg:pb-0">
              {children}
            </main>
            <BottomTabBar />
          </div>
        </SWRProvider>
      </body>
    </html>
  );
}
