"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAlertCount } from "@/lib/hooks/use-alert-count";
import {
  LayoutDashboard,
  History,
  BarChart3,
  Calendar,
  Bell,
  Settings,
  Zap,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trades", label: "Trades", icon: History },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/calendar", label: "Kalender", icon: Calendar },
  { href: "/alerts", label: "Alerts", icon: Bell, showBadge: true },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

// Mobile overlay only shows pages not in bottom tab bar
const mobileNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Kalender", icon: Calendar },
  { href: "/trades", label: "Trades", icon: History },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/alerts", label: "Alerts", icon: Bell, showBadge: true },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const unacknowledgedCount = useAlertCount();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const renderNav = (items: typeof navItems, showClose = false) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-6 border-b" style={{ borderColor: "#1E1E28" }}>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "#B8E15A" }}
        >
          <Zap size={16} className="text-black" />
        </div>
        <div>
          <div className="text-sm font-bold text-white leading-tight">VIX Trading</div>
          <div className="text-xs leading-tight" style={{ color: "#8B8FA8" }}>
            v1.1 — Moritz
          </div>
        </div>
        {showClose && (
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto p-1 rounded-lg"
            style={{ color: "#8B8FA8" }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {items.map(({ href, label, icon: Icon, showBadge }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "text-black"
                  : "hover:text-white"
              )}
              style={
                isActive
                  ? { background: "#B8E15A", color: "#000000" }
                  : { color: "#8B8FA8" }
              }
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {showBadge && unacknowledgedCount > 0 && (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                  style={{
                    background: isActive ? "#000000" : "#FF4D4D",
                    color: isActive ? "#B8E15A" : "#FFFFFF",
                  }}
                >
                  {unacknowledgedCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-4" style={{ borderColor: "#1E1E28" }}>
        <div className="text-xs" style={{ color: "#4A4A5A" }}>
          Kein Auto-Trading
        </div>
        <div className="text-xs" style={{ color: "#4A4A5A" }}>
          Nur Alerts & Tracking
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header bar */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 border-b lg:hidden"
        style={{ background: "#0C0C0F", borderColor: "#1E1E28" }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg"
          style={{ color: "#8B8FA8" }}
        >
          <Menu size={22} />
        </button>
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: "#B8E15A" }}
        >
          <Zap size={14} className="text-black" />
        </div>
        <span className="text-sm font-bold text-white">VIX Trading</span>
      </div>

      {/* Desktop sidebar — always visible on lg+ */}
      <aside
        className="hidden lg:flex h-full w-[220px] flex-shrink-0 flex-col border-r"
        style={{ background: "#0C0C0F", borderColor: "#1E1E28" }}
      >
        {renderNav(navItems)}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/60 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          {/* Sidebar panel */}
          <aside
            className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col lg:hidden"
            style={{ background: "#0C0C0F" }}
          >
            {renderNav(mobileNavItems, true)}
          </aside>
        </>
      )}
    </>
  );
}
