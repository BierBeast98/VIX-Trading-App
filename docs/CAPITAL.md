# Kapital und Trade-Auswertungen

Die manuelle Signalstrategie hat eine eigene datierte Kapitalbasis: **1.500 EUR ab 17.11.2026**. Die historischen Trades aus März–September 2026 bleiben erhalten und verändern diese neue Basis nicht. Der frühere manuell eingegebene Kontostand wurde im Reconciliation-Protokoll gesichert.

`VixCache.account_capital` enthält Startkapital, Stichtag und Herkunft. `/api/account-capital` liest die bestätigten Ausführungen aus `manual_strategy_v1` ab diesem Stichtag:

- Verfügbar = Startkapital − tatsächliche Kaufkosten einschließlich Gebühren + Verkaufserlöse abzüglich Gebühren.
- Gebunden = verbleibende Anschaffungskosten der offenen Signal-Lots einschließlich zugeordneter Kaufgebühren.
- Strategiekapital zum Buchwert = verfügbar + gebunden. Offene Kursgewinne/-verluste sind darin nicht enthalten.
- Realisierter G/V = Strategiekapital zum Buchwert − Startkapital. Verkäufe und Teilverkäufe verwenden die tatsächliche Kostenaufteilung des Signalbestands. Gebühren werden genau einmal berücksichtigt.

Es gibt keine automatische Verrechnung historischer Gewinne mit dem neuen Budget und keine Hochrechnung der Einzelrenditen auf eine Depot-/Jahresrendite. Ein-/Auszahlungen oder eine spätere Änderung der Kapitalbasis benötigen eine explizite Abstimmung; die frühere freie Überschreibung des Kontostands ist deaktiviert.

Historische Renditen werden aus tatsächlichen Ein-/Ausstiegskursen abgeleitet, soweit vorhanden. Ein bereits als Short gekauftes Zertifikat profitiert ebenfalls von einem steigenden **Zertifikatskurs**; dessen Rendite wird nicht nochmals invertiert. Euro-Ergebnisse historischer Trades sind brutto, weil Gebühren dort nicht verlässlich strukturiert vorliegen. Die neue Kapitalrechnung verwendet dagegen die bestätigten Ausführungsgebühren.

Widersprüchliche Datumsfolgen werden angezeigt und aus Kennzahlen ausgeschlossen. Der Trade `DE000VU4MAY5` hatte zunächst Einstieg 23.03.2026 und Ausstieg 09.03.2026. Der Nutzer hat den Verkauf ausdrücklich auf **09.04.2026** korrigiert. Diese Korrektur und die vorherigen Werte sind protokolliert; die Haltedauer beträgt 17 Tage. Der Trade wird wieder ausgewertet. Neue/aktualisierte Buchungen dürfen keinen Ausstieg vor dem Einstieg enthalten.

Die Bereinigung am 17.11.2026 hat fünf geschlossene Positionsanzeigen anhand ihrer jeweils einzigen verknüpften abgeschlossenen Trade-Buchung synchronisiert. Originalwerte und vorheriges Budget sind unter `VixCache.capital_reconciliation_20261117` protokolliert; keine Trades wurden gelöscht. Geschlossene Positionen ohne eindeutigen zugehörigen Ausführungsbeleg bleiben unverändert.

Die Oberfläche verweist für tatsächliche Ausführungen auf die Erfassung; ein Kurs-Cache gilt nicht als Verkaufsbeleg. Die alte Alert-Seite leitet zu `/signals` weiter. Die Handelsüberwachung bleibt pausiert.
