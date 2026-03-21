/**
 * INFRASTRUKTUR-ÜBERSICHT
 * ========================
 * GitHub  → Code-Repository (BierBeast98/VIX-Trading-App)
 *           Jeder Push zu `main` triggert automatisch ein Deployment auf Hostinger.
 *
 * Hostinger → Hosting + Domain (vix-trading.de)
 *             Next.js läuft auf Node.js 22.x direkt auf Hostinger (kein Vercel nötig!).
 *             Env Vars setzen unter: Einsätze → Einstellungen und erneute Bereitstellung
 *             Cron Jobs ohne Beschränkung (anders als Vercel Hobby Plan).
 *
 * Neon    → PostgreSQL-Datenbank (serverless)
 *           Prisma v5 als ORM — NICHT auf v7 updaten (bricht datasource URL Config).
 *           DATABASE_URL = gepoolte Verbindung (für die App)
 *           DIRECT_URL   = direkte Verbindung (für Prisma Migrationen)
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
