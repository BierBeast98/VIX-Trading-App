# Anmeldung

Die Website verwendet eine gemeinsame Sitzung für alle Bereiche. `AUTH_EMAIL` enthält die Anmelde-E-Mail; als Passwort dient der bestehende serverseitige `SIGNALS_ACCESS_KEY`. `AUTH_SESSION_SECRET` ist ein getrenntes zufälliges Geheimnis mit mindestens 32 Bytes und signiert die Sitzung. Keiner dieser Werte gehört ins Repository oder in den Chat.

Die Anmeldung setzt ein sieben Tage gültiges HttpOnly-/SameSite-Strict-Cookie; bei HTTPS ist es Secure. Bisherige Schlüssel-Cookies sind nach Umstellung ungültig. Der Zugangsschlüssel bleibt für das bestehende Scriptable-Widget als Bearer erhalten. Cron-Zugänge bleiben separat.

Die Datenbank begrenzt Login-Versuche global auf acht und Bearer-Anfragen auf 120 pro 15 Minuten; auch erfolgreiche Versuche zählen. Die Grenzen gelten über App-Prozesse hinweg, sind nicht an eine IP gebunden und können bei vielen Versuchen den legitimen Zugriff vorübergehend sperren. Ein Datenbankausfall blockiert diese Zugänge; separat authentifizierte Cron-Jobs bleiben unabhängig. Der gleiche Zugangsschlüssel dient als Passwort und API-Bearer: Die E-Mail ist kein zweiter Faktor.
