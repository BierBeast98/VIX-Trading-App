"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  History,
  Database,
  BellRing,
  Calendar,
  Zap,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSignalOverview } from "@/lib/use-signal-overview";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/signals", label: "Handelssignale", icon: BellRing },
  { href: "/trades", label: "Trades", icon: History },
  { href: "/archive", label: "Datenarchiv", icon: Database },
  { href: "/calendar", label: "Kalender", icon: Calendar },
];

export function Sidebar() {
  const pathname = usePathname();
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const mobileOpen = openOnPath === pathname;
  const close = () => setOpenOnPath(null);
  const signals = useSignalOverview();
  const pendingCount = signals?.pending.length ?? 0;

  const renderNav = (items: typeof navItems, showClose = false) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-6 border-b" style={{ borderColor: "#1E1E28" }}>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-[9px]"
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
            onClick={close}
            aria-label="Menü schließen"
            className="ml-auto p-1 rounded-lg"
            style={{ color: "#8B8FA8" }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Hauptnavigation" className="flex flex-col gap-0.5 p-3 flex-1">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          const badge = href === "/signals" && pendingCount > 0 ? pendingCount : null;
          return (
            <Link
              key={href}
              href={href}
              onClick={showClose ? close : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm transition-colors",
                isActive ? "bg-accent/12 font-medium text-accent" : "text-muted hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon size={17} aria-hidden="true" />
              <span className="flex-1">{label}</span>
              {badge != null && (
                <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold leading-[18px] text-black" aria-label={`${badge} offene Signale`}>{badge}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Monitoring status */}
      <div className="m-3 mt-0 flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-3.5 text-xs text-muted">
        {signals ? (
          <>
            <div className="flex items-center gap-2 text-[13px] font-medium text-white">
              <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", signals.enabled ? "bg-success" : "bg-muted")} />
              {signals.enabled ? "Überwachung aktiv" : "Überwachung pausiert"}
            </div>
            <div>
              {signals.checkedAt ? `Letzte Prüfung ${new Date(signals.checkedAt).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })}` : "Noch nicht geprüft"}
              {signals.opensAt && signals.closesAt && ` · ${signals.broker || "Broker"} ${signals.opensAt}–${signals.closesAt}`}
            </div>
          </>
        ) : (
          <div>Signale &amp; Tracking</div>
        )}
        <div>Kein Auto-Trading</div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header bar */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 pb-3 border-b lg:hidden"
        style={{
          background: "#0C0C0F",
          borderColor: "#1E1E28",
          paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)",
        }}
      >
        <button
          onClick={() => setOpenOnPath(pathname)}
          aria-label="Menü öffnen"
          aria-expanded={mobileOpen}
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
        className="hidden lg:flex h-full w-[232px] flex-shrink-0 flex-col border-r"
        style={{ background: "#0C0C0F", borderColor: "#1E1E28" }}
      >
        {renderNav(navItems)}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[60] bg-black/60 lg:hidden"
            onClick={close}
          />
          {/* Sidebar panel */}
          <aside
            className="fixed inset-y-0 left-0 z-[60] flex w-[260px] flex-col lg:hidden"
            style={{ background: "#0C0C0F" }}
          >
            {renderNav(navItems, true)}
          </aside>
        </>
      )}
    </>
  );
}
