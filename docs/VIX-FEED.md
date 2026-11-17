# VIX-Datenfeed

Stand: 17.11.2026. **Die Anbindung ist vorbereitet, ein echter Echtzeitabruf ist ohne Anbieterzugang noch nicht verifiziert. Handelsüberwachung bleibt pausiert.**

## Ursache und Quellenwahl

Yahoo nennt für Cboe-Indizes 15 Minuten Verzögerung. Der bisherige zusätzliche Fünf-Minuten-Cache führte zeitweise zu ungefähr 20 Minuten alten Anzeigen. Ein frischer HTTP-Abruf macht die zugrunde liegende Kurszeit nicht frischer.

- Yahoo: https://help.yahoo.com/kb/finance/article-exchanges-data-delays-sln2310.html
- Verifizierbare Alternative: Massive, Indices Snapshot, exakt `I:VIX`: https://massive.com/docs/rest/indices/snapshots/indices-snapshot
- Die Anbieterdokumentation nennt Indices Starter für 49 USD/Monat mit 15 Minuten Verzögerung, **Indices Advanced für 99 USD/Monat mit Echtzeitdaten**. Kein Abonnement wurde gekauft oder angelegt. Tarif, VIX-Berechtigung und persönliche Nutzung müssen beim Abschluss tatsächlich freigeschaltet sein.

## Einrichtung auf Hostinger

Bei **vix-trading.de** ergänzen, bestehende Variablen erhalten:

```
MASSIVE_API_KEY=<eigener API-Schlüssel, nur beim Hoster hinterlegen>
VIX_DATA_PROVIDER=massive
```

Den Schlüssel niemals im Chat/Screenshot oder im Git-Repository übermitteln. Nur Schlüsselpräsenz wird als Konfiguration angezeigt, niemals als Beweis für Echtzeitberechtigung. Wenn `VIX_DATA_PROVIDER` leer und ein Schlüssel vorhanden ist, wird Massive automatisch ausgewählt. Ohne Schlüssel bleibt Yahoo sichtbar verzögert. Explizites `yahoo` wählt weiterhin nur den verzögerten Feed. Unbekannte Providerkonfigurationen führen nicht zu einer Echtzeitfreigabe.

Die API benutzt ausschließlich den festen Host `api.massive.com`, Bearer-Authentifizierung im Header, keine Redirects und einen 12-Sekunden-Timeout. Providerantworten/Fehler mit potentiell vertraulichen Inhalten werden nicht in Meldungen oder Protokolle kopiert.

## Kursidentität und Freigabe

Für neue Käufe müssen alle Bedingungen erfüllt sein:

- exakt VIX-Index `I:VIX`, Typ `indices`, positiver endlicher Wert;
- Provider meldet ausdrücklich `REAL-TIME`;
- ursprünglicher `last_updated`-Zeitstempel in Nanosekunden; niemals Abrufzeit als Ersatz;
- Kurs maximal fünf Minuten alt, höchstens eine Minute Uhrabweichung in die Zukunft, Markt nicht als geschlossen gemeldet;
- zusätzlich alle unveränderten Produkt-/Strategieregeln.

`DELAYED`, unbekannte Berechtigung, fehlende/ungültige Zeitstempel, HTTP401/403/429 oder Ausfälle geben keinen neuen Kauf frei. Yahoo kann als **verzögerte Anzeige** einspringen. Bestehende risikobasierte Verkaufssignale anhand frischer Zertifikats-Geldkurse bleiben davon unabhängig.

## Persönlicher Zugriff und Cache

Massive beschreibt Individual-Pläne als persönliche Nutzung: https://massive.com/knowledge-base/article/which-plan-do-i-need-to-show-massive-data-in-my-app . Die neue Anbindung gibt bezahlte Kurse deshalb nur über mit dem persönlichen Signalzugang entsperrte API-Anfragen aus. Nach dem Entsperren von `/signals` gilt das bestehende HttpOnly-Cookie auch für Dashboard-Anfragen. Serverinterne Collector-/Signalabrufe sind persönlich und benötigen kein Browsercookie. Anonyme Dashboard-/Widget-Anfragen verwenden weiter Yahoo; sie können keine persönlichen Echtzeitcache-Einträge lesen.

Dashboard-/Widget-Cache: höchstens 30 Sekunden, nach Providerkonfiguration und Zugriffsart getrennt, `Cache-Control: no-store`. Ein Datenbankcache erhält nur seine verbleibende Lebensdauer. Alte Daten ohne neue Quellenmetadaten werden nicht übernommen. Dashboard-Spot-Abruf jede Minute im bestehenden UI-Handelsfenster, Altersanzeige unabhängig alle 30 Sekunden. Der unabhängige Archivsammellauf bleibt alle fünf Minuten im konfigurierten Fenster.

Die Oberfläche unterscheidet **Daten abgerufen**, **VIX-Kurszeit (Berlin)**, Quelle, Kursalter und Verzögerung. Echtzeitstatus wird nicht durch das bloße Vorhandensein eines API-Schlüssels behauptet.

## Archiv und abschließender Test

Massive-Punkte werden getrennt als `source=massive`, `instrument=MASSIVE:I:VIX` gespeichert. Quell-/Empfangszeit, Berechtigung, Antwortgröße und Fehler bleiben erhalten. Ein fehlgeschlagener Massive-Abruf plus Yahoo-Fallback erscheint als zwei Abrufe, nicht als erfolgreicher Echtzeitabruf. CSV-Filter unterstützen beide Quellen getrennt.

Nach Hinterlegen des Zugangs: private API-/Collectorprobe durchführen, tatsächliche Berechtigung `REAL-TIME` und Quellzeit prüfen, erfolgreiche Archivierung kontrollieren. Keine Freischaltung allein nach Schlüsselpräsenz. Erst anschließend und nach separater Klärung des Open-End-/Rollverfahrens kann die Handelsüberwachung bewusst aktiviert werden.
