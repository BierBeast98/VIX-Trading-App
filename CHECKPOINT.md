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

### Session 7 (2026-06-29) — Analytics: €-gewichtete Depot-Rendite
- **Konzept:** „Aktuelles Kapital" (inkl. realisierter G/V) eingeben → System rechnet zum Startkapital zurück: `Start = Kapital − Σ G/V`, `Rendite = G/V / Start`, annualisiert `(Kapital/Start)^(365,25/Tage)−1`.
- `lib/analytics.ts` — `TradeRecord` um `entryPrice/exitPrice/quantity` erweitert; `totalPnlEur` (Σ (exit−entry)×Stück) + `tradesWithEurData` in Metrics.
- `app/api/account-capital/route.ts` (**neu**) — GET/PUT, persistiert Kapital im generischen `VixCache`-KV (id=`account_capital`). **Kein Schema-Feld → keine Migration, kein Deploy-Risiko** (Settings-Spalte hätte `prisma db push` gegen Prod-Neon gebraucht, sonst Crash).
- `app/analytics/page.tsx` — Kapital-Eingabe (persistiert, cross-device), Karte „Rendite über die Zeit" jetzt €-gewichtet primär (Gesamtrendite + annualisiert + realisierter G/V), gleichgewichtete %-Sicht als Referenzzeile. KPI „Gesamt" zeigt €-gewichtet wenn Kapital gesetzt.
- Verifiziert (echte 4 Trades): G/V +772 €, Startkapital 2.928 € → **+26,36 %**, annualisiert **+145,88 %** (95 Tage). Desktop + Mobile-Screenshot bestätigt.
- ⚠ Annahme: setzt sequenzielle Reinvestition in einen Kapitaltopf voraus; Trades ohne `quantity` werden ignoriert (Hinweis in der UI).

### Session 8 (2026-07-01) — Trades: Haltedauer korrekt
**Problem:** Haltedauer auf der Trades-Seite falsch (meist „—", Ø fiel auf 1 zurück).
**Ursache:** Bestehende Trades hatten `holdDays = null` (anders eingespielt); PUT berechnete es beim Bearbeiten nicht neu.
- `app/trades/page.tsx` — Helper `holdDaysFromDates(entry, exit)`; Haltedauer wird überall (Tabelle, Mobile-Karte, CSV, Ø Haltetage, annualisiert) **aus den Datumsfeldern** berechnet statt aus dem gespeicherten Wert.
- `app/api/trades/[id]/route.ts` — PUT berechnet `holdDays` beim Bearbeiten aus den (ggf. neuen) Daten neu.
- `lib/analytics.ts` — `avgHoldDays` ebenfalls aus Daten abgeleitet.
- Verifiziert (echte Trades): 10/7/3 Tage korrekt, Ø 5. **DATENFEHLER gefunden:** Trade `DE000VU4MAY5` hat Ein 23.03. / Aus 09.03. (Ausstieg vor Einstieg → −14 Tage). Nutzer hat Korrektur-Entscheid vertagt → unverändert gelassen.

### Dev-Hinweis: Vorschau flackert / 500 (Turbopack + iCloud)
- **Symptom:** Lokale Vorschau (`npm run dev`) flackert/lädt in Endlosschleife oder liefert 500. Logs: `FATAL: Turbopack ... Failed to write app endpoint` / `Next.js package not found` **oder** `ENOENT: ... .next/dev/server/.../*-manifest.json`.
- **Ursache:** Das Projekt liegt in **iCloud Drive** (`~/Library/Mobile Documents/…~com~readdle~CommonDocuments`). iCloud synchronisiert/verschiebt `.next`-Build-Artefakte → Next findet sie zeitweise nicht. Auch die `.next 2`-Duplikate stammen daher. **Kein Code-Bug, Live-Seite (Hostinger) nicht betroffen.**
- **Schnell-Fix:** `rm -rf .next && rm -rf ".next 2"`, Dev-Server neu starten.
- **Was NICHT funktioniert:** `next dev --webpack` (bricht Neon-WS-Treiber: `bufferUtil.mask is not a function` → DB tot, 0 Trades). `.next` per Symlink aus iCloud auslagern (bricht Turbopack-Modulauflösung: `@tailwindcss/postcss` nicht gefunden + SST-Cache-Schreibfehler).
- **Dauerhafter Fix (offen, Nutzer-Entscheid):** Projekt aus dem iCloud-Ordner in einen lokalen Pfad verschieben.
- ⚠ **Wichtig:** `DATABASE_URL` zeigt auf **Neon = PRODUKTION**. Der lokale Dev-Server liest/schreibt echte Daten (kein separates Dev-DB aktiv, da `.env` auf Neon zeigt).

### Session 9 (2026-07-01) — Gesamt-Audit: Performance + Preis-Korrektheit
**Anlass:** Nutzer wollte App komplett geprüft (funktioniert alles? Live-Preise?) und Performance verbessert haben (Scrollen, Seitenwechsel auf iPhone).

**Health-Check (live):** Alle Endpoints HTTP 200, VIX/VIX3M/Vontobel-Future/EUR-USD plausibel, Caching greift (Spot kalt ~3 s, warm ~0,1 s). Kein toter `/positions`-Link (Nav „Positionen" → `/trades`).

**Frontend-Performance (Commit `f9d947e`):**
- Alle Charts (`VixIntradayChart`, `CertificateIntradayChart`, `VixHistoryChart`, `CorrelationChart`) in `React.memo`, Datenpipelines in `useMemo`, `Intl.DateTimeFormat` als Modul-Konstante. **Hauptursache des Ruckelns:** jeder SWR-Tick re-renderte alle Charts inkl. CET-Konvertierung pro Datenpunkt.
- `isAnimationActive={false}` auf allen Recharts-Serien.
- Recharts (~200 KB) per `next/dynamic` (ssr:false, Platzhalter mit fixer Höhe) aus den Bundles von Dashboard + Analytics; Inline-BarChart → `components/charts/EntryBucketChart.tsx` (neu).
- Trades-Seite: `TradeCardMobile` + `TradeRowDesktop` als memoized Komponenten mit `useCallback`-Callbacks — Expand re-rendert nur noch die betroffene Card.

**Preis-Korrektheit (Commit `820d91e`):**
- `Position.currentPrice` wird jetzt bei jedem erfolgreichen Vontobel-Abruf gepflegt (Widget + Batch-Route) → Fallback bei Vontobel-Ausfall ist „letzter bekannter Preis" statt Einstiegspreis. Neues Feld `priceStale` in der Widget-Response; Scriptable-Script zeigt stale Preise mit `~` und grauer P&L.
- `/api/vix/spot` liefert `futureChangePct` + `futureSource` — Dashboard und iOS-Widget berechnen die VX-Änderung nicht mehr getrennt (waren inkonsistent). VIX3M-Badge im Dashboard wenn Vontobel-Fallback aktiv.
- `DELETE /api/positions/[id]` schließt verknüpfte offene Trades atomar mit (`$transaction`, exitDate/holdDays/exitPrice aus gecachtem Bid) → Desktop-Schließen == Mobile-Pfad. **Damit ist der alte offene Punkt „Desktop-handleClosePosition-Inkonsistenz" erledigt.**
- Verschluckte `.catch(() => {})` loggen jetzt; `getVontobelCertificatePrice` validiert Bid (>0, finite) und loggt.
- `trading-hours.ts`: Wochenend-Check ergänzt (vorher pollte die App auch Sa/So), parseInt-Radix.

**API/DB (Commits `9e346c5`, `275bbb7`):**
- Alert-Cron: externe Calls + DB-Reads per `Promise.all` parallel; die zwei N+1-Runden (`vixCache.findUnique` pro Position für Spike + Trailing Stop) durch EIN `findMany` + Map ersetzt; Cooldown-Check gebatcht (1 Query statt 1/Alert). Erwartung ~−45 % Cron-Laufzeit.
- `@@index([positionId])` auf `Trade` — per `prisma db push` bereits in Neon angelegt, dann committet.
- `GET /api/trades` bewusst ohne Cache-Header (Kommentar im Code).

**Verifiziert:** `npm run build` grün nach jeder Phase; lokale Preview: Dashboard/Trades/Analytics rendern fehlerfrei (0 Konsolenfehler), Card-Expand + Charts funktionieren, VX +1,00 % identisch Widget/Dashboard. Alle 4 Commits gepusht → Auto-Deploy.

**Bewusst NICHT gemacht (Overkill für Single-User):** Listen-Virtualisierung, Redis, RSC/SSR-Umbau, Recharts-Ersatz, WebSockets. In-Memory-Cache (`lib/server-cache.ts`) ist prozesslokal — ok für Single-Instance Hostinger.

### Session 10 (2026-07-08) — Vontobel-API-Fix + Alert-System-Überarbeitung

**Vontobel-Fix (Commit `d05d43e`):** Vontobel hat die Chart-API geändert — `/detail/0/0` → `/detail/{range}` (ein Parameter). Alle 6 Abrufstellen angepasst (lib/yahoo-finance.ts ×3, vontobel/batch, price, product). Live-Bid/Intraday kamen seitdem nicht mehr an (Positionen zeigten stale Einstiegspreis). Widget-API + Scriptable zeigen jetzt zusätzlich **€-P&L** (`pnlEur`, Stückzahl aus offenen Trades).

**Alert-Überarbeitung (Commits `3d5a5f0`, `d7d7eee`, `d8c4b2c`):**
- **Schema (additiv, via `prisma db push`):** `Settings.alertConfig` (Json: per-Typ enabled + profitTargetPct), `AlertLog.urgency`/`dedupeKey`, neues Model `AlertState` (Arm/Re-Arm-Zustand pro Bedingung).
- **Arm/Re-Arm-Zustandsmaschine** (`lib/alert-dispatch.ts`): Alert feuert 1× beim Eintreten, max. 1 „Erinnerung:"-Mail pro Handelstag (Berlin), Re-Arm beim Verlassen; 30-Min-Anti-Flap pro dedupeKey. Ersetzt den globalen Typ-Cooldown (der bei mehreren Positionen Alerts verschluckte).
- **Neuer Alert-Typ `profitTarget`** (Default 15 %, pro Position, dedupeKey `profitTarget:<certId>`).
- **Spike-Split:** Spot = `spike`, Futures = `vxSpike` — blockieren sich nicht mehr.
- **calcStepFloor-Fix:** Trailing Stop aktiviert bei exakt `targetReturnPct` (18 statt 23); Floor-Writes nur für tatsächlich gesendete Edge-Alerts.
- **Weitere Fixes:** Event-Zeiten in Europe/Berlin geparst (`berlinDateTime` in lib/trading-hours.ts), genau 1 Mail pro Event; Stale-Guard (Spot/Bid >30 Min alt → keine Alerts); `?test=true`-Auth-Bypass entfernt, neu `?force` (Handelszeit-Gate) + `?dryRun` (schreibfrei), beide mit Bearer.
- **Frontend:** Alerts-Seite = Kommandozentrale (6 Config-Karten: Toggle + Schwellen + „Zuletzt ausgelöst" + Aktiv-Punkt via neuem `GET /api/alerts/summary`; Verlauf mit echten Urgency-Badges). Settings-Seite nur noch E-Mail + ISIN. `PUT /api/settings` Zod-validiert (400 bei ungültigen Werten). Zentrale Typ-Metadaten in `lib/alert-types.ts`.
- **Verifiziert:** Alle Zustandsmaschinen-Zweige end-to-end gegen Prod (Initial/Suppress/Erinnerung/Re-Arm), Auth-Checks, Dry-Run schreibfrei, UI via Preview. Live bestätigt nach Deploy (~17 Min Hostinger-Build).
- **Cron läuft:** Hostinger-Cron feuert nachweislich (Log 12:02 Uhr exakt nach Cooldown-Ablauf). Wichtig: Er MUSS `Authorization: Bearer <CRON_SECRET>` senden — Bypass existiert nicht mehr.
- **Nutzer-Settings:** vixLowThreshold **16**, profitTarget **15 %**, Zielrendite 18 %/Stufe 5 %, Spike 4,5 %.
- Hinweis: Position DE000VY6F1Z4 wurde am 08.07. ~11:10 vom Nutzer geschlossen (+12 %); Gewinnziel-Alert daher ohne echte Position getestet (Codepfad = verifizierter Trailing-Pfad).

### Offene Punkte / Nächste Schritte
- **Gewinnziel-Alert an echter Position beobachten:** Beim nächsten offenen Trade prüfen, dass bei +15 % die Mail kommt (Codepfad verifiziert, aber noch nie mit echter Position gefeuert).
- **Ersten Handelstag nach Deploy beobachten:** Kein Alert-Spam mehr (max. 1× + Tages-Erinnerung), AlertState-Verhalten im Verlauf prüfen.
- **Widget-€-Anzeige auf dem iPhone bestätigen** (pnlEur unter der Prozentzahl — braucht offene Position).
- **Datenentscheid offen:** Trade `DE000VU4MAY5` — Ein-/Ausstiegsdatum vertauscht (−14 Tage). Auf Wunsch tauschen oder korrekte Daten setzen.
- Optional: Widget-Dateiname `Untitled Script.js` umbenennen (z.B. `VIX Dashboard.js`).

---

*Zuletzt aktualisiert: 2026-07-08 (Session 10)*
