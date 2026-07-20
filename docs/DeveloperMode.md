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
- GA4 bekommt `user_properties.role = 'developer'`
- Event `developer_mode_enabled` wird getrackt
- Die Konsole zeigt "Developer Mode: ACTIVE"

## User Properties (immer)

Für **alle** Besucher werden gesetzt:
- `environment` → `localhost`, `preview`, oder `production` (basierend auf Hostname)
- `app_version` → `1.0.0`

Nur bei Developer Mode zusätzlich:
- `role` → `developer`

## Umgebungs-Erkennung

| Hostname | Environment |
|---|---|
| `localhost` | `localhost` |
| `*preview--*` | `preview` |
| Alles andere | `production` |

## GA4 Filter einrichten

1. Verwaltung → Datenstreams → Happiness Webstream → Tag-Einstellungen
2. "Internen Traffic definieren" öffnen
3. Regel erstellen: `traffic_type` = `internal`
4. Auf "Testing" stellen
5. Ein paar Tage testen
6. Auf "Active" stellen

## Funktionsweise

- Status wird in `localStorage` unter `developer_mode=true` gespeichert
- URL-Parameter `?developer=true/false` setzt/löscht den Status automatisch
- GA4-Config in `index.html` prüft den Status beim Laden
- `window.enableDeveloperMode()` und `window.disableDeveloperMode()` stehen in der Konsole zur Verfügung
