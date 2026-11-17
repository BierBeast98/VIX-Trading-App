# VIX-Datenfeed

Stand: 17.11.2026. **Der Nutzer akzeptiert ausdrücklich Yahoo-VIX mit 15–20 Minuten Verzögerung für Einstiege. Kein kostenpflichtiger Zugang erforderlich. Ausstiegssignale benötigen weiterhin frische Vontobel-Geldkurse; Handelsüberwachung bleibt bis zur Produkt-/Rollklärung pausiert.**

## Ursache und Quellenwahl

Yahoo nennt für Cboe-Indizes 15 Minuten Verzögerung. Der bisherige zusätzliche Fünf-Minuten-Cache führte zeitweise zu ungefähr 20 Minuten alten Anzeigen. Ein frischer HTTP-Abruf macht die zugrunde liegende Kurszeit nicht frischer.

- Yahoo: https://help.yahoo.com/kb/finance/article-exchanges-data-delays-sln2310.html
- Verifizierbare Alternative: Massive, Indices Snapshot, exakt `I:VIX`: https://massive.com/docs/rest/indices/snapshots/indices-snapshot
- Die Anbieterdokumentation nennt Indices Starter für 49 USD/Monat mit 15 Minuten Verzögerung, **Indices Advanced für 99 USD/Monat mit Echtzeitdaten**. Kein Abonnement wurde gekauft oder angelegt. Tarif, VIX-Berechtigung und persönliche Nutzung müssen beim Abschluss tatsächlich freigeschaltet sein.

## Bestätigte kostenlose Datenregel

Im bestätigten Strategiezustand ist `vixEntryPolicy=delayed20` hinterlegt. Nur Originalkurse von `source=yahoo`, `feedMode=delayed` mit maximal20 Minuten Kursalter und höchstens1 Minute Uhrabweichung in die Zukunft sind für Einstiege zugelassen. Abruf alle fünf Minuten; keine rückwirkend geschätzten Schwellenkreuzungen über Quelllücken größer als10 Minuten.

Bid, Ask und tatsächlicher VX behalten maximal5 Minuten Kursalter. Die Lockerung betrifft ausschließlich den VIX-Einstieg. Ausstiegssignale brauchen einen positiven endlichen aktuellen Vontobel-Geldkurs und keinen aktuellen VIX/VX. Für den Versand eines Kaufs werden sowohl die aktuelle Beobachtung als auch die originale VIX-Basis des Signals erneut geprüft. Ein inzwischen über20 Minuten alter Signalauslöser wird auch bei neuerem Folgekurs nicht mehr verschickt. Quelle, ursprüngliche Kurszeit und Alter bei Signalerstellung werden sichtbar mitgeteilt.

VIX und VX besitzen damit unterschiedliche Zeitstände. Der unveränderte Aufschlagfilter vergleicht den aktuellen VX mit dem verzögerten VIX. Das ist keine zeitgleiche Marktbeobachtung; der Zertifikatskurs kann bereits auf Bewegungen reagiert haben. Eine 15-minütige Verzögerung schließt größere Bewegungen nicht aus.

Fehlt eine bewusste Datenregel, bleibt die sichere Standardrichtlinie `realtime` mit maximal5 Minuten bestehen. Eine laufende Runde oder ein offenes Signal sperrt die Richtlinienänderung. Ältere Clients können eine bereits bestätigte Richtlinie nicht durch Weglassen des Feldes zurücksetzen.

## Vontobel-Altersprobe des Nutzerbeispiels

`BD11R4 / DE000BD11R44`: am17.11.2026 um16:43:31 Berlin empfangen, `price.latestTimestamp=2026-11-17T15:43:19.757+00:00`, ungefähr11 Sekunden Snapshotalter, Geld1,03 EUR / Brief1,04 EUR. Tatsächlicher VX-Snapshot4 Sekunden alt. Die Chartpunkte waren dagegen von16:35 Uhr, über8 Minuten alt; sie werden nicht als frischer Geldkurs ausgegeben. Der bestehende Adapter bevorzugt den aktuellen Snapshot und prüft jeden Quellzeitstempel.

Vontobel lieferte für dieses Beispiel keine getrennten bidTimestamp/askTimestamp, sondern einen gemeinsamen Snapshot-Zeitstempel. Kein garantierter Börsenausführungskurs oder garantierter dauerhafter Sekundenfeed. Bei fünfminütigem Prüftakt kann die Erkennung einer Kursbewegung zusätzlich biszu fünf Minuten dauern.

## Optionale Echtzeitanbindung auf Hostinger

Bei **vix-trading.de** ergänzen, bestehende Variablen erhalten:

```
MASSIVE_API_KEY=<eigener API-Schlüssel, nur beim Hoster hinterlegen>
VIX_DATA_PROVIDER=massive
```

Den Schlüssel niemals im Chat/Screenshot oder im Git-Repository übermitteln. Nur Schlüsselpräsenz wird als Konfiguration angezeigt, niemals als Beweis für Echtzeitberechtigung. Wenn `VIX_DATA_PROVIDER` leer und ein Schlüssel vorhanden ist, wird Massive automatisch ausgewählt. Ohne Schlüssel bleibt Yahoo sichtbar verzögert. Explizites `yahoo` wählt weiterhin nur den verzögerten Feed. Unbekannte Providerkonfigurationen führen nicht zu einer Echtzeitfreigabe.

Die API benutzt ausschließlich den festen Host `api.massive.com`, Bearer-Authentifizierung im Header, keine Redirects und einen 12-Sekunden-Timeout. Providerantworten/Fehler mit potentiell vertraulichen Inhalten werden nicht in Meldungen oder Protokolle kopiert.

## Kursidentität und Freigabe

Nur für die optionale Richtlinie `realtime` müssen neue Käufe folgende zusätzlichen VIX-Bedingungen erfüllen:

- exakt VIX-Index `I:VIX`, Typ `indices`, positiver endlicher Wert;
- Provider meldet ausdrücklich `REAL-TIME`;
- ursprünglicher `last_updated`-Zeitstempel in Nanosekunden; niemals Abrufzeit als Ersatz;
- Kurs maximal fünf Minuten alt, höchstens eine Minute Uhrabweichung in die Zukunft, Markt nicht als geschlossen gemeldet;
- zusätzlich alle unveränderten Produkt-/Strategieregeln.

In der Richtlinie `realtime` geben `DELAYED`, unbekannte Berechtigung, fehlende/ungültige Zeitstempel, HTTP401/403/429 oder Ausfälle keinen neuen Kauf frei. In `delayed20` ist ausschließlich der oben bestätigte Yahoo-Zweig erlaubt. Yahoo kann als **verzögerte Anzeige** einspringen. Bestehende risikobasierte Verkaufssignale anhand frischer Zertifikats-Geldkurse bleiben davon unabhängig.

## Persönlicher Zugriff und Cache

Massive beschreibt Individual-Pläne als persönliche Nutzung: https://massive.com/knowledge-base/article/which-plan-do-i-need-to-show-massive-data-in-my-app . Die neue Anbindung gibt bezahlte Kurse deshalb nur über mit dem persönlichen Signalzugang entsperrte API-Anfragen aus. Nach dem Entsperren von `/signals` gilt das bestehende HttpOnly-Cookie auch für Dashboard-Anfragen. Serverinterne Collector-/Signalabrufe sind persönlich und benötigen kein Browsercookie. Anonyme Dashboard-/Widget-Anfragen verwenden weiter Yahoo; sie können keine persönlichen Echtzeitcache-Einträge lesen.

Dashboard-/Widget-Cache: höchstens 30 Sekunden, nach Providerkonfiguration und Zugriffsart getrennt, `Cache-Control: no-store`. Ein Datenbankcache erhält nur seine verbleibende Lebensdauer. Alte Daten ohne neue Quellenmetadaten werden nicht übernommen. Dashboard-Spot-Abruf alle fünf Minuten im bestehenden UI-Handelsfenster, Altersanzeige unabhängig alle 30 Sekunden. Der unabhängige Archivsammellauf bleibt alle fünf Minuten im konfigurierten Fenster.

Die Oberfläche unterscheidet **Daten abgerufen**, **VIX-Kurszeit (Berlin)**, Quelle, Kursalter und Verzögerung. Echtzeitstatus wird nicht durch das bloße Vorhandensein eines API-Schlüssels behauptet.

## Archiv und abschließender Test

Massive-Punkte werden getrennt als `source=massive`, `instrument=MASSIVE:I:VIX` gespeichert. Quell-/Empfangszeit, Berechtigung, Antwortgröße und Fehler bleiben erhalten. Ein fehlgeschlagener Massive-Abruf plus Yahoo-Fallback erscheint als zwei Abrufe, nicht als erfolgreicher Echtzeitabruf. CSV-Filter unterstützen beide Quellen getrennt.

Nur bei später bewusst gewünschter Echtzeitumstellung nach Hinterlegen des Zugangs: private API-/Collectorprobe durchführen, tatsächliche Berechtigung `REAL-TIME` und Quellzeit prüfen, erfolgreiche Archivierung kontrollieren. Keine Freischaltung allein nach Schlüsselpräsenz. Erst anschließend und nach separater Klärung des Open-End-/Rollverfahrens kann die Handelsüberwachung bewusst aktiviert werden.
