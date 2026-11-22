# Marktdatenarchiv

## Was gesammelt wird

Der Collector läuft unabhängig von geöffneten Browsern und von der Signalüberwachung. Der geschützte Sammel-Endpunkt wird alle fünf Minuten aufgerufen. Das serverseitige Sammelfenster gilt in Europe/Berlin, Mo–Fr 08:00 bis vor 22:00 Uhr, außer hinterlegten Schließtagen.

- Der Collector fragt den verzögerten Yahoo-VIX als Indexstand ab. Pro Sammelintervall kann ein Wert gespeichert werden, auch anhand eines unveränderten Quellkurses. Quellzeit und Empfangszeit bleiben getrennt. Das sind Kursstichproben. App-Abrufe können zusätzlich echte Yahoo-VIX-Tages- und Intraday-Kerzen speichern. Eine konfigurierte Massive-Abfrage speichert VIX unter der separaten Kennung `MASSIVE:I:VIX`.
- Pro Intervall wird die Emittentenseite des bestätigten Strategieprodukts und der aktuell gehaltenen Produkte mit gültiger ISIN abgerufen. Während einer Signalrunde hat deren bestätigte Zuordnung Vorrang. Identische ISINs werden einmal pro Sammellauf abgefragt. Manuelle offene Positionen und eigenständige offene Trades können datierte Geld-/Briefkurse und Produktstatus beitragen, sobald Vontobel sie unter dieser ISIN ausweist. Ohne bestätigte Zuordnung fließt ihr Basiswert nicht in Strategietests ein. Der Collector selbst lädt keine Vontobel-Chartserien herunter.
- Wir speichern datierte Original-Geld- und Briefkurse sowie den tatsächlichen VX-Kurs bei übereinstimmendem Emittentensymbol und geprüftem Verfall aus der Strategiekonfiguration. Das Archiv erfasst Änderungen von Produktstatus und Stammdaten, einschließlich beobachtetem und erwartetem Basisvertrag, Barriere und, soweit vom Emittenten ausgewiesen, Basispreis, Bezugsverhältnis und Finanzierungsspanne.
- VIX3M, EUR/USD, S&P 500 und S&P-500-Future können die App weiterhin mit aktuellen Kursen und nachgeladener Historie versorgen. Das Archiv legt dafür keine neuen langfristigen Kursbeobachtungen an. Bestehende Reihen werden weiter angezeigt.

Die Signalprüfung verwendet nach Möglichkeit einen höchstens vier Minuten zuvor empfangenen Yahoo-VIX mit höchstens 20 Minuten Kursalter. Bei Bedarf fragt sie die Quelle direkt ab. Produktabfragen des Signalprüflaufs liefern ebenfalls archivierungsfähige Daten und können zusätzliche Emittentenabrufe auslösen. Fehlende Quellen, veraltete Stichproben und Änderungen des Basisvertrags können Abdeckungslücken verursachen.

## Daten für Strategietests

- `strategy_certificate_quote` speichert je Abruf die vorhandenen, vom Emittenten datierten Geld-/Briefseiten. `sourceAt` ist die Quellzeit des Geldkurses, falls vorhanden, sonst des Briefkurses. `metadata.bidSourceAt` und `metadata.askSourceAt` geben die jeweilige Quellzeit an. Bei abweichendem VX-Symbol kann der tatsächliche Zertifikatsgeldkurs weiter vorliegen. In diesem Fall zeigt `metadata.mappingVerified=false` die fehlende Zuordnung.
- `strategy_vx_quote` verlangt bestätigte Zuordnung, konkretes `contract`-Symbol, `metadata.futureExpiry` und tatsächlich datierten Einzelkontraktkurs aus dem Emittenten-Snapshot. Gehören Zertifikat und VX zum selben Abruf, teilen sie eine `fetchId`.
- `strategy_product_status` erfasst beobachtete Änderungen. Ohne eindeutigen Ereigniszeitpunkt beim Emittenten bleibt `sourceAt` leer. `receivedAt` ist der Beobachtungszeitpunkt. Ein Abruffehler ergibt „Status unbekannt“. Ein inaktiver Status verlangt eine passende explizite Emittentenangabe. Historische Preisstände werden als separate Beobachtungen aufbewahrt. Aus dem Status allein folgt kein tatsächlicher Abrechnungskurs oder Restwert.
- Historische Chartpunkte ohne eindeutiges Kontraktsymbol bleiben als `UNVERIFIED_UNDERLYING_SERIES:<ISIN>` separat. VIX3M ist ein Index. Wegen unklarer Zuordnung bleiben die alten generischen FUTURES-Daten aus `VixIntraday` außerhalb dieser Auswertung.
- Ein Replay muss neben der Kurszeit auch den Empfang berücksichtigen. Ein erst später eingetroffener Wert war zu einem früheren Signalzeitpunkt noch nicht bekannt. Preiswerte älterer Stichproben bleiben im Archiv und ihre Nutzbarkeit richtet sich nach den Altersgrenzen der Strategie.

## Abrufstatistiken und Export

`MarketFetch` erfasst Quelle, Instrument, Beginn und Ende des Aufrufs, Laufzeit, Erfolg/Fehler, Zahl der gelieferten und neu gespeicherten Punkte sowie, soweit messbar, HTTP-Status und Antwortgröße. Yahoo wird auf SDK-Ebene erfasst. Massive und Vontobel werden je direktem HTTP-Aufruf gemessen. Antwortgrößen beziehen sich auf die dekomprimierte Antwort. API-Schlüssel und rohe Antwortinhalte werden nicht gespeichert.

Einzelabrufe bleiben rund **60 Berliner Kalendertage** im Detail verfügbar. Ein regelmäßiger Sammellauf fasst ältere Abrufe transaktional nach Berliner Tag, Quelle, Instrument und Messart zusammen. Während der Umstellung kann die Detailhistorie vorübergehend weiter zurückreichen. Kursbeobachtungen, Produktstatus und Sammellauf-Historie werden davon unabhängig erhalten.

- `/api/archive/export?type=quotes` liefert Kursbeobachtungen und Produktstatus inklusive Herkunft, Quell- und Empfangszeit, Abruf-ID und Metadaten.
- `/api/archive/export?type=requests` liefert noch verfügbare Einzelabrufe. Die alte Detailtiefe kann aus den Tagesstatistiken nicht wiederhergestellt werden.
- `/api/archive/export?type=days` liefert die Tagesstatistik über den gewählten Zeitraum ohne Begrenzung durch die Anzeige. Zusammengefasste ältere Daten werden in ganzen Berliner Tagen ausgewertet.
- Zeitraum, Quelle und Instrument können im Archiv gefiltert werden. Kursdaten verwenden die Empfangszeit, Einzelabrufe die Startzeit. CSV verwendet UTF-8 mit BOM und UTC für Zeitstempel. CSV-Sicherungen sind möglich, ein externes Backup wird dadurch nicht automatisch eingerichtet.

## Betrieb und Einrichtung

Die Tabellen für ältere Archivstände stehen in `prisma/migrations/20261117_market_archive/migration.sql`. `20261122_archive_daily` ergänzt die Tagesstatistik und einen Index für Produktstatus. `node scripts/apply-archive-schema.cjs` wendet beide Migrationen transaktional und idempotent an. Vor Bereitstellung braucht die Zielumgebung die neue Archivtabelle. Die lokale Integrationsprüfung erfolgt auf einer dedizierten Wegwerf-Datenbank.

Der Collector verwendet `VixCache.market_archive_config_v1`. Darin steht nur der SHA-256-Hash des privaten Collector-Tokens. Der persönliche Nutzerzugang ist separat. Die zentrale Website-Anmeldung schützt Archiv und Exporte. [Anmeldung](AUTH.md)

## Prüfungen

- `npm run test:archive` prüft Zeitstempel, Instrumentzuordnung, beobachteten inaktiven und unbekannten Produktstatus, Original-Geld-/Briefkurse, Berliner Sammelfenster, Duplikate und CSV.
- `tests/archive-db.test.cjs` prüft parallele Collector-Läufe, zusammengehörende Kursbeobachtungen, Statusänderungen sowie konkurrierende Kompaktierung mit unveränderten Tageszahlen. Der Test akzeptiert ausschließlich die lokale Datenbank `vix_archive_test` auf Port 55439.
