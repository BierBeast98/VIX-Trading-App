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

## Zuletzt durchgeführte Änderungen (2026-03-28)

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

### Session 3 (2026-03-28)
- `app/api/widget/route.ts` — Live-Bid-Preis für Zertifikat-Positionen via `getVontobelCertificatePrice()`, Fallback auf DB-Preis
- `lib/yahoo-finance.ts` — neue Funktion `getVontobelCertificatePrice(isin)` (Vontobel Chart-API)
- `app/api/alerts/check/route.ts` — VIX-Spot-Spike-Check (Yahoo Finance, zuverlässig), 30-Min-Cooldown per Alert-Typ via AlertLog, VX-Spike losgelöst von Positionen, Response zeigt `alertsTriggered` vs `alertsSent`
- `lib/alert-engine.ts` — `checkVixSpike` feuert jetzt auch ohne offene Positionen
- `lib/analytics.ts` — Short-Backtest-Modus, Knockout-Barrier-Parameter, `Math.abs(leverage)` Guard, neue Felder `direction` + `knockoutExits` im Result
- `app/analytics/page.tsx` — Direction-Toggle (Short/Long), KO-Barrier-Input, Knockout in Ausstiegsgründen (orange)
- `components/ui/modal.tsx` — `pb-20 lg:pb-4` damit Speichern-Button auf Mobile über der Nav-Bar bleibt
- `components/charts/VixHistoryChart.tsx` — `dataKey="date"` statt `label` → Tooltip-Cursor folgt Maus korrekt
- `Untitled Script.js` — `w.url = BASE_URL + "/dashboard"` → Tipp auf Widget öffnet Website

### Session 4 (2026-06-29) — Mobile-Performance & Scrolling
**Problem:** Scrollen auf dem iPhone funktionierte sporadisch nicht.
**Ursache:** Verschachtelter Scroll-Container — äußeres `h-screen overflow-hidden` + inneres `<main overflow-y-auto>`. Auf iOS Safari bleibt Momentum-Scrolling auf inneren Containern hängen und die Adressleiste fährt nie ein. Zusätzlich war kein `viewport`-Export gesetzt → `env(safe-area-inset-*)` lieferte auf dem iPhone immer 0 (Safe-Area-Paddings der Tab-Bar wirkungslos).

- `app/layout.tsx` — **Kern-Fix:** Mobil scrollt jetzt das Dokument selbst; innerer Scroll-Container nur noch auf Desktop (`lg:overflow-y-auto`, `lg:h-screen lg:overflow-hidden`). `h-screen` → `min-h-[100dvh]`. Neuer `viewport`-Export mit `viewportFit: "cover"` (+ themeColor). Main-Paddings respektieren `safe-area-inset-top/bottom`.
- `app/globals.css` — iOS-Scroll-Hygiene: `overscroll-behavior-y: none`, `-webkit-tap-highlight-color: transparent`, `-webkit-text-size-adjust: 100%`.
- `components/layout/sidebar.tsx` — fixe Mobile-Kopfleiste respektiert `safe-area-inset-top` (Notch / Standalone-Modus).
- Verifiziert via Preview: mobil = Dokument-Scroll (`overflow: visible`), Desktop ≥1024px = innerer Scroll unverändert, keine Konsolenfehler.

### Session 5 (2026-06-29) — Position auf iPhone schließbar
**Problem:** Offene Position ließ sich auf dem iPhone nicht löschen/schließen (blieb im Widget).
**Ursache:** Die mobile Dashboard-Karte (`lg:hidden`, basiert auf `openTrades`) hatte **keinen** Schließen-Button — der existierte nur im Desktop-Block (`hidden lg:block`).

- `app/dashboard/page.tsx` — neuer `handleCloseTrade(trade, liveBid)` + „Schließen"-Button im Footer der mobilen Positionskarte. Schließt über `PUT /api/trades/:id` (setzt `exitDate`), wodurch die Server-Logik die verknüpfte Position auf `status: "closed"` setzt → verschwindet aus offenen Positionen, Dashboard **und iPhone-Widget**; bleibt als abgeschlossener Trade in der Historie. `entryPrice` + Live-Bid werden mitgeschickt, damit `returnPct` berechnet wird (Analytics/Backtest).
- Verifiziert via Preview: Button sichtbar (mobil), Klick-Flow getestet (Position weg aus `/api/positions` + `/api/trades`), Screenshot bestätigt.
- Hinweis: Dev-Server hatte einen Turbopack-Panic auf `/trades/page` (interner Next-Bug, kein Code-Fehler) → Neustart half.

### Session 6 (2026-06-29) — Analytics: Gesamt- & annualisierte Rendite
- `lib/analytics.ts` — `PerformanceMetrics` erweitert um `compoundReturn` (kumuliert, ∏(1+rᵢ)−1), `annualizedReturn` ((1+compound)^(365.25/Tage)−1), `periodDays`, `firstTradeDate`, `lastTradeDate`. Annualisierung mit Totalverlust-Guard (Faktor ≤ 0 → −100 %).
- `app/analytics/page.tsx` — neue Karte „Rendite über die Zeit" (Gesamtrendite kumuliert + Annualisiert aufs Jahr + Ø/Trade, mit Zeitraum-Header). KPI „Gesamtrendite" zeigt jetzt die kumulierte statt der naiven Summe. Annualisierung erst ab ≥2 Trades & ≥14 Tagen aussagekräftig (sonst „—").
- Verifiziert: Mathe geprüft (z.B. +70,94 % über 4,8 Mon. → +287 % annualisiert), Screenshot bestätigt. API spreadt Metrics unverändert — keine Route-Änderung nötig.

### Offene Punkte / Nächste Schritte
- Auf echtem iPhone unter https://vix-trading.de nach Deploy gegentesten (Scrolling + Position schließen + Analytics)
- Optional: Desktop-`handleClosePosition` schließt aktuell nur die Position, nicht den verknüpften offenen Trade (latente Inkonsistenz) — könnte analog auf Trade-PUT umgestellt werden
- Widget-Dateiname `Untitled Script.js` könnte umbenannt werden (z.B. `VIX Dashboard.js`)

---

*Zuletzt aktualisiert: 2026-06-29*
