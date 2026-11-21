# Langfristiges Marktdatenarchiv

## Abrufhäufigkeit und Umfang

Die vorherige Oberfläche aktualisiert in der Regel alle fünf Minuten, wenn sie geöffnet ist (altes Fenster 07:00–22:30 Berlin). Cache-Antworten sind keine neuen Quellenabrufe. Vor dieser Erweiterung war bei Hostinger kein Cron-Job konfiguriert; ein kontinuierlicher Fünf-Minuten-Abruf konnte deshalb nicht zugesichert werden.

Die neue Datensammlung läuft unabhängig von geöffneten Browsern und unabhängig vom Aktivierungszustand der Handelsüberwachung. Ein Hostinger-Cron ruft alle fünf Minuten den geschützten `POST /api/archive/collect` auf. Das Sammelfenster wird serverseitig in Europe/Berlin geprüft: Mo–Fr 08:00 bis vor 22:00 Uhr, außer hinterlegten Schließtagen. Sommerzeit wird über Intl behandelt. Sonderzeiten und Kalender für kommende Jahre müssen vorab gepflegt werden.

Der geplante Sammellauf ruft ausschließlich den verzögerten Yahoo-VIX ab, maximal 168 Mal pro vollem Handelstag. Die Signalprüfung verwendet nach Möglichkeit einen höchstens vier Minuten zuvor empfangenen, höchstens 20 Minuten alten gespeicherten Wert. Bei Ausfall holt sie selbst einen Wert. Neue Kursbeobachtungen werden nur für den VIX archiviert; bestehende historische Daten und Abrufstatistiken bleiben erhalten. Zeitgleiche oder zusätzliche App-Abrufe können weitere Quellenanfragen verursachen. Jeder erfolgreiche geplante Lauf kann eine eigene Beobachtung pro Fünf-Minuten-Slot speichern, auch bei unverändertem Quellkurs. Quellzeit und Empfangszeit bleiben getrennt; es handelt sich nicht um echte 5-Minuten-OHLC-Kerzen.

Yahoo wird auf Ebene der SDK-Aufrufe gemessen. Cookie-/Crumb-Abfragen, interne Wiederholungen und der genaue Yahoo-Netzwerkverkehr sind nicht bekannt und werden nicht als exakt gemessen dargestellt. Bei Massive und Vontobel werden direkte fetch-Aufrufe sowie die UTF-8-Größe der dekomprimierten Textantwort erfasst. Diese Bytes sind kein Maß für den vollständigen Netzwerkverkehr. Massive wird als eigene Quelle `massive`, Instrument `MASSIVE:I:VIX` und Art `index_quote` gespeichert; Yahoo-VIX bleibt separat unter `YAHOO:^VIX`. API-Schlüssel und rohe Antwortinhalte werden nicht im Archiv gespeichert. HTML-Antworten werden ebenfalls nicht dauerhaft gespeichert.

## Dauerhafte Daten

- `MarketObservation`: Quelle, Instrument, Art, Währung, ISIN/Einzelkontrakt, originale Quellzeit (oder explizit fehlend), tatsächliche erste Empfangszeit, Kursfelder und Qualitätsstatus.
- `MarketFetch`: jeder erfasste Quellenaufruf inklusive fehlgeschlagener Aufrufe, Beginn/Ende, Dauer, HTTP-Status soweit bekannt, Messart, Antwortgröße soweit bekannt, Anzahl gelieferter/neuer Punkte und Herkunft (App, Signalprüfung, Collector).
- `MarketCollectionRun`: regelmäßige Sammelläufe, Status und zeitlich begrenzte Lease. Ein abgeschlossener Slot wird nicht doppelt gesammelt. Gleichzeitige Prozesse werden über die DB koordiniert.

Identische Quellzeit/Kurse/Instrumente werden nicht erneut als Datenpunkt gespeichert; der erneute Abruf bleibt als eigener MarketFetch sichtbar. Eine geänderte Preisangabe bei gleicher Quellzeit bleibt als Revision erhalten. Ohne Quellzeit wird keine Quellzeit erfunden und keine scheinbare Eindeutigkeit angenommen.

Frisch/veraltet bezieht sich auf den ersten Empfang eines gespeicherten Punktes (fünf Minuten Grenze). Historische Kerzen sind explizit historisch. Veraltete Werte werden zur Analyse aufbewahrt, damit aber nicht für Handelssignale freigegeben.

Aktuelle Emittentenseiten können einen konkreten VX-Vertrag mit Symbol benennen. Historische Vontobel-Chartpunkte geben hingegen nicht zwingend für jeden Punkt den damaligen Vertrag an. Solche Reihen werden als `UNVERIFIED_UNDERLYING_SERIES:<ISIN>` getrennt gespeichert, nicht rückwirkend einem heutigen Vertrag zugeordnet. VIX3M bleibt ein Index/Proxy und wird niemals zu VX umbenannt. Die alte `VixIntraday`-Tabelle bleibt unverändert; deren generische FUTURES-Daten werden wegen unklarer Identität und möglicher Proxy-Fallbacks nicht stillschweigend importiert.

## Aufbewahrung und Export

Kein automatisches Löschen oder Überschreiben des Archivs. PostgreSQL ist dauerhafter Speicher über App-Neustarts und Deployments hinweg. Das ist kein unabhängiges externes Backup. Eigene CSV-Sicherungen sind möglich. Datenbanktarif und Speicherkapazität müssen bei wachsendem Archiv beobachtet werden; es erfolgen keine automatischen Tarifwechsel.

`/archive` zeigt Gesamtbestand, Speichergröße inklusive Indizes, Quellenabrufe und Fehler pro Tag, Datenreihen und Quellzeiten sowie Qualitätsklassen. Zugang über den vom Nutzer in Hostinger hinterlegten `SIGNALS_ACCESS_KEY`. Das signierte HttpOnly-Cookie gilt nun für `/api`, sodass Signalbereich und Archiv dieselbe Anmeldung verwenden können. Ältere auf `/api/signals` beschränkte Cookies erfordern eine neue Anmeldung im Archiv.

- `/api/archive/export?type=quotes`: Kursdaten.
- `/api/archive/export?type=requests`: Abrufprotokoll.
- ISO-Filter `from`/`to`, optional `source` (massive/yahoo/vontobel) und exakte `instrument`-Kennung. Die Oberfläche übersetzt Berliner Kalendertage in UTC-Grenzen.
- Filter nach Abruf-/Empfangszeit; CSV enthält zusätzlich Original-Quellzeit. Ein historischer Punkt, der heute geladen wird, hat deshalb heute eine Empfangszeit und eine frühere Quellzeit.
- UTF-8 mit BOM, Semikolon als Trennzeichen, Dezimalpunkt für Zahlen, UTC-Zeitstempel. String-Felder werden gegen Excel-Formelauswertung entschärft.
- Streaming in Blöcken von 1.000 Zeilen ohne stilles Gesamt-Zeilenlimit. Die Tagesübersicht begrenzt ausschließlich die Anzeige auf 366 Tage. Für sehr große Exporte können Zeiträume aufgeteilt werden; ein Netzwerk-/Serverabbruch kann einen Download unterbrechen.

## Betrieb und Authentifizierung

`VixCache.market_archive_config_v1` hält Sammelkonfiguration und ausschließlich den SHA-256-Hash eines zufälligen, nur für den Collector gültigen Bearer-Tokens. Das eigentliche Token liegt in der privaten Hostinger-Cron-Konfiguration; es wird nicht in Git/Logs oder die Browserantworten geschrieben. Es erlaubt nur den begrenzten Sammellauf, keinen Zugriff auf Trades oder Archivexporte. Der persönliche Nutzerzugang ist separat.

HTTP-Caches der Oberfläche werden nicht als Quellenabrufe gezählt. Ein Archiv-Schreibfehler wird im Serverlog und als Prozessstatus kenntlich gemacht; vorhandene Marktdatenfunktionen bleiben nutzbar. Nicht erfolgreich persistierte Abrufe können bei einem Datenbankausfall fehlen; erfolgreiche Archivierung wird nicht behauptet. Fehlgeschlagene/unvollständige Collector-Läufe bleiben erkennbar. Es wird keine lückenlose rückwirkende Historie erfunden.

## Datenbankeinrichtung

Die Migration `prisma/migrations/20261117_market_archive/migration.sql` erstellt ausschließlich drei neue Tabellen und ihre Indizes. `node scripts/apply-archive-schema.cjs` wendet sie transaktional und idempotent an. Keine bisherigen Trading-Tabellen werden verändert/gelöscht. Produktionszugang bleibt ausschließlich in der vorhandenen, nicht versionierten Umgebung.

## Verifikation

- `npm run test:archive`: Normalisierung, Duplikate/Revisionen, Trennung von Kontrakten und Proxys, Zeitqualität, Kalender/Sommerzeit, CSV-Escaping und Quellenfilter inklusive Massive.
- `tests/archive-db.test.cjs`: nur gegen die explizit wegwerfbare lokale Datenbank `vix_signals_test` auf 127.0.0.1:55439. Prüft persistierte Abrufe, Fehlerfälle, Duplikate und parallele Collector-Aufrufe mit simulierten Quellen.
- HTTP-Prüfung: Zugriffsschutz, Cookie-Pfad, Statistik/DB-Größe und CSV mit 2.005 Punkten über drei Datenbankseiten vollständig und ohne doppelte IDs.
- Desktop und 390px-Handyansicht geprüft; die Hauptspalte darf bei breiten Tabellen schrumpfen, Tabellen scrollen innerhalb ihrer Karte.
- Bestehende 33 Signal-/Telegram-Tests weiter erfolgreich. Kein automatischer Handel wird durch die Datensammlung aktiviert.
