# Developer Mode

Markiert deinen eigenen Traffic als `internal` in GA4, damit er nicht die echten Nutzerdaten verfälscht.

## Aktivieren

### Über URL
```
https://happiness-eu.netlify.app/?developer=true
```

### Über Konsole
```js
enableDeveloperMode()
```

### Über localStorage
```js
localStorage.setItem('developer_mode', 'true')
```

## Deaktivieren

### Über URL
```
https://happiness-eu.netlify.app/?developer=false
```

### Über Konsole
```js
disableDeveloperMode()
```

## Prüfen
```js
isDeveloperMode()  // true oder false
```

## Was passiert

Wenn Developer Mode aktiv ist:
- GA4 bekommt `traffic_type: 'internal'`
- GA4 bekommt `debug_mode: true`
- Die Konsole zeigt "Developer Mode: ACTIVE"

## GA4 Filter einrichten

1. Verwaltung → Dateneinstellungen → Datenfilter
2. "Internal Traffic" Filter öffnen
3. Auf "Testing" stellen
4. Ein paar Tage testen
5. Auf "Active" stellen

## Funktionsweise

- Status wird in `localStorage` unter `developer_mode=true` gespeichert
- URL-Parameter `?developer=true/false` setzt/löscht den Status automatisch
- GA4-Config in `index.html` prüft den Status beim Laden
- `window.enableDeveloperMode()` und `window.disableDeveloperMode()` stehen in der Konsole zur Verfügung
