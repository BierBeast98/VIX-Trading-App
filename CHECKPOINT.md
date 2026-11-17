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
- **Nachfix (`8b7a525`):** rollingWindowDays-Validierung bis 1000 Tage (Nutzer nutzt 600; Speichern schlug live mit 400 fehl). Live verifiziert.

### Offene Punkte / Nächste Schritte
- **Gewinnziel-Alert an echter Position beobachten:** Beim nächsten offenen Trade prüfen, dass bei +15 % die Mail kommt (Codepfad verifiziert, aber noch nie mit echter Position gefeuert).
- **Ersten Handelstag nach Deploy beobachten:** Kein Alert-Spam mehr (max. 1× + Tages-Erinnerung), AlertState-Verhalten im Verlauf prüfen.
- **Widget-€-Anzeige auf dem iPhone bestätigen** (pnlEur unter der Prozentzahl — braucht offene Position).
- **Datenentscheid offen:** Trade `DE000VU4MAY5` — Ein-/Ausstiegsdatum vertauscht (−14 Tage). Auf Wunsch tauschen oder korrekte Daten setzen.
- Optional: Widget-Dateiname `Untitled Script.js` umbenennen (z.B. `VIX Dashboard.js`).

---

*Zuletzt aktualisiert: 2026-07-08 (Session 10)*


## Zuletzt durchgeführte Änderungen (2026-11-17) — Manuelle Handelssignale

- Neuer geschützter Bereich `/signals` (auch in der mobilen Navigation): Konfiguration, konkrete Kauf-/Verkaufssignale, Zustellstatus, Ausführungsformular, Signal-/Ausführungshistorie. Screenshot kann im Chat übermittelt und danach strukturiert erfasst werden; kein automatischer Screenshot-Import.
- Deterministische Long-Strategie A/B/C mit 30/40/50-%-Kaskade, echtem VX-Aufschlagfilter, 30 Tagen Restlaufzeit, gemeinsamem Trailing und Rundenlimit. Keine KI-/Broker-Aufrufe.
- Broker-/Handelsplatzfenster in Europe/Berlin einschließlich Wochenenden und expliziten Feiertagen; keine voreingestellten Brokerzeiten, standardmäßig deaktiviert. Brokerangabe des Nutzers steht noch aus.
- Telegram + E-Mail mit getrennten Zustellbelegen, Fehlerwiederholung und 15-Min-Verkaufserinnerung während der Handelszeiten. Neue Server-Variablen siehe `docs/SIGNALS.md`. Es wurden keine echten Nachrichten verschickt.
- Zustand im bestehenden `VixCache` unter `manual_strategy_v1`, ohne Migration. Row-Lock und Transaktion verbinden Ausführungsbestätigung mit Positionen/Trades, verhindern Doppelbuchungen und schützen Signalpositionen vor unabhängigen Änderungen im alten Editor.
- Bestehender Cron `/api/alerts/check` integriert Signalprüfung; eigener `/api/signals/check` verfügbar. `dryRun` schreibt keinen Signalzustand. Keine automatischen Orders.
- Der Adapter verlangt echte frische Geld-/Briefkurse und geprüftes aktives EUR-Long-Produkt; kein Ersatz durch VIX3M oder geschätzte Briefkurse. Alte Standard-ISIN bei Prüfung inaktiv, deshalb nicht übernommen. Neue aktive Produkt-/Datenfeedprüfung vor Aktivierung erforderlich.
- Umsetzung und Tests erfolgten lokal; keine Produktionsdaten verändert. Bereitstellung und externe Versand-/Cron-Einrichtung müssen separat verifiziert werden.

### Verifikation dieser Änderung

- 21 Regel-/Benachrichtigungstests bestanden (Versand vollständig simuliert).
- Separater PostgreSQL-Integrationstest bestanden: konkurrierende Bestätigungen, Teilverkauf/Restbestand, vollständiger Ausstieg, Transaktions-Rollback und Row-Lock.
- Zehn lokale HTTP-Prüfungen bestanden: Zugriffsschutz, Originprüfung, HttpOnly-Cookie, Bestand, Konfigurationssperre und Schutz vor Änderungen im alten Editor.
- Desktop-/390px-Handyansicht und simulierte Ausführungsbestätigung im Browser geprüft. Screenshot mit ausschließlich Testdaten außerhalb des Repositorys gespeichert.
- Produktionsbuild und TypeScript-Prüfung bestanden; Produktionsdatenbank und externe Nachrichtendienste blieben unberührt.

## Telegram-Einrichtung am 17.11.2026

- Bot des Nutzers: `Vix98_Trading_Bot`. Token nach Screenshot durch Nutzer erneuert; neuer Token nur bei Hostinger hinterlegt.
- Hostinger-Eintrag per Browser von `TELEGRAM_BOT` auf `TELEGRAM_BOT_TOKEN` korrigiert und per API verifiziert. Wert nicht ausgegeben; übrige Variablen erhalten.
- Hostinger-Rebuild aus gespeicherter Quelle scheitert an fehlender `package.json`. Neuer vollständiger Quellstand muss bewusst bereitgestellt werden. Bisherige lokale Signaländerungen sind noch nicht deployed.
- Geschützte Telegram-Verknüpfungsroute und Operator-Helfer ergänzt. Bestätigte Chat-ID kann ohne weitere manuelle Servervariable im vorhandenen VixCache gespeichert werden. Der Nutzer muss dafür nach Bereitstellung einen einmaligen persönlichen Startlink öffnen. Verbindung/Testnachricht noch nicht abgeschlossen.

- Bereitstellung autorisiert. Vollständiges Archiv behebt fehlende package.json; Hostinger-Turbopack/PostCSS-Worker bricht intern ab. Produktionsbuild deshalb auf `next build --webpack` umgestellt; Neon/Prisma/ws als externe Serverpakete erhalten. Lokaler Webpack-Produktionsbuild bestanden.

### Live-Ergebnis 17.11.2026

- Produktionsstand `5e93ee0` erfolgreich aus GitHub `main` auf `vix-trading.de` bereitgestellt. Hostinger-Build `01a1e9ae-cd3e-7134-b55c-19ee2a391e28` abgeschlossen (Webpack).
- `/signals` live, geschützter API-Endpunkt antwortet korrekt mit 401 ohne Berechtigung. Bestehende Trades über Live-API gegen DB-Anzahl verifiziert; Neon-Anbindung funktioniert auch nach Build-Umstellung.
- `Vix98_Trading_Bot` per persönlichem Startcode verknüpft. Server antwortete `connected: true`; Telegram-Testnachricht erfolgreich an den zugeordneten privaten Chat gesendet. Chat-ID liegt ausschließlich im vorhandenen `VixCache.telegram_connection_v1`, Token bleibt bei Hostinger.
- Temporäre Administrationsfreigabe und lokale Geheimnisdatei nach Erfolg entfernt.
- Handelsüberwachung ausdrücklich in Produktion pausiert (`manual_strategy_v1.config.enabled = false`), abschließend verifiziert. Keine Orders ausgeführt.
- Offen vor Nutzung des geschützten Signalbereichs: `SIGNALS_ACCESS_KEY` auf Hostinger einrichten. Offen vor Aktivierung: deutscher Broker/Handelsplatz, Handelsfenster/Feiertage, aktives Produkt und tatsächlich frische Geld-/Briefkurse.

## Bestätigte Strategie-Einrichtung (17.11.2026, nach Telegram-Test)

- Nutzer bestätigt Strategie; Kapital ausdrücklich **1.500 EUR**, Zielhebel ungefähr **2,0** statt zwingend 2,3. Kaufkaskade: 450 EUR / insgesamt 600 EUR / insgesamt 750 EUR, jeweils Gebühren inklusive. Reserve 750 EUR; 6-%-Rundensignal bei 90 EUR Verlust (keine garantierte Verlustobergrenze).
- Broker als **comdirect** verstanden; Screenshot zeigt Handelsplatz Stuttgart. Vorbereitete Überwachung Mo–Fr 08:00–22:00 Europe/Berlin, bekannte volle Stuttgarter Schließtage 2026 hinterlegt. Weiterhin pausiert.
- Produktbeispiel **BD11R4 / DE000BD11R44**, Vontobel Mini Future Long in EUR. Kein Ausführungsbeleg, kein Trade angelegt. Beispielprüfung separat unter `manual_strategy_product_review` gespeichert, **keine Produktfreigabe**.
- Stuttgarter Stammdaten/Titel nennen noch November, aktuelle Emittentenmetadaten am 17.11. zeigen **UXZ6 / Dezember 2026**, Verfall 16.12.2026. Heute 29 Kalendertage: scheitert an unveränderter Mindestrestlaufzeit 30 Tage. Roll-/Kontraktzuordnung muss vor konkreter Produktfreigabe eindeutig sein.
- Vontobel liefert echte Geld-/Briefkurse im aktuellen `price`-Snapshot mit `latestTimestamp` (keine getrennten bidTimestamp/askTimestamp). Adapter nutzt diesen echten Quellzeitstempel und aktuelle Basiswert-Snapshotdaten; keine erfundene Abrufzeit/kein geschätzter Briefkurs. Zusätzlich Long-Richtung im Adapter geprüft.
- Zielhebel 2,0 im API-Schema und in der Oberfläche ergänzt; bisherige Modellvarianten bleiben verfügbar. 33 Tests und Webpack-Produktionsbuild bestanden.

- Aktualisierung `dae10f0` (Zielhebel 2 und Vontobel-Snapshots) erfolgreich live; Hostinger-Build `01a1e9bf-fb68-7207-b89b-36db3dc892a6` abgeschlossen. Abschließende Prüfung: Budget 1.500 EUR, Hebelziel 2, Produktfreigabe false, Überwachung weiterhin pausiert. Read-only-Kursprobe: Emittenten-Bid/Ask und tatsächlicher VX frisch, Yahoo-VIX beim Test **nicht** innerhalb der Fünf-Minuten-Grenze. Vor Aktivierung VIX-Feed/zeitliche Abdeckung klären; keine Kaufsignale aus veralteten Daten.

## Langfristiges Datenarchiv (17.11.2026)

- Nutzer beauftragt dauerhafte Speicherung und Auswertung von Daten-/Abrufmengen. Ist-Zustand: UI/Cache meist fünf Minuten, aber Hostinger-Cron-Liste leer; bisher kein verifizierter Dauerabruf.
- Additive Tabellen `MarketObservation`, `MarketFetch`, `MarketCollectionRun`. Keine automatischen Löschungen. Bestehende Trading-Tabellen und generische Intraday-Daten bleiben erhalten.
- Marktquellen instrumentiert: Yahoo-SDK-Aufrufe (interne Netzwerkaufrufe nicht bekannt) und direkte Vontobel-HTTP-Aufrufe. Payload-HTML nicht gespeichert; normalisierte Punkte und Antwortgrößen/Laufzeiten/Fehler.
- VIX3M expliziter Indexproxy, aktuelle VX-Symbole getrennt; nicht eindeutig zuordenbare historische Basiswertreihen separat. Quellzeit und Empfangszeit getrennt; alte Kurse bleiben als solche markiert.
- Geschützter Bereich `/archive` und zwei CSV-Exporte mit Zeitraum-/Quellen-/Instrumentenfilter, Streaming je 1.000 Zeilen. Signiertes Cookie von `/api/signals` auf `/api` erweitert. Nutzer hat `SIGNALS_ACCESS_KEY` inzwischen korrekt bei vix-trading.de gespeichert; Wert nicht ausgelesen.
- Collector unabhängig von pausierten Handelsregeln, vorgesehen alle fünf Minuten Mo–Fr 08–22 Berlin mit bekannten Schließtagen und eigener minimaler Cron-Berechtigung. Budget/Strategie/Überwachung unverändert pausiert.
- Neun Archiv-Tests, separater DB-Test (konkurrierende Collector-Läufe, persistierte Abrufe/Deduplizierung/Fehler) und HTTP-Exporttest mit 2.005 Zeilen über drei Seiten bestanden; 33 bestehende Tests unverändert erfolgreich. Desktop/390px-Ansicht geprüft, horizontalen Layoutüberlauf durch `min-w-0` am Hauptbereich behoben.
- Details und Einschränkungen: `docs/ARCHIVE.md`. Produktionseinrichtung/erster echter Sammellauf werden nach Veröffentlichung verifiziert.

### Archiv in Produktion verifiziert (17.11.2026)

- Commit `a5beb81` auf vix-trading.de erfolgreich bereitgestellt, Hostinger-Build `01a1e9ea-c477-72eb-8fe0-e3655f34f8ce` completed.
- Unabhängiger Hostinger-Cron `hUV5xHZ4N0`, alle fünf Minuten; Server begrenzt auf Mo–Fr 08–22 Berlin und konfigurierte Schließtage. Dedizierte Collector-Berechtigung, kein Zugriff auf Signaladministration/Exporte.
- Erster **automatischer** Lauf am 17.11.2026 14:40:01 UTC / 15:40 Berlin: completed, 3 Quellenabrufe, 0 Fehler. Keine manuelle HTTP-Auslösung hierfür. Datenbank bestätigte persistierten Lauf, Abrufe und Beobachtungen.
- Handelsüberwachung weiterhin false. Archiv läuft unabhängig davon.

## UI und Kapitalbereinigung (17.11.2026)

- Nutzer beauftragt Umstellung auf Signale → eigene Broker-Ausführung → bestätigte Erfassung. Dashboard/Analytics/Positionen bleiben, Alert-Seite entfällt; `/alerts` leitet auf `/signals` weiter, alle Alert-Menüs/Badgeabfragen entfernt.
- Drei Subagenten für Berechnungen, Navigation und Buchungsintegrität; anschließend unabhängiges Kapitalreview integriert.
- Neue datierte Kapitalbasis **1.500 EUR**, Stand **2026-11-17T14:36:34.642Z**. 0 offene Positionen/0 Signalausführungen → aktuell und verfügbar 1.500 EUR. Settings.riskBudget ebenfalls 1.500. Vorheriger Legacy-Kontostand (3.700 EUR), Risikobudget (10.000 EUR) und geänderte Positionswerte unter `capital_reconciliation_20261117` gesichert. Keine historischen Trades gelöscht.
- Fünf geschlossene Positionen anhand ihres jeweils einzigen abgeschlossenen verknüpften Trades bei Ein-/Ausstiegspreisen synchronisiert. Geschlossene Position ohne eindeutigen Trade unverändert.
- Kapital-API rechnet bestätigte Kauf-/Verkaufscashflows seit Basis plus verbleibende Lot-Anschaffungskosten, inklusive bestätigter Gebühren. Buchwert, verfügbarer Betrag und gebundener Einstand separat. Keine alte Historie in neue Basis eingerechnet. Kapitaländerung über freie Kontostand-/Signaleingabe gesperrt, bis Ein-/Auszahlung explizit abgestimmt wird.
- Historische Kennzahlen leiten Zertifikatrendite aus tatsächlichen Kursen ab (inklusive 0 EUR / −100 %), keine doppelte Richtungsumkehr bei Short-Zertifikaten. Keine unbelegte Depotverzinsung/Jahresrendite. Alte Euro-Ergebnisse ausdrücklich brutto, neue Signal-Kapitalrechnung netto.
- **Geklärt durch Nutzer:** Verkauf DE000VU4MAY5 am **09.04.2026**, Einstieg unverändert 23.03.2026. ExitDate korrigiert und Haltedauer 17 Tage; vorherige Werte unter `trade_date_correction_20261117_VU4MAY5` gesichert. Wieder alle sieben historischen Trades auswertbar. Historischer Brutto-G/V −209,97 EUR, keine Aussage über die neue Strategie.
- Buchungs-APIs prüfen Datumsfolge/Preise/Stückzahl, berechnen bei Einzelkursänderung neu, speichern Trade/Position atomar und erkennen Totalverlust. Kein automatischer Positionsverkauf anhand Cachekurs; UI verweist auf Erfassung tatsächlicher Ausführung. Signalpositionen weiterhin gegen alte Editoren geschützt.
- Vereinfachtes historisches Spot-Modell ausdrücklich keine Simulation der neuen Signalstrategie; Kalenderdauer, Trailing-Floor, −100-%-Grenze und Drawdown korrigiert. VIX3M nicht mehr als echter VX zugemischt.
- 31 neue Finanz-/API-/Kapitaltests erfolgreich; 33 Signal-/Telegramtests und 9 Archivtests erfolgreich. Produktionsbuild/TypeScript und gezieltes ESLint erfolgreich; mobile/desktop Analytics und Positionshistorie lokal mit kopierten Bestandsdaten geprüft. Finale integrierte Bereitstellung und Live-Prüfung folgen.
- Details: `docs/CAPITAL.md`. Überwachung pausiert, Produkt nicht freigegeben; keine Broker-Order ausgeführt.

### Abschließendes Live-Ergebnis

- UI/Berechnungen Commit `3f0d671` erfolgreich auf vix-trading.de, Hostinger-Build `01a1e9f6-ecd5-72d6-8e8e-593bd2bc9869` completed.
- Live-HTTP und Browser verifiziert: Startkapital/Buchwert/verfügbar jeweils 1.500 EUR, 0 gebunden, 0 neue Ausführungen. Alle sieben historischen Trades auswertbar, keine ungültigen Daten, historischer Brutto-G/V −209,97 EUR. Verkauf DE000VU4MAY5 tatsächlich 09.04.2026, Haltedauer 17 Tage.
- `/alerts` HTTP307 nach `/signals`; Signal-/Archiv-APIs ohne Berechtigung HTTP401. Desktop-Live-Analytics zeigt korrigierte Kennzahlen und separat die neue Kapitalbasis. Mobile Dashboard-/Analytics-/Positionsansichten lokal geprüft.
- Überwachung zum Abschluss erneut pausiert verifiziert; Produkt weiterhin nicht freigegeben. Archiv nachweislich regelmäßig unabhängig aktiv (auch 14:45 UTC erfolgreich). Keine neue Nachricht oder Broker-Order ausgelöst.
- Lokale Testserver und temporäres PostgreSQL gestoppt. Nachträgliche Dokumentationskorrektur zum Nutzer-Verkaufsdatum lokal committet; kein weiterer App-Build nötig.

## VIX-Feed: Echtzeitanbindung vorbereitet, Kursalter korrigiert (17.11.2026)

- Nutzer beauftragt Behebung des verzögerten VIX-Datenfeeds. Live-Prüfung zuvor zeigte Yahoo-Indexzeit 14:33 UTC bei Abruf 14:52 UTC; Yahoo nennt für Cboe-Indizes ausdrücklich 15 Minuten Verzögerung. Abrufzeit wurde bisher missverständlich als Aktualität angezeigt.
- Massive-Adapter implementiert: offizieller `I:VIX`-Indices-Snapshot, fester API-Host, Bearer im Header, keine Redirects, 12-Sekunden-Timeout, keine geheimen Providerfehler in Meldungen/Archiv. Originaler Nanosekunden-Quellzeitstempel, explizite `REAL-TIME`-/`DELAYED`-Berechtigung und exakte Instrumentidentität geprüft.
- `MASSIVE_API_KEY` und optional `VIX_DATA_PROVIDER=massive`; ohne Zugang bleibt Yahoo ausdrücklich verzögert. Hostinger-Schlüsselliste geprüft: **kein MASSIVE_API_KEY vorhanden**. Kein Anbieterabo abgeschlossen, keine Zahlung oder Kontoeinrichtung. Geprüfte offizielle Option: Indices Advanced 99 USD/Monat Echtzeit, Starter 49 USD/Monat 15 Minuten verzögert. Preis-/Zugangsentscheidung des Nutzers steht aus.
- Signal-Engine verlangt explizit bestätigte Echtzeit-VIX-Provenienz; verzögerter/unklarer Feed kann keine Kreuzung scharfstellen oder neue Käufe auslösen, auch bei scheinbar frischem Zeitstempel. Risikobasierte Ausstiege mit frischem Zertifikatsbid weiterhin möglich. Aktivierung ohne konfigurierten Echtzeitzugang gesperrt. Überwachung nicht aktiviert.
- Persönliche Massive-Kurse nur nach bestehender Signalanmeldung/Bearer, öffentliche Dashboard-/Widget-Anfragen verwenden Yahoo. Cache nach Zugriff und Provider getrennt, private DB-ID separat; Alt-Caches ohne Feedversion verworfen. Alte Alert-Historie/Übersichten geschützt, da dort Kurswerte gespeichert werden können.
- Dashboard trennt Abrufzeit, VIX-Kurszeit (Berlin), Quelle, Verzögerung und laufendes Kursalter. Spot-Abfrage im bisherigen UI-Handelsfenster jede Minute, Altersanzeige alle 30 Sekunden; Servercache höchstens 30 Sekunden ohne CDN-Cache. Widget-API liefert dieselben Provenienzfelder und berechnet Aktualität bei Cachetreffern neu.
- Archiv erhält Quelle `massive` / `MASSIVE:I:VIX` getrennt von Yahoo, inklusive HTTP-Abrufen/Bytes/Berechtigung. Yahoo-VIX-Snapshots ausdrücklich Qualität delayed. Filter/CSV um Massive erweitert; kein neues DB-Schema. Collector weiter alle fünf Minuten; Ausfall+Yahoo-Fallback separat gezählt.
- 16 Provider-/Zugriffs-/Fallback-/Cachetests, 35 Signal-/Telegramtests, 12 Archivtests und 31 Finanztests bestanden (94 gesamt), TypeScript/gezieltes ESLint und Webpack-Produktionsbuild erfolgreich. Desktop-/390px-Kursanzeige lokal geprüft. Massive-Providerantworten nur simuliert; echter Anbieter-/Berechtigungsnachweis bleibt mangels Zugang offen.
- Einrichtung/Quellen/Abgrenzung: `docs/VIX-FEED.md`. Open-End/Rollverfahren und 30-Tage-VX-Regel wurden in dieser Feedänderung nicht umdefiniert. 1.500 EUR, keine neuen Ausführungen, Überwachung weiterhin pausiert.

### Feed-Bereitstellung und neue Nutzer-Vorgabe

- Commit `8c12511` erfolgreich live, Hostinger-Build `01a1ea0d-a5b6-737d-8bef-bcacd47a6fa1` completed. Live-API: Feedversion2, source yahoo, feedMode delayed, no-store, tatsächliches Kursalter beim Test ca.16 Minuten. Signal-/Archiv- und Legacy-Alert-Leserouten ohne Anmeldung401. Dashboard im Browser mit 1.500 EUR und expliziter verzögerter Originalkurszeit geprüft. Screenshot `vix-feed-age-live.jpg` im Visualizations-Ordner.
- Nutzer möchte **keinen kostenpflichtigen Livefeed**, sondern weiter kostenlos alle fünf Minuten abrufen; hält dabei fünf Minuten Verzögerung für ausreichend. Klar erläutert: Yahoo liefert bereits15 Minuten verzögert, fünfminütiger Abruf ergibt ca.15–20 Minuten Kursalter. **Rückfrage offen, ob15–20 Minuten ebenfalls akzeptiert werden oder maximal5 Minuten gelten.** Keine eigenmächtige Lockerung der Signalregeln vorgenommen.
- Massive-Zugang bleibt unkonfiguriert, kein Abo/keine Zahlung. Optionale Anbindung vorhanden; bisherige Fünf-Minuten-Sammlung läuft. Überwachung bis zur Klärung pausiert. Nach bestätigter Akzeptanz einer verzögerten Datenbasis muss die Signalrichtlinie bewusst angepasst werden; aktuell verlangt sie weiterhin Echtzeitprovenienz und max.5 Minuten Kursalter.

## Bestätigte kostenlose Einstiegsdaten / aktuelle Vontobel-Ausstiegsdaten (17.11.2026)

- Nutzer akzeptiert ausdrücklich15–20 Minuten VIX-Verzögerung für den Einstieg und möchte ausschließlich Vontobel-Zertifikate. Kein bezahltes Datenabo. Konfigurierbare, bewusst bestätigte Richtlinie `vixEntryPolicy=delayed20`; ohne Richtlinie bleibt der sichere Echtzeitstandard erhalten.
- Regel erlaubt nur `source=yahoo`, `feedMode=delayed`, ursprüngliches VIX-Kursalter maximal20 Minuten, maximal1 Minute Zeitabweichung in die Zukunft. Originalquellen müssen fortschreiten, keine Kreuzung über mehrals10 Minuten Quelllücke. Der Adapter erzwingt für diese Richtlinie Yahoo, auch wenn später optional ein Massive-Key vorhanden sein sollte.
- **Keine Lockerung für Bid/Ask/VX**: weiterhin maximal5 Minuten Kursalter. Risikobasierte Ausstiege benötigen keinen gültigen VIX/VX, aber einen positiven endlichen Vontobel-Geldkurs. Vontobel-spezifischer Adapter und ISIN-/Richtungs-/Währungs-/Kontraktprüfung unverändert.
- Quote-Altersprobe des vom Nutzer genannten Produkts **BD11R4 / DE000BD11R44**: empfangen17.11.2026 um**16:43:31 Berlin**, Snapshotzeit**16:43:19.757** (ca.11 Sekunden alt), **Bid1,03 EUR / Ask1,04 EUR**; aktueller VX4 Sekunden alt. Chart dagegen16:35 (über8 Minuten alt). Bevorzugter aktueller Snapshot hat gemeinsamen latestTimestamp, keine getrennten bidTimestamp/askTimestamp. Keine Garantie permanenter Sekundenaktualität oder eines Ausführungskurses. HTTP-Antwort max-age60; Abruf selbst no-store.
- Signale speichern VIX-Quelle, Modus, originale Kurszeit und Alter. UI und Telegram-/E-Mail-Text zeigen die verzögerte Einstiegsbasis. VX-Aufschlagfilter vergleicht weiterhin aktuellen VX mit zeitversetztem VIX; keine zeitgleiche Kursbehauptung. Dashboard-Abruf wieder ausdrücklich alle5 Minuten; verzögerter Yahoo-Kurs erst über20 Minuten als zu alt markiert.
- Versand prüft sowohl aktuelle Beobachtung als auch originale Signalbasis beim Durchlauf **und** beim Claim jedes Kanals. Kein Sell-Reminder bei Bid=null/0/NaN, kein nachträglicher Buy mit inzwischen>20 Minuten alter Basis trotz frischem Folgekurs. Ausführung beim Broker bleibt ausschließlich manuell.
- Konfigurations-API erhält Policy bei älteren Clients, sperrt Änderung während offener Runde/Signale, setzt Kreuzungszustand bei Änderungen zurück. `delayed20` benötigt keinen API-Key; Wechsel zur Echtzeitregel verlangt bei aktivierter Überwachung weiterhin den Echtzeitzugang.
- 44 Signal-/Telegramtests,34 Finanz-/Konfigurationstests,16 Feedtests und12 Archivtests bestanden (106gesamt), TypeScript, gezieltes ESLint und Webpack-Build erfolgreich. Tests senden keine echten Nachrichten. Bereitstellung und anschließende Übernahme der explizit bestätigten Policy werden separat verifiziert.
- Überwachung bleibt pausiert, Produkt-/Open-End-Rollverfahren und30-Tage-VX-Regel in dieser Änderung nicht angepasst. Kapital1.500 EUR bleibt erhalten.

### Bestätigte Regel live gespeichert und geprüft

- Commit `ec505da` auf vix-trading.de, Hostinger-Build `01a1ea35-e16a-710c-a9ca-388b28b1a6eb` completed.
- `manual_strategy_v1.config.vixEntryPolicy=delayed20` nach Row-Lock und Prüfung (pausiert, keine offene Runde/Signale,1.500 EUR) gespeichert. Zustimmung/Altwert unter `vix_delay_policy_20261117` protokolliert. Kreuzungszustand zurückgesetzt. Budget1.500 EUR, productVerifiedfalse, executions0 und enabledfalse unverändert.
- Zweite **echte Adapterprobe** (unter `origin=operator_quote_probe` im Archiv gezählt): empfangen **17.11.2026 16:56:50.526 Berlin**, Yahoo-VIX15,075 Minuten alt und nach bestätigter Regel verwertbar; **BD11R4 Bid1,05 / Ask1,06 EUR**, Vontobel-Snapshot **16:56:34.253** = **16,273 Sekunden alt**, tatsächlicher VX7,526 Sekunden alt. `issuerMappingValid=true`. Dies ist eine schreibfreie Markt-/Regelprobe hinsichtlich Trades/Signale; keine Order/Nachricht/Signalüberwachung aktiviert. Drei echte Marktquellenabrufe im Archiv gespeichert.
- Live-Dashboard200, Signal-API ohne Anmeldung401. Alle106 Tests, TypeScript/gezieltes ESLint und Produktionsbuild bestanden. Kein bezahlter Anbieterzugang eingerichtet.
