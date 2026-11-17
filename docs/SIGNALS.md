# Manuelle Handelssignale

Stand: 17.11.2026. Die App erzeugt regelbasierte Signale; Orders werden ausschließlich manuell beim Broker ausgeführt. Keine KI-Aufrufe oder Broker-Zugangsdaten erforderlich.

## Einrichtung und Aktivierung

1. Änderungen auf der bestehenden Next.js-Installation bereitstellen. Kein Prisma-Schemawechsel nötig: der transaktionale Signalzustand liegt unter `VixCache.manual_strategy_v1`. Vorhandene Positionen werden nicht automatisch als Strategiepositionen übernommen.
2. Auf dem Server `SIGNALS_ACCESS_KEY` als langen zufälligen Schlüssel setzen. `/signals` damit entsperren. Der Browser erhält ein signiertes HttpOnly-Cookie für sieben Tage. Den Schlüssel nicht in URLs, Repository oder Screenshots speichern.
3. Unter `/signals` das für die Strategie reservierte Kapital und Variante A/B/C eintragen. Standard: C, geplanter Einstiegshebel 2,3. Das ist eine konfigurierbare Modellvariante, keine bestätigte Anlagestrategie.
4. Ein **aktives Long-Zertifikat in EUR** auswählen. ISIN, WKN, Richtung, tatsächlichen VX-Einzelkontrakt, dessen Emittentensymbol und Verfall sowie Barriere und geplanten Hebel anhand der Produktunterlagen prüfen. Die alte Dashboard-Standard-ISIN ist keine automatische Auswahl. Der aktuelle Adapter unterstützt Vontobel. Automatische Auswahl des nächstfälligen geeigneten Produkts und automatische Rollen sind nicht implementiert.
5. Broker **und Handelsplatz** festlegen. Als Zeitfenster die gemeinsame Handelbarkeit von Broker, Handelsplatz und Emittent einstellen. Zeiten gelten in `Europe/Berlin`, Montag bis Freitag; das Ende ist exklusiv. Handelsfreie Tage explizit pflegen. Es gibt noch keinen automatisch synchronisierten Börsenkalender. Verkürzte Handelstage verlangen vorübergehend angepasste Endzeiten. Ohne bestätigte Zeiten bleibt die Aktivierung gesperrt.
6. Telegram und E-Mail einrichten; anschließend die Überwachung ausdrücklich aktivieren. Der Standard ist **pausiert**. Aktivierung ist kein Nachweis, dass der Datenfeed oder die Zustellung funktioniert: den sichtbaren Status und beide Kanalbelege prüfen.

## Telegram und E-Mail

- Einen eigenen Bot über Telegram BotFather erstellen; den Bot im gewünschten privaten Chat starten. `TELEGRAM_BOT_TOKEN` und `TELEGRAM_CHAT_ID` ausschließlich als Server-Umgebungsvariablen hinterlegen.
- `RESEND_API_KEY` und die Empfängeradresse unter den vorhandenen App-Einstellungen konfigurieren. Für Produktion `ALERT_FROM_EMAIL` mit einer bei Resend verifizierten Absenderdomain setzen. Der bestehende Test-Absender unterliegt Resend-Beschränkungen.
- `APP_URL=https://vix-trading.de` für Links zum Signalbereich setzen. Links führen auf die App; ein Link oder GET bestätigt niemals eine Order.
- Beide Kanäle erhalten ISIN, Regelgrund, Rundenbudget, Zielquote bzw. Verkaufsstückzahl, Referenzkurs und Zeitstempel. Käufe sind fünf Minuten gültig. Verkaufssignale werden während des eingerichteten Handelsfensters alle 15 Minuten erinnert. Ein Zustellfehler wird separat je Kanal gespeichert und erneut versucht; er gilt nicht als erfolgreiche Zustellung. Ein erfolgreicher Versand bestätigt nur die Annahme beim Anbieter, nicht das Lesen auf dem Handy.
- Bei einer Netzunterbrechung direkt nach Annahme durch Telegram kann ein erneuter Versand doppelt ankommen. Bestätigungen selbst sind transaktional und gegen doppelte Buchung geschützt.
- Bot-API-Vertrag: https://core.telegram.org/bots/api#sendmessage

## Serverseitiger Prüflauf

Der bestehende authentifizierte `/api/alerts/check`-Cron ruft die neue Strategie mit auf. Alternativ einen **einzigen** Cron für `GET /api/signals/check` mit Header `Authorization: Bearer <CRON_SECRET>` verwenden. Empfohlen: jede Minute durchgehend; das Brokerfenster wird ausschließlich auf dem Server geprüft. Der bisherige Fünf-Minuten-Cron funktioniert, beobachtet die Kurse aber gröber. Kein Browser muss geöffnet bleiben. Nicht beide Zeitpläne unnötig parallel betreiben.

`force` umgeht niemals das Brokerfenster der neuen Strategie. Der bestehende `dryRun=true` verändert den Signalzustand nicht. Das neue manuelle „Jetzt prüfen“ ist ein echter Prüflauf, der bei aktiver Überwachung auch Nachrichten versenden kann.

Die App zeigt letzte Prüfung und Zustellfehler. Ein separater externer Dienst zur Erkennung eines vollständig ausgefallenen Servers ist noch nicht eingerichtet.

## Datenqualität

Für neue Käufe sind frische VIX-, tatsächliche VX-, Geld- und Briefkurse erforderlich (maximal fünf Minuten alt, Zeitstempel aus der Quelle). Kein Ersatz von VX durch VIX3M; kein geschätzter Briefkurs aus Spread oder Geldkurs. Der Adapter liest Vontobels Produktseite und Chartdaten, prüft aktive EUR-Produkte und das konfigurierte Basiswertsymbol. Wenn die Quelle keinen echten Briefkurs/zugehörigen Zeitstempel liefert, bleiben Käufe gesperrt. Die Quelle muss vor Aktivierung mit einem tatsächlich aktiven Produkt geprüft werden; gegebenenfalls ist ein anderer/zusätzlicher Marktdatenfeed nötig.

Verkäufe werden anhand frischer Produkt-Geldkurse auch bei ausgefallenem VIX/VX geprüft. Kurse sind beobachtete Stichproben, keine Tick-für-Tick-Überwachung: zwischen Prüfläufen können Kreuzungen und Höchststände fehlen. Nach einer Datenlücke wird keine verpasste Einstiegskreuzung erfunden. Die Intraday-Ausführung entspricht somit nicht automatisch dem bisherigen Tagesbacktest.

## Regeln

- Beobachtetes Unterschreiten von VIX 15,5: kumuliert 30 %. Neue Abwärtskreuzungen bei 14,5 und 13,5: 40 % bzw. 50 %. Bei übersprungenen Schwellen gilt die erreichte Zielstufe. Bei 12,5 keine zusätzliche Stufe.
- Bestätigte VIX-Datenregel `delayed20`: Yahoo-VIX für Einstiege maximal20 Minuten alt; Zertifikats-Geld/Brief und tatsächlicher VX weiterhin maximal5 Minuten. Ausstiege verwenden den frischen Vontobel-Geldkurs unabhängig vom VIX. Quelle/Kurszeit des verzögerten Einstiegs sichtbar.
- VX/VIX-Aufschlag maximal 15 %, konkreter VX-Kontrakt mindestens 30 Tage Restlaufzeit. Ein Produkt-/Kontraktwechsel ist bei offener Runde gesperrt.
- Weitere Käufe gesperrt nach aktivem Trailing oder Teilreduktion. Budget pro Nachkauf ist kumulierte Zielquote minus tatsächliche bisherige Kaufkosten inklusive Gebühren.
- Trailing ab +10 % auf den gemeinsamen liquidierbaren Positionswert relativ zu verbleibenden Anschaffungskosten: 8 % Abstand zum Höchstwert, ab +20 % 6 %, ab +35 % 5 %. Die Barriere sinkt nicht. Verkauf bei Unterschreiten.
- Positionsverlustgrenze −40 %. Variante C priorisiert realisierten plus unrealisierten Rundenverlust von 6 % des festgelegten Startkapitals.
- A: Zeitverkauf nach zehn Kalendertagen. B/C: einmalige Prüfung ab Tag zehn, ohne aktives Trailing und bei Rendite <= 0 Verkauf von 80 % jeder Tranche. Ganze Stücke werden abgerundet, mindestens ein Stück verkauft; sehr kleine Tranchen können vollständig geschlossen werden. Rest ohne Trailing ab Tag 20 schließen. Tage werden nach Berliner Kalenderdatum berechnet.
- Nach vollständigem Ausstieg erneute Beobachtung von mindestens 15,5 und anschließende Abwärtskreuzung erforderlich. Rundenbudget bleibt innerhalb einer Runde fest; bestätigte Gewinne/Verluste bestimmen das Budget der nächsten Runde.
- Verlust- und Trailing-Schwellen sind Signale. Reaktionszeit, Kurslücken, Spreads und Gebühren können den tatsächlichen Verlust vergrößern. Noch unbekannte Verkaufsgebühren werden vor Ausführung nicht geschätzt.

## Screenshot → tatsächliche Ausführung

Der Nutzer sendet den Screenshot in diesem Chat. Vor dem Eintragen müssen **Ausführung** (nicht bloß Orderauftrag), ISIN, Kauf/Verkauf, gesamte Stückzahl, tatsächlicher bzw. gewichteter Ausführungskurs, Gebühren und Ausführungszeit erkennbar sein. Fehlende/mehrdeutige Werte nachfragen. Keine Zugangsdaten oder Kontonummern in Notizen übernehmen. Screenshotbilder werden nicht automatisch gespeichert oder analysiert; der Chat liest sie, die App erhält nur die bestätigten strukturierten Daten.

Ein berechtigter Aufruf von `POST /api/signals/confirm` verwendet Bearer `SIGNALS_ACCESS_KEY` oder das geschützte Browser-Cookie:

```json
{
  "signalId": "UUID des Signals",
  "action": "execute",
  "quantity": 299,
  "price": 10,
  "fees": 5,
  "at": "2026-11-17T11:30:00+01:00",
  "note": "Ausgeführt laut Screenshot; Orderreferenz falls vorhanden"
}
```

Eine Bestätigung pro Signal. Mehrere Teilausführungen zu gesamter Stückzahl, gewichtetem Preis und Gebühren zusammenfassen. Abweichungen vom empfohlenen Kaufbetrag sind als tatsächliche Ausführung erfassbar; die Strategie verwendet danach die realen Werte. Abgelaufene/ersetzte Signale bleiben für bereits erfolgte Ausführungen nachtragbar. Verkäufe über den bestätigten Bestand werden abgelehnt. Bei geänderter Produktzuordnung oder widersprüchlichen Belegen zuerst abgleichen.

`action: "skip"` erfasst ausdrücklich **keinen Trade**. Ein weiter bestehendes Verkaufskriterium kann im nächsten Prüflauf ein neues Signal auslösen. Die Bestätigung aktualisiert Signalbestand, Rundenrechnung, bestehende Trades und Positionen in einer DB-Transaktion. Exakte Wiederholungen erzeugen keine Doppelbuchung. Signalpositionen sind im alten Trade-/Positionseditor gegen unabhängige Änderungen gesperrt; Korrekturen müssen bewusst mit dem Signalbestand abgeglichen werden.

## Lokale Prüfung

```sh
npm run test:signals
npx tsc --noEmit
npm run build
```

DB-Integrationstest: eine **wegwerfbare lokale PostgreSQL-Datenbank** `vix_signals_test` auf Port `55439` anlegen, das Prisma-Schema dort mit `db push` aufbauen und `tests/signals-db.test.cjs` mit entsprechendem `DATABASE_URL`/`DIRECT_URL` starten. Das Skript verweigert andere Ziele und löscht nur die dortigen Test-Trades, Test-Positionen und Test-Caches. Niemals die Projekt-`.env` dafür übernehmen: sie verweist auf Produktion.

## Verifizierter Entwicklungsstand

21 automatisierte Regel-/Benachrichtigungstests, ein separater PostgreSQL-Integrationstest, zehn HTTP-Prüfungen sowie Desktop-/390px-Browserprüfung inklusive simuliertem Kauf bestanden. Produktionsbuild und TypeScript-Prüfung bestanden. Keine Live-Zustellung, keine Live-Aktivierung und kein aktiver neuer Datenfeed wurden damit bestätigt.

## Geschützte Telegram-Verknüpfung ohne Token im Chat

Der Token liegt ausschließlich unter `TELEGRAM_BOT_TOKEN` auf Hostinger. Eine Chat-ID als Servervariable ist nicht mehr erforderlich: die bestätigte private Chat-ID kann im vorhandenen `VixCache.telegram_connection_v1` gespeichert werden. `TELEGRAM_CHAT_ID` hat bei expliziter Konfiguration weiterhin Vorrang.

Nach Bereitstellung erzeugt der Operator mit `node scripts/connect-telegram.mjs prepare Vix98_Trading_Bot` eine 30 Minuten gültige Verknüpfung. Der Nutzer öffnet den ausgegebenen Telegram-Startlink und tippt Starten. Ein separates Administrationsgeheimnis verbleibt in einer lokalen Datei mit Modus 0600 außerhalb des Repositorys; im Datenbankeintrag liegen ausschließlich Hashes. `node scripts/connect-telegram.mjs complete <credentialsFile>` ruft den Server auf. Der Server prüft den Bot-Benutzernamen, einen bestehenden Webhook (wird niemals automatisch gelöscht), exakten Startcode und privaten Absender und versendet eine eindeutig als solche bezeichnete Testnachricht. Bei mehreren passenden Chats wird abgebrochen. Erst danach wird die bestätigte Chat-ID gespeichert.

Die Route `/api/telegram/connect` akzeptiert nur die zeitlich begrenzte Administrationsfreigabe. Ohne diese gibt sie keine Telegram-Daten aus. Sie aktiviert weder Handelsregeln noch automatische Orders und ersetzt keinen bestehenden Token. Die Verbindung ist erst nach einer erfolgreichen Serverantwort und empfangener Testnachricht bestätigt.

## Bestätigte Nutzereinstellungen am 17.11.2026

Strategiekapital 1.500 EUR, Variante C, geplanter Einstiegshebel ca. 2,0. Kumulierte Zielquoten 30/40/50 % entsprechen 450/600/750 EUR; zusätzliche Käufe zunächst jeweils 150 EUR abzüglich bereits entstandener Kostenabweichungen. Rundenverlustsignal 90 EUR. Broker comdirect, vorbereitetes Produkt-Handelsfenster Stuttgart 08:00–22:00 Europe/Berlin; 2026-Feiertage nach Börse Stuttgart, Jahreswechsel/Sonderzeiten vor Aktivierung ergänzen. System bleibt pausiert.

BD11R4 / DE000BD11R44 ist ein Produktbeispiel, keine bestätigte Order und noch keine freigegebene Auswahl. Die aktuellen Vontobel-Metadaten nennen UXZ6 (Dezember 2026), während die Börsenseite noch November im Titel führt. Mit Dezember-Verfall 16.12.2026 liegt die Restlaufzeit am 17.11. bei 29 Kalendertagen. Daher heute nach der bestätigten 30-Tage-Regel kein neuer Einstieg in dieses Produkt.

Der Adapter wertet die aktuellen Vontobel-Preis-Snapshots mit deren `latestTimestamp` aus. Getrennte bidTimestamp/askTimestamp haben Vorrang, wenn vorhanden. Produktchart-Kurse sind nur datierte Rückfälle; ein Briefkurs wird niemals aus Geldkurs/Spread geschätzt. Long-Richtung, EUR und identischer aktueller Basisvertrag müssen passen.

Quellen: https://markets.vontobel.com/de-de/produkte/hebel/mini-futures/DE000BD11R44 · https://www.boerse-stuttgart.de/en/products/leverage-products/knock-out-products/stuttgart/bd11r4/ · https://www.boerse-stuttgart.de/de-de/handel/handelszeiten/ · https://cdn.cboe.com/resources/aboutcboe/Cboe-2026FuturesSettlementCalendar.pdf

## Serverüberwachung starten (17.11.2026)

Der Nutzer hat den Start ausdrücklich autorisiert. Für dieses Setup wird ein eigener Hostinger-Prüflauf alle fünf Minuten mit einer minimal berechtigten Scheduler-Kennung verwendet. Nur der Hash der Kennung liegt unter `VixCache.signal_monitor_cron_v1`; das Klartextgeheimnis gehört ausschließlich in die private Cron-Konfiguration. Es berechtigt zu `GET /api/signals/check`, nicht zur Konfiguration, Ausführungsbestätigung oder zum Lesen von Archiv-/Kontodaten. Bestehendes `CRON_SECRET` bleibt optional kompatibel. Letzter Aufruf/Abschluss/Fehler wird ohne Kurs-/Geheimnisdaten im Scheduler-Datensatz protokolliert.

Serverseitig gilt das Brokerfenster08–22 Europe/Berlin mit Wochenenden und hinterlegten Schließtagen. Außerhalb wird die Signalprüfung übersprungen. Der Datenarchiv-Cron läuft unabhängig weiter. Kein Cron erteilt Brokerorders.

Geprüftes Beispielprodukt BD11R4/DE000BD11R44 wird mit dem aktuellen VX-Vertrag UXZ6 (Dezember2026), Verfall16.12.2026 und Barriere12,10USD überwacht. Die unbegrenzte Laufzeit des Zertifikats ist bestätigt; laut endgültigen Bedingungen rollt der Emittent in spätere Futures und passt Basispreis/Barriere an. Die App übernimmt einen Roll nicht ungeprüft und weicht die30-Tage-VX-Regel nicht auf: bei Start am17.11. sind neue Käufe deswegen gesperrt. Ein aktiver Prüftakt ist keine Freigabe einer regelwidrigen Order.

Quellen: [Vontobel](https://markets.vontobel.com/de-de/produkte/hebel/mini-futures/DE000BD11R44), [endgültige Bedingungen](https://derinet.vontobel.ch/finalterms/DE000BD11R44d.pdf), [Cboe-Verfallkalender](https://www.cboe.com/markets/us/futures/market-statistics/settlement/futures/daily).
