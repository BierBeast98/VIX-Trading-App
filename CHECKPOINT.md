# CHECKPOINT — VIX Trading Dashboard

> Dieses Dokument wird automatisch am Ende jeder Claude-Sitzung aktualisiert.
> **Beim Start einer neuen Sitzung zuerst lesen.**

---

## Projektziel

Persönliches VIX-Monitoring und Trading-Dashboard für Moritz.
Überwacht den VIX-Index, verwaltet Short-/Long-Positionen auf Vontobel-Knock-Out-Zertifikate und sendet automatische E-Mail-Alerts bei Einstiegssignalen, Standard-Abweichungs-Ausreißern, VIX-Spikes und Trailing-Stop-Ereignissen.

**Live-URL:** https://vix-trading.de

---

## Infrastruktur

| Komponente   | Dienst                              | Details                                              |
|-------------|-------------------------------------|------------------------------------------------------|
| Hosting     | Hostinger                           | Node.js 22.x, Auto-Deploy bei Push auf `main`        |
| Domain      | vix-trading.de                      | Hostinger DNS                                        |
| Datenbank   | Neon PostgreSQL (serverless)        | Prisma v5 + `@prisma/adapter-neon`, EU-Region        |
| E-Mail      | Resend                              | Transaktionale Alerts                                |
| Marktdaten  | Yahoo Finance (`yahoo-finance2`)    | VIX Spot, VIX3M Futures, EUR/USD, S&P 500            |
| Zertifikate | Vontobel (`markets.vontobel.com`)   | Scraping/API für Bid-Preise & Intraday-Daten         |
| Repository  | GitHub (BierBeast98/VIX-Trading-App)| Push → Hostinger Deploy                              |

---

## Tech-Stack

- **Framework:** Next.js 16.1.6 (App Router) + React 19
- **Sprache:** TypeScript
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts 3
- **Datenfetching (Client):** SWR 2
- **Formulare:** React Hook Form + Zod
- **ORM:** Prisma 5 mit Neon Adapter
- **Icons:** Lucide React

---

## Projektstruktur

```
app/
├── api/
│   ├── alerts/          check/, test/     — Alert-System + Cron-Endpoint
│   ├── analytics/                         — Performance-Metriken & Backtest
│   ├── calendar/                          — Wirtschaftskalender
│   ├── certificates/[id]/                 — Zertifikat-Details
│   ├── positions/       [id]/             — Positions-CRUD
│   ├── settings/                          — App-Einstellungen
│   ├── trades/          [id]/             — Trades-CRUD
│   ├── vix/             spot/, futures/, historical/
│   ├── vontobel/        price/, intraday/, batch/, product/
│   └── widget/                            — Scriptable iOS-Widget Endpoint ← NEU
├── dashboard/                             — Hauptseite
├── trades/                                — Trade-Historie
├── positions/                             — Offene Positionen
├── analytics/                             — Statistiken & Backtest
├── settings/                              — Einstellungen
├── calendar/                              — Wirtschaftskalender
└── alerts/                                — Alert-Verlauf

lib/
├── prisma.ts            — Singleton Prisma Client (Neon Adapter)
├── yahoo-finance.ts     — Yahoo Finance + Vontobel Daten-Fetching
├── alert-engine.ts      — Alert-Logik (Entry, StdDev, Spike, TrailingStop)
├── analytics.ts         — Backtest + Performance-Metriken
├── economic-calendar.ts — Wirtschaftskalender 2026
├── resend.ts            — E-Mail-Versand (Resend API)
├── server-cache.ts      — In-Memory Cache (Node.js Process)
├── trading-hours.ts     — Handelszeiten Mo–Fr 07:00–22:30 CET
├── swr-config.tsx       — SWR Provider-Konfiguration
└── utils.ts             — Formatierung, calcZScore, calcSharpeRatio, cn()
```

---

## Datenbank-Modelle (Prisma)

| Model       | Zweck                                                              |
|-------------|-------------------------------------------------------------------|
| `Settings`  | Einzelne Konfigurationszeile (id=1) — Thresholds, ISIN, Budget   |
| `Position`  | Offene/geschlossene Knock-Out Position (short/long)               |
| `Trade`     | Einzelner Kauf/Verkauf, verknüpft mit Position                    |
| `AlertLog`  | Verlauf aller gesendeten Alerts                                   |
| `VixCache`  | Allgemeiner JSON-Cache (spot, history_closes, vontobel_ISIN, ...) |
| `VixIntraday` | 5-Minuten Intraday-Daten (VIX + FUTURES)                       |

---

## Wichtige API-Endpunkte

| Endpoint                         | Methode | Funktion                                           |
|---------------------------------|---------|----------------------------------------------------|
| `/api/vix/spot`                 | GET     | VIX Spot + Futures + EUR/USD + Z-Score (gecacht)   |
| `/api/vix/historical`           | GET     | Historische VIX-Daten für Charts                   |
| `/api/positions`                | GET/POST| Offene Positionen lesen/anlegen                    |
| `/api/positions/[id]`           | PUT/DEL | Position aktualisieren/schließen                   |
| `/api/trades`                   | GET/POST| Trade-Historie                                     |
| `/api/alerts/check`             | GET     | **Cron-Job** (alle 5 min, Bearer-Auth)             |
| `/api/analytics`                | GET     | Win-Rate, Sharpe, Backtest-Ergebnisse              |
| `/api/vontobel/batch`           | GET     | Batch-Preise für mehrere ISINs                     |
| `/api/widget`                   | GET     | iOS Scriptable Widget-Daten ← NEU                  |
| `/api/settings`                 | GET/PUT | App-Einstellungen                                  |
| `/api/calendar`                 | GET     | Wirtschaftskalender-Events                         |

---

## Caching-Strategie

Drei Ebenen, von schnell nach langsam:
1. **In-Memory** (`lib/server-cache.ts`) — TTL 5 min, innerhalb des Node.js-Prozesses
2. **DB-Cache** (`VixCache` Tabelle) — Fallback wenn In-Memory kalt
3. **Externe APIs** — Yahoo Finance / Vontobel, nur bei Cache-Miss

---

## Cron-Job

- **Endpoint:** `GET https://vix-trading.de/api/alerts/check`
- **Auth:** `Authorization: Bearer <CRON_SECRET>`
- **Frequenz:** Alle 5 Minuten, Mo–Fr 07:00–22:30 CET
- **Konfiguriert auf:** Hostinger Cron-Dashboard
- **Prüft:** VIX-Entry, Z-Score, Spike, Trailing Stop, Wirtschaftsevents (2h Vorwarnung)

---

## Umgebungsvariablen

| Variable        | Quelle   | Zweck                                    |
|----------------|----------|------------------------------------------|
| `DATABASE_URL`  | Neon     | Gepoolte PostgreSQL-Verbindung (App)     |
| `DIRECT_URL`    | Neon     | Direkte Verbindung (Prisma Migrationen)  |
| `RESEND_API_KEY`| Resend   | E-Mail-Versand                           |
| `CRON_SECRET`   | Custom   | Bearer-Token für Cron-Endpoint           |

Setzen unter: Hostinger → Einsätze → Einstellungen und erneute Bereitstellung

---

## iOS Widget (Scriptable)

- **Script:** `~/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents/Untitled Script.js`
- **Sync:** Automatisch über iCloud Drive → Scriptable App auf iPhone
- **Endpoint:** `GET https://vix-trading.de/api/widget`
- **Response-Format:**
  ```json
  {
    "updatedAt": "ISO-Timestamp",
    "markets": [
      { "symbol": "VIX",  "price": 18.34, "changePct": -1.2 },
      { "symbol": "VX",   "price": 19.10, "changePct": -0.8 },
      { "symbol": "ES=F", "price": 5432.25, "changePct": 0.4 }
    ],
    "positions": [
      { "name": "Short KO", "entryPrice": 1.234, "currentPrice": 1.150, "pnlPct": 6.81, "direction": "short" }
    ]
  }
  ```
- **Caching:** 5 Min In-Memory (`widget-data`) + CORS-Headers
- **Status:** ✅ Deployed auf Hostinger (gepusht 2026-03-25)

---

## Zuletzt durchgeführte Änderungen (2026-03-25)

### Session 1 (früher)
- `app/api/widget/route.ts` — Widget-Endpoint deployed: VIX, VX (Futures), ES=F (S&P500) + offene Positionen mit P&L, CORS-Headers, eigener 5-Min-Cache
- `vercel.json` — gelöscht (Hosting nur über Hostinger)
- `.gitignore`, `README.md` — Vercel-Referenzen vollständig entfernt
- `lib/server-cache.ts`, `lib/prisma.ts`, `vontobel/batch/route.ts` — alle Vercel-Kommentare auf Hostinger aktualisiert

### Session 2 (heute)
- `app/api/widget/route.ts` — **VX-Quelle gewechselt**: `getVixFutures()` (Yahoo Finance, ~26.56) → `getVontobelFuturesQuote()` (Vontobel, ~24.13); ISIN wird aus `Settings.vontobelIsin` gelesen; `changePct` wird aus `previousClose` berechnet
- Scriptable `Untitled Script.js` — **Komplett-Redesign**:
  - Einheitliches Zeilen-Layout für Small + Medium (keine extra große VIX-Anzeige mehr)
  - Position wird jetzt in **allen** Widget-Größen angezeigt (vorher nur Medium)
  - Position-Zeile zeigt: `↑ long / Einstieg → Aktuell / +Gesamtperformance%`
  - VIX-Farb-Indikator im Header (grün/gelb/orange/rot je nach Level)
  - Schriftgrößen: Small=12pt Märkte/11pt Position, Medium=14pt/12pt

### Widget Response-Format (aktuell)
```json
{
  "updatedAt": "ISO-Timestamp",
  "markets": [
    { "symbol": "VIX",  "price": 25.22, "changePct": -6.42 },
    { "symbol": "VX",   "price": 24.13, "changePct": -1.83 },
    { "symbol": "ES=F", "price": 6658.0, "changePct": 0.79 }
  ],
  "positions": [
    { "name": "long", "entryPrice": 0.8, "currentPrice": 0.8, "pnlPct": 0.0, "direction": "long" }
  ]
}
```

### Offene Punkte / Nächste Schritte
- `currentPrice` der Position wird nicht automatisch aktualisiert (zeigt noch Einstiegspreis 0.8000) → Cron-Job oder manueller Update nötig
- Widget-Dateiname `Untitled Script.js` könnte umbenannt werden (z.B. `VIX Dashboard.js`)

---

*Zuletzt aktualisiert: 2026-03-25*
