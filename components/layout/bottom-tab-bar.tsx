"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  BellRing,
} from "lucide-react";
import { useSignalOverview } from "@/lib/use-signal-overview";

const tabs = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/signals", label: "Signale", icon: BellRing },
  { href: "/trades", label: "Trades", icon: Briefcase },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const pending = useSignalOverview()?.pending.length ?? 0;

  return (
    <nav
      aria-label="Schnellnavigation"
      className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-3 border-t border-border bg-background/95 px-3 backdrop-blur lg:hidden"
      style={{
        height: "calc(64px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        const dot = href === "/signals" && pending > 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            aria-label={dot ? `${label}, ${pending} offen` : undefined}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${isActive ? "text-accent" : "text-muted"}`}
          >
            <span className="relative">
              <Icon size={22} aria-hidden="true" />
              {dot && <span aria-hidden="true" className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-background" />}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
