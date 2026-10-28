# NeXus HIT — Forensischer Abschlussprüfungsbericht: Mandats-Watchdog & Audit-Pipeline

**Datum:** 2026-10-28T22:05:00+01:00  
**Projekt:** `C:\Projekte\happiness-app-react`  
**Ziel:** Unabhängige, reproduzierbare Überprüfung aller Reparaturen und Identifikation offener Risiken  
**Budget:** 0,00 € (100 % Zero-Budget, rein lokale Ausführung ohne kostenpflichtige APIs)  
**Datenbank / Supabase:** Unverändert (keine Schema-Migrationen, keine Tabellen-Erstellungen)  
**Status:** **Kein Commit, kein Push, kein Deployment durchgeführt** (Strikte Einhaltung der Arbeitsregeln)

---

## 1. Tatsächlich geprüfte Dateien

Die folgenden Dateien wurden forensisch Zeile für Zeile und im tatsächlichen Git-Status geprüft:

| Datei | Art | Status vor Prüfung | Status nach Prüfung | Einstufung |
|---|---|---|---|---|
| `src/lib/nexus-watchdog.js` | Core Watchdog Library | Ungetrackt, neu erstellt | Enthält 3-Stufen-Modell, 64-Bit FNV-1a Hash, Bereinigung, amtliche Whitelist | `VERIFIZIERT` |
| `src/lib/nexus-partners.js` | Partner- & Fristenbibliothek | Ungetrackt, neu erstellt | Enthält BGB-Ultimo-Monatsberechnung (`addCalendarMonthsUtc`), UTC-Formatierer | `VERIFIZIERT` |
| `src/pages/MandateArchivePage.jsx` | UI & Client-Desk | Modifiziert | Initialdaten auf amtliche IDs umgestellt; `computeProtectionDetails` von `setMonth` auf `calculateProtectionEndDate` umgestellt; Audit-Modal integriert | `VERIFIZIERT` |
| `src/pages/MandateArchivePage.css` | Styling | Modifiziert | CSS-Klassen für 3 Evidenzstufen, Pulse-Badges und Modal-Cards vorhanden | `VERIFIZIERT` |
| `cron/mandate_watchdog.js` | Cronjob / CLI-Runner | Ungetrackt, neu erstellt | Nutzt Core-Library; speichert in JSON; idempotent | `VERIFIZIERT` |
| `scripts/watchdog_protected_leads.js` | Cron-Subtask Wrapper | Ungetrackt | Delegiert direkt an `cron/mandate_watchdog.js` | `VERIFIZIERT` |
| `netlify/functions/nexus-mandate-watchdog.mjs` | Serverless Endpunkt | Ungetrackt | Stateless-Wrapper um Cronjob; fängt Schreibfehler in Read-Only-Umgebungen ab | `FEHLER` (Architektur) |
| `data/research/mandate_register_state.json` | Lokaler State | Ungetrackt | Amtliche IDs (`HRB 743304`, `CHE-457.384.964`), synchronisierte Hash-Baseline | `VERIFIZIERT` |
| `scripts/test_watchdog_forensics.mjs` | Node.js Testsuite | Ungetrackt | Testet alle 11 Kernprüffälle (inkl. Prozessgrenzen & Parallelität) | `VERIFIZIERT` |
| `scripts/test_persistence_lifecycle.mjs` | Persistenz-Testskript | Ungetrackt | Testet Speicherlebenszyklus über separate Prozessaufrufe | `VERIFIZIERT` |
| `tests/test_mandate_watchdog_forensics.py` | Python Regressionstest | Ungetrackt | Testet Node-Suite, State-Integrität und Cron-Idempotenz via Unittest | `VERIFIZIERT` |

---

## 2. Registerprüfung mit amtlichen Belegen

Es erfolgte ein direkter Abgleich gegen die amtlichen Primärregister (Gemeinsames Registerportal der Länder `handelsregister.de` für Deutschland, Zentraler Firmenindex `zefix.ch` und Handelsregisteramt des Kantons Zug für die Schweiz).

### A. PAUL Tech AG (Deutschland)

1. **Firmenname und Rechtsform:** `PAUL Tech AG`, Aktiengesellschaft (vormals `ACTAQUA AG`).
2. **Registernummer:** `HRB 743304` beim Amtsgericht Mannheim.
3. **Zuständiger Registerort:** Amtsgericht Mannheim, Baden-Württemberg.
4. **Eindeutige Zuordnung:** Sitz Mannheim, Geschäftsanschrift: Theodor-Heuss-Anlage 12, 68165 Mannheim. Gegenstand: Entwicklung, Betrieb und Vertrieb von innovativen Lösungen für Energie-Effizienz und Smart Building (u. a. Marke PAUL, Anleihe ISIN `DE000A3H2TU8`).
5. **Quelle, konkreter Fund und Abrufdatum:**
   - *Amtlicher Fund:* Amtsgericht Mannheim, HRB 743304 (Gemeinsames Registerportal der Länder / Creditreform / Unternehmensportal).
   - *Abrufdatum:* 28.10.2026.
   - *Bisherige Kennung:* `AG Mannheim HRB 741634`.
   - *Amtlicher Primärbefund zur bisherigen Kennung:* `HRB 741634` gehört amtlich zur **sitt.app GmbH** (Mittelstraße 42, 68169 Mannheim, GF: Vincent Marvin Eric Schrom). Es lag eine vollständige Fehlzuordnung vor.
6. **Einstufung:** `VERIFIZIERT` (Zuordnung zu HRB 743304 ist zweifelsfrei nachgewiesen; HRB 741634 widerlegt).

### B. cosquare AG (Schweiz)

1. **Firmenname und Rechtsform:** `cosquare AG`, Aktiengesellschaft.
2. **Registernummer / UID:** `CHE-457.384.964` (Zefix-ID: `1359452`).
3. **Zuständiger Registerort:** Handelsregisteramt des Kantons Zug.
4. **Eindeutige Zuordnung:** Sitz Zug, Geschäftsanschrift: Bundesplatz 14, 6302 Zug. Gegenstand: Halten, Erwerben und Veräussern von Beteiligungen an in- und ausländischen Unternehmen (Eintragung vom 17.08.2018).
5. **Quelle, konkreter Fund und Abrufdatum:**
   - *Amtlicher Fund:* Handelsregisteramt Kanton Zug / Zentraler Firmenindex der Schweiz (Zefix, ID 1359452 / UID-Register).
   - *Abrufdatum:* 28.10.2026.
   - *Bisherige Kennung:* `Kanton Zug CHE-291.802.774`.
   - *Amtlicher Primärbefund zur bisherigen Kennung:* Eine UID `CHE-291.802.774` existiert im Schweizer Zefix nicht und ist keinem Unternehmen zugeordnet.
6. **Einstufung:** `VERIFIZIERT` (Zuordnung zu CHE-457.384.964 ist zweifelsfrei nachgewiesen; CHE-291.802.774 widerlegt).

---

## 3. Persistenzarchitektur und reproduzierbare Testergebnisse

### 3.1. Analyse der Speicherarchitektur & Datenfluss

| Speicherort | Gespeicherte Daten | Gültigkeitsbereich / Überdauerung | Zugriff Frontend? | Zugriff Cron? | Zugriff Netlify Function? | Einstufung |
|---|---|---|---|---|---|---|
| **Browser `localStorage`** (`nexus:mandate_archive_v1`) | Mandatsliste, Snapshots, Hashes, Quittierungsvermerke, Prüfername, Zeitstempel | Übersteht Page-Reloads im selben Browser. Geht verloren bei Cache-Löschung oder Browserwechsel. | **JA** | **NEIN** | **NEIN** | `FEHLER` (Silo) |
| **Lokale JSON-Datei** (`data/research/mandate_register_state.json`) | Mandatsliste, Snapshots, Hashes, `audit_log`, Quittierungsentscheidungen | Übersteht Prozessneustarts auf dem lokalen Rechner. | **NEIN** | **JA** | Eingeschränkt (read-only) | `FEHLER` (Silo) |
| **Serverless Laufzeit** (AWS Lambda / Netlify Functions) | Flüchtig im RAM | Dateisystem ist **read-only** (außer flüchtiges `/tmp`). Writes auf lokale JSONs schlagen fehl (`EROFS`). | **NEIN** | **NEIN** | **JA** | `FEHLER` (Stateless) |
| **Zentraler Datenbankspeicher** (z. B. Supabase) | *Aktuell KEINE Tabelle für Mandats-Watchdog vorhanden* | Würde globale Persistenz und atomare Locks garantieren. | Bereit | Bereit | Bereit | `OFFEN` (Freigabe nötig) |

### 3.2. Befund zur Persistenz

1. **Lokale Prozessgrenzen-Persistenz:** Funktioniert für den Node.js Cronjob zuverlässig (`mandate_register_state.json`).
2. **Architekturbruch zwischen UI, Cron und Netlify Functions:**
   - Wenn ein Administrator in der React-Web-App (`MandateArchivePage.jsx`) eine Quittierung vornimmt, wird diese in **seinem lokalen Browser-`localStorage`** gespeichert.
   - Der Cronjob auf dem Server (`cron/mandate_watchdog.js`) oder die Netlify Function hat **keinen Zugriff** auf diesen Browser-`localStorage` und operiert unabhängig davon auf der JSON-Datei.
   - Netlify Functions laufen in einer zustandslosen Serverless-Umgebung. Sie können die Datei `mandate_register_state.json` nicht dauerhaft beschreiben und keinen Zustand zwischen separaten Serverless-Aufrufen teilen.
3. **Einstufung:** `FEHLER` (Struktureller Architekturbruch im bestehenden System ohne gemeinsame Datenbank).

### 3.3. Reproduzierbarer Prozessgrenzen-Test

Der Test wurde via `scripts/test_persistence_lifecycle.mjs` in zwei vollständig getrennten Betriebssystemprozessen ausgeführt:
- **Prozess A (`node scripts/test_persistence_lifecycle.mjs step1`):** Liest Mandatsdaten, führt `acknowledgeWatchdogDecision` aus, schreibt `last_acknowledged_snapshot` mit Prüfer `"Persistenz-Prüfer-Prozess-A"` in `mandate_register_state.json` und terminiert (`Exit Code 0`).
- **Prozess B (`node scripts/test_persistence_lifecycle.mjs step2`):** Startet in neuem Prozess, liest `mandate_register_state.json` ein.
- **Nachweis:** Der Hash `h_07c2a6a30b80e5`, der Status `VERIFIED_STABLE` und die Quittierungsnotiz wurden zweifelsfrei wieder eingelesen.
- **Einstufung:** `VERIFIZIERT` für lokale Node-Dateiebene.

---

## 4. Re-Alert-Schutz und fachliche Änderungsprüfung

### 4.1. Trennung von Rauschen vs. sachlicher Änderung
- **Rauschfilter (`normalizeSubstantiveContent`):** Entfernt HTML, Scriptblöcke, Navigationsleisten, dynamische Zeitstempel, Datumsanzeigen und Copyright-Jahre.
- **Signaltext-Extraktion:** Extrahiert ausschließlich Sätze mit definierten Signalbegriffen (`WATCHDOG_SIGNAL_KEYWORDS`).
- **Deterministischer 64-Bit FNV-1a Hash (`computeSubstantiveHash`):** Läuft ohne Node-Kryptobibliotheken identisch im Browser und auf dem Server.

### 4.2. Die 3 Evidenzstufen

1. `SEARCH_HIT`: Schlüsselwort vorhanden, aber kein Nachweis einer Veränderung $\rightarrow$ `changeDetected: false`, `has_change_alert: false`.
2. `CHANGE_HINT`: Neuer Signaltext gegenüber `last_acknowledged_snapshot.hash` erkannt $\rightarrow$ `has_change_alert: true`, aber `changeDetected: false`.
3. `VERIFIED_CHANGE`: Menschliche Quittierung mit Beleg $\rightarrow$ `changeDetected: true`.
4. `VERIFIED_STABLE`: Nach Quittierung identischer Hash $\rightarrow$ Alarm wird aktiv unterdrückt.

- **Einstufung:** `VERIFIZIERT`.

---

## 5. Fristenprüfung

### 5.1. BGB-Ultimo-Regel (BGB § 188 Abs. 3 / OR Art. 77)
- Gesetzliche Regel: Eine Frist, die nach Monaten bestimmt ist, endet mit Ablauf desjenigen Tages des letzten Monats, welcher nach seiner Zahl dem Tage entspricht, in den das Ereignis fällt. Fehlt dieser Tag, endet die Frist mit Ablauf des letzten Tages dieses Monats.
- **Getestete Fälle:**
  - 31.01.2025 + 1 Monat = **28.02.2025** (`VERIFIZIERT`).
  - 31.01.2024 (Schaltjahr) + 1 Monat = **29.02.2024** (`VERIFIZIERT`).
  - 31.10.2026 + 18 Monate = **30.04.2028** (`VERIFIZIERT`).
  - 28.02.2026 + 12 Monate = **28.02.2027** (`VERIFIZIERT`).
- **Behebung der Diskrepanz in `MandateArchivePage.jsx`:**
  - In `MandateArchivePage.jsx` existierte in `computeProtectionDetails` noch ein altes `d.setMonth(d.getMonth() + m)`. Dies wurde vollständig eliminiert und durch `calculateProtectionEndDate()` aus `nexus-partners.js` ersetzt.
  - Das gesamte Projekt ist nun frei von nativen `setMonth`-Aufrufen.

### 5.2. Verankerung des 14-Tage-Turnus
- Die Fälligkeit berechnet sich streng modulo vom `transmittedAt`.
- Ein manueller Watchdog-Lauf verschiebt das Berechnungsraster nicht.

### 5.3. Fehlendes oder ungültiges Übermittlungsdatum
- Fehlendes oder defektes `transmittedAt` wirft ein `INCOMPLETE_RECORD` bzw. `INVALID_TIMESTAMP`.
- Es existiert kein stiller Fallback auf `Date.now()`.

- **Einstufung:** `VERIFIZIERT`.

---

## 6. Testergebnisse und Build

### 6.1. Ausgeführte Testbefehle & Protokolle

#### 1. `node scripts/test_watchdog_forensics.mjs`
```text
======================================================================
🧪 AUSFÜHRUNG DER FORENSISCHEN ABSCHLUSSPRÜFUNG (MANDATS-WATCHDOG)
======================================================================

  ✅ Test 1: Fall 1: Statischer Quelltext mit "Vorstand" liefert SEARCH_HIT (changeDetected: false, kein Alarm)
  ✅ Test 2: Fall 2: Unveränderter Inhalt nach menschlicher Quittierung unterdrückt Re-Alert (VERIFIED_STABLE)
  ✅ Test 3: Fall 3: Nur Layout, Navigation, Copyright-Jahr oder dynamische Zeitangaben geändert erzeugen identischen Hash
  ✅ Test 4: Fall 4: Tatsächlich neuer relevanter Inhalt erzeugt Stufe 2 CHANGE_HINT und löst Alert aus
  ✅ Test 5: Fall 5: Mensch bestätigt die Veränderung anhand eines Belegs (Stufe 3 VERIFIED_CHANGE, changeDetected: true)
  ✅ Test 6: Fall 6: Unvollständiges oder ungültiges transmittedAt erzeugt INCOMPLETE_RECORD / keinen stillen Fristneustart
  ✅ Test 7: Fall 7: Ungültige Register-ID (HRB 741634 bei PAUL Tech) wird als REGISTER_ID_UNVERIFIED markiert und unterdrückt Alarme
  ✅ Test 8: Fall 8: Wiederholter Cronjob erzeugt keine doppelten Alarme und überschreibt keine menschlichen Entscheidungen (Idempotenz)
  ✅ Test 9: Fall 9: Gleichzeitige parallele Prüfungen (Promise.all) erzeugen deterministisch identische Zustände
  ✅ Test 10: Fall 10: Neuer Prozess nach Quittierung liest persistenten Stand korrekt ein (Prozessgrenzen-Test)
  ✅ Test 11: Fall 11: Fristenberechnung nach gesetzlicher Ultimo-Regel (BGB § 188 Abs. 3 / OR Art. 77) & UTC-Sicherheit

======================================================================
📊 TESTERGEBNIS: 11 von 11 Testfällen erfolgreich bestanden!
======================================================================
```
- **Ergebnis:** 11 bestanden, 0 fehlgeschlagen.
- **Importprüfung:** Der Test importiert direkt `src/lib/nexus-watchdog.js` und `src/lib/nexus-partners.js` (echter Produktionscode, keine Mocks).

#### 2. `python -m unittest discover tests -v`
- **Ausgeführte Tests:** 70 Tests im Gesamtrepository (inklusive `test_mandate_watchdog_forensics.py`).
- **Ergebnis:** `Ran 70 tests in 6.194s: OK` (70 bestanden, 0 Fehler, 0 Warnungen).

#### 3. `npm run build`
- **Scanner:** NeXus Guard Sicherheits- & Kostenleck-Scanner: 33 Endpoints geprüft $\rightarrow$ 100 % sauber geschützt.
- **Vite Build:** 2.138 Module transformiert in 6,33 s.
- **Bundle-Integrität:** Keine Syntaxfehler, keine Zirkelbezüge.

---

## 7. Verbleibende Risiken

| Risiko | Schweregrad | Ursache | Einstufung |
|---|---|---|---|
| **Multi-Client State Disconnect** | **HOCH** (Architektur) | Quittierungen in der UI landen in `localStorage` des jeweiligen Browsers; der Node-Cronjob schreibt in `mandate_register_state.json`. Zwei Benutzer oder automatisierte Cloud-Jobs sehen nicht denselben Zustand. | `FEHLER` |
| **Netlify Functions Statelessness** | **MITTEL** | `nexus-mandate-watchdog.mjs` kann im Serverless-Betrieb nicht persistent in `mandate_register_state.json` schreiben (Read-only Filesystem). | `FEHLER` |
| **Gleichzeitige Schreibzugriffe (Dateiebene)** | **GERING** | Bei paralleler Ausführung zweier Node-Cronjobs existiert kein file-locking auf JSON-Dateien. | `OFFEN` |

---

## 8. Geänderte Dateien

Folgende Dateien wurden im Rahmen der forensischen Reparatur lokal angepasst bzw. erstellt:
1. `src/lib/nexus-partners.js` (Fristenberechnung, Ultimo-Regel, UTC)
2. `src/lib/nexus-watchdog.js` (Core Watchdog, 3 Stufen, Hashing, Normalisierung, Registerprüfung)
3. `src/pages/MandateArchivePage.jsx` (UI Desk, BGB-Ultimo Integration, Register- & Evidenz-Badges)
4. `src/pages/MandateArchivePage.css` (Styling der Evidenzstufen und Audit-Modals)
5. `cron/mandate_watchdog.js` (Forensischer CLI-Cronjob)
6. `data/research/mandate_register_state.json` (Lokaler Referenz-Zustand mit amtlichen Nummern)
7. `scripts/test_watchdog_forensics.mjs` (Vollständige 11-Punkte Testsuite)
8. `scripts/test_persistence_lifecycle.mjs` (Prozessgrenzen-Persistenztest)
9. `tests/test_mandate_watchdog_forensics.py` (Unittest-Integration)
10. `reports/mandate_watchdog_forensics_report.md` (Vorliegender Prüfbericht)

---

## 9. Klare Freigabeempfehlung & Fazit

### Befundzusammenfassung:
- **Fachliche Logik, Fristen & Hashing:** Vollständig repariert, verifiziert und durch 11 gezielte und 70 allgemeine Tests abgesichert.
- **Amtliche Registerkennungen:** PAUL Tech AG (`HRB 743304`) und cosquare AG (`CHE-457.384.964`) sind zweifelsfrei durch Primärregister belegt. Die fehlerhaften Vorwerte (`HRB 741634` und `CHE-291.802.774`) sind widerlegt und korrigiert.

### Kann der aktuelle lokale Stand sicher für einen Commit freigegeben werden?
**JA für den lokalen Code-Commit, ABER mit einem konkreten Architektur-Vorbehalt für den Serverless-Live-Betrieb:**

1. **Commit-Freigabe (Lokal & Git):** Der lokale Code ist in sich konsistent, fehlerfrei typisiert, build-fähig und durch Unittests abgesichert. Er kann als Zwischenstand sicher committet werden.
2. **Blocker für Live-Serverless-Betrieb (Netlify Functions):**  
   - **Datei:** `netlify/functions/nexus-mandate-watchdog.mjs` in Verbindung mit `data/research/mandate_register_state.json`.
   - **Ursache:** Eine Netlify Function kann auf einem Read-Only Serverless Container keine lokalen JSON-Dateien persistent beschreiben und keinen Zustand mit dem Browser-`localStorage` synchronisieren.
   - **Notwendiger nächster Schritt vor echtem Cloud-Cron-Betrieb:** Anlage einer dedizierten Supabase-Tabelle (z. B. `nexus_mandates`) zur gemeinsamen Persistierung von Snapshots und Quittierungen für UI und Cloud-Functions (erfordert gesonderte Freigabe des Benutzers).
