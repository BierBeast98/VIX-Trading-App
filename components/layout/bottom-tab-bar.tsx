"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAlertCount } from "@/lib/hooks/use-alert-count";
import {
  LayoutDashboard,
  BarChart3,
  Briefcase,
  Bell,
  CalendarDays,
} from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/trades", label: "Positionen", icon: Briefcase },
  { href: "/alerts", label: "Alerts", icon: Bell, showBadge: true },
  { href: "/calendar", label: "Kalender", icon: CalendarDays },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const unacknowledgedCount = useAlertCount();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t lg:hidden"
      style={{
        background: "#0C0C0F",
        borderColor: "#1E1E28",
        height: 64,
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingTop: 4,
      }}
    >
      {tabs.map(({ href, label, icon: Icon, showBadge }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 relative"
          >
            <div className="relative">
              <Icon
                size={20}
                style={{ color: isActive ? "#B8E15A" : "#8B8FA8" }}
              />
              {showBadge && unacknowledgedCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                  style={{ background: "#FF4D4D" }}
                >
                  {unacknowledgedCount}
                </span>
              )}
            </div>
            <span
              className="text-[10px] font-medium"
              style={{ color: isActive ? "#B8E15A" : "#8B8FA8" }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
