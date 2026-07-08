import { prisma } from "./prisma";
import { sendAlertEmail } from "./resend";
import { berlinDay } from "./trading-hours";
import type { AlertResult } from "./alert-engine";

/**
 * Arm/Re-Arm-Zustandsmaschine für Alerts.
 *
 * Jede überwachte Bedingung wird pro Lauf als Evaluation gemeldet — auch wenn sie
 * NICHT erfüllt ist (alert: null), sonst kann die Bedingung nie wieder scharf werden.
 *
 * Regeln:
 * - Bedingung wird true  → 1 Alert, Zustand "aktiv"
 * - bleibt true          → max. 1 Erinnerung pro Handelstag (Berlin), wenn remindDaily
 * - wird false           → Zustand "inaktiv" (Re-Arm), kein Alert
 * - edge-Alerts (Trailing aktiviert/angehoben) → immer senden, kein Zustand
 * - Anti-Flap: mind. 30 Min Abstand zwischen Sendungen desselben Keys
 */

const REFIRE_GUARD_MS = 30 * 60 * 1000;

export interface Evaluation {
  /** dedupeKey der Bedingung — Pflicht, auch wenn alert null ist */
  key: string;
  alert: AlertResult | null;
  /** Erinnerung an Folgetagen, solange die Bedingung aktiv bleibt (default true) */
  remindDaily?: boolean;
}

export interface DispatchResult {
  sent: AlertResult[];
  suppressed: { alert: AlertResult; reason: string }[];
}

export async function dispatchAlerts(
  evaluations: Evaluation[],
  opts: { email: string | null; vixLevel: number | null; dryRun: boolean }
): Promise<DispatchResult> {
  const now = new Date();
  const today = berlinDay(now);
  const sent: AlertResult[] = [];
  const suppressed: { alert: AlertResult; reason: string }[] = [];

  const keys = evaluations.map((e) => e.key);
  const states = new Map(
    (
      await prisma.alertState.findMany({ where: { key: { in: keys } } })
    ).map((s) => [s.key, s])
  );

  const send = async (alert: AlertResult) => {
    if (!opts.dryRun) {
      if (opts.email) await sendAlertEmail(alert, opts.email);
      await prisma.alertLog.create({
        data: {
          alertType: alert.type,
          message: alert.message,
          vixLevel: alert.vixLevel ?? opts.vixLevel,
          urgency: alert.urgency,
          dedupeKey: alert.dedupeKey,
        },
      });
    }
    sent.push(alert);
  };

  for (const e of evaluations) {
    const st = states.get(e.key);
    const remindDaily = e.remindDaily !== false;

    // Edge-Events: immer senden, kein Arm/Re-Arm-Zustand nötig
    if (e.alert?.edge) {
      await send(e.alert);
      continue;
    }

    if (e.alert) {
      // Bedingung ist erfüllt
      const guardOk =
        !st?.lastFiredAt || now.getTime() - st.lastFiredAt.getTime() >= REFIRE_GUARD_MS;

      if (!st?.active && guardOk) {
        // Bedingung neu eingetreten → initiales Feuern
        await send(e.alert);
        if (!opts.dryRun) {
          await prisma.alertState.upsert({
            where: { key: e.key },
            update: { active: true, since: now, lastFiredAt: now, lastFiredDay: today },
            create: { key: e.key, active: true, since: now, lastFiredAt: now, lastFiredDay: today },
          });
        }
      } else if (st?.active && remindDaily && st.lastFiredDay !== today && guardOk) {
        // Neuer Handelstag, Bedingung weiter aktiv → eine Erinnerung
        const reminder: AlertResult = {
          ...e.alert,
          message: `Erinnerung: ${e.alert.message}`,
          urgency: e.alert.urgency === "high" ? "medium" : e.alert.urgency,
        };
        await send(reminder);
        if (!opts.dryRun) {
          await prisma.alertState.update({
            where: { key: e.key },
            data: { lastFiredAt: now, lastFiredDay: today },
          });
        }
      } else {
        suppressed.push({
          alert: e.alert,
          reason: st?.active ? (guardOk ? "already-active-today" : "refire-guard") : "refire-guard",
        });
        if (!st?.active && !opts.dryRun) {
          // Bedingung aktiv, aber Guard unterdrückt Sendung → trotzdem als aktiv markieren
          await prisma.alertState.upsert({
            where: { key: e.key },
            update: { active: true, since: now },
            create: { key: e.key, active: true, since: now },
          });
        }
      }
    } else if (st?.active) {
      // Bedingung nicht mehr erfüllt → Re-Arm
      if (!opts.dryRun) {
        await prisma.alertState.update({
          where: { key: e.key },
          data: { active: false },
        });
      }
    }
  }

  // Aufräumen: inaktive Zustände, die seit >7 Tagen unverändert sind (v.a. abgelaufene Events)
  if (!opts.dryRun) {
    await prisma.alertState
      .deleteMany({
        where: { active: false, updatedAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
      })
      .catch((err) => console.error("[alert-dispatch] state cleanup:", err));
  }

  return { sent, suppressed };
}
