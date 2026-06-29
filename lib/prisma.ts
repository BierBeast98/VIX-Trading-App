/**
 * INFRASTRUKTUR-ÜBERSICHT
 * ========================
 * GitHub  → Code-Repository (BierBeast98/VIX-Trading-App)
 *           Jeder Push zu `main` triggert automatisch ein Deployment auf Hostinger.
 *
 * Hostinger → Hosting + Domain (vix-trading.de)
 *             Next.js läuft auf Node.js 22.x direkt auf Hostinger.
 *             Env Vars setzen unter: Einsätze → Einstellungen und erneute Bereitstellung
 *             Cron Jobs ohne Beschränkung.
 *
 * Neon    → PostgreSQL-Datenbank (serverless)
 *           Prisma v5 mit @prisma/adapter-neon — kein Binary Query Engine (verhindert Panics).
 *           DATABASE_URL = gepoolte Verbindung (für die App)
 *           DIRECT_URL   = direkte Verbindung (für Prisma Migrationen)
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// WebSocket für Neon serverless in Node.js Umgebung
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? "";
  const log: ("error")[] =
    process.env.NODE_ENV === "development" ? ["error"] : [];

  // Lokale Entwicklung gegen ein normales PostgreSQL: der Neon-Serverless-Treiber
  // spricht WebSocket und kann sich nicht mit lokalem Postgres verbinden. Nur wenn
  // die DATABASE_URL auf Neon zeigt, den Neon-Adapter verwenden (= Produktion).
  const isNeon = url.includes("neon.tech");
  if (!isNeon) {
    return new PrismaClient({ log });
  }

  const pool = new Pool({ connectionString: url });
  const adapter = new PrismaNeon(pool);
  return new PrismaClient({ adapter, log });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
