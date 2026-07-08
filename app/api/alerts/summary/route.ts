import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALERT_TYPES } from "@/lib/alert-types";

// Pro Alert-Typ: letzter Auslöse-Zeitpunkt + ob die Bedingung gerade aktiv ist
// (für die Config-Karten auf der Alerts-Seite)

export interface AlertTypeSummary {
  lastAt: string | null;
  lastMessage: string | null;
  active: boolean;
}

export async function GET() {
  try {
    const [lastByType, activeStates] = await Promise.all([
      prisma.alertLog.groupBy({
        by: ["alertType"],
        _max: { sentAt: true },
      }),
      prisma.alertState.findMany({ where: { active: true }, select: { key: true } }),
    ]);

    // Letzte Message pro Typ nachladen (wenige Typen — gezielte Queries sind ok)
    const lastLogs = await Promise.all(
      lastByType.map((g) =>
        g._max.sentAt
          ? prisma.alertLog.findFirst({
              where: { alertType: g.alertType, sentAt: g._max.sentAt },
              select: { alertType: true, sentAt: true, message: true },
            })
          : null
      )
    );
    const lastMap = new Map(
      lastLogs.filter((l): l is NonNullable<typeof l> => l != null).map((l) => [l.alertType, l])
    );

    // AlertState-Keys → Typ (Key-Präfix vor ":", "trailingStopBreach" zählt zu trailingStop)
    const activeTypes = new Set(
      activeStates.map((s) => {
        const prefix = s.key.split(":")[0];
        return prefix === "trailingStopBreach" ? "trailingStop" : prefix;
      })
    );

    const types: Record<string, AlertTypeSummary> = {};
    for (const t of ALERT_TYPES) {
      const last = lastMap.get(t);
      types[t] = {
        lastAt: last?.sentAt.toISOString() ?? null,
        lastMessage: last?.message ?? null,
        active: activeTypes.has(t),
      };
    }

    return NextResponse.json({ types });
  } catch (err) {
    console.error("[alerts/summary]", err);
    return NextResponse.json({ types: {} }, { status: 500 });
  }
}
