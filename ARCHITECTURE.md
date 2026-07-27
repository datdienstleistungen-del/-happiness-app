# Architekturentscheidungen & Grundprinzipien für H.I.T.

Dieses Dokument hält die architektonischen Leitlinien und Lizenzvorgaben für die Entwicklung des H.I.T. Studios fest. Alle zukünftigen Features müssen sich an diesen Prinzipien orientieren.

---

## 🛡️ Das Kernprinzip: Schutz vor Kostenfallen & Lizenzkonformität

Ein nachhaltiges System darf weder rechtliche Risiken für die Nutzer (Urheberrechtsverletzungen) noch unvorhersehbare finanzielle Belastungen für die Plattform (API-Kostenfallen) erzeugen.

### 1. Lizenzrechtlicher Preflight (Kostenlos ≠ Kommerziell nutzbar)
* **Vorgabe:** APIs oder Bibliotheken dürfen nur integriert werden, wenn deren Nutzungsbedingungen die kommerzielle Nutzung (Monetarisierung von Social-Media-Kanälen durch Endnutzer) explizit und ohne Einschränkungen (wie z. B. Attributionspflichten) erlauben.
* **Beispiel:** *ElevenLabs Free* ist für den Produktivbetrieb ausgeschlossen, da es kommerzielle Nutzung verbietet. *Groq API* (gemäß Services Agreement) ist freigegeben.

### 2. Proaktive Kontingent-Logik (Quota Management)
* **Vorgabe:** Jeder externe API-Dienst, der auf einem Credit-System basiert oder nutzungsbasierte Kosten verursacht, muss im H.I.T.-Backend durch eine **Account-bezogene Obergrenze (Quota)** abgesichert sein.
* **Beispiel:** Nutzer erhalten standardmäßig z. B. *„3 Foto-Animationen pro Monat gratis“*. Nach Erreichen des Limits greift eine sanfte Sperre in der UI. So wird verhindert, dass einzelne Power-User das Plattform-Kontingent leeren.

### 3. Ausfallsichere Fallback-Ketten (Graceful Degradation)
* **Vorgabe:** Schlägt eine API fehl oder ist das Kontingent erschöpft, darf das System nicht abstürzen, sondern muss auf eine kostenlose/lokale Alternative wechseln.
* **Beispiel:** Fällt eine Bild-KI aus, greift das System auf eine kuratierte Sammlung lokaler Platzhalter-Grafiken zurück.

### 4. Ehrliche UI-Kommunikation
* **Vorgabe:** Technische Einschränkungen, die sich aus der Gratis-Nutzung ergeben (z. B. fehlender deutscher Support bei Groq TTS), werden nicht versteckt, sondern dem Nutzer in der UI transparent erklärt (*„Groq-Stimmen aktuell nur für Englisch optimiert. Für Deutsch empfehlen wir das CapCut-interne Text-to-Speech.“*).

---

## 📊 Detaillierte Evaluierung der H.I.T. Komponenten

### A. B-Roll Footage (Pexels, Pixabay, Mixkit)
* **Status:** **✅ Freigegeben (Lizenz: CC0 / Eigene freie Lizenzen)**
* **Detailprüfung:** Alle eingebundenen Video-Quellen erlauben die kommerzielle Nutzung ohne zwingende Namensnennung.
* **Maßnahme:** Direktabruf erfolgt serverseitig, um API-Keys vor Client-Leaks zu schützen.

### B. Voiceover (Groq TTS)
* **Status:** **✅ Freigegeben (Lizenz: Groq Services Agreement & Apache 2.0)**
* **Detailprüfung:** Groqs Cloud Services Agreement gewährt Kunden explizit das Recht, die API-Dienste in eigene Applikationen einzubinden und diese kommerziell an Endnutzer bereitzustellen. Die genutzten Open-Source-Modelle (wie Canopy Labs Orpheus) sind unter der **Apache License 2.0** lizenziert, was die kommerzielle Nutzung der generierten Audiodaten uneingeschränkt erlaubt.
* **Einschränkung:** Aktuell primär für Englisch und Arabisch optimiert.
* **Maßnahme:** In der UI wird bei deutschen Projekten aktiv auf das CapCut-interne Text-to-Speech als beste Gratis-Alternative hingewiesen.

### C. Voiceover Premium (ElevenLabs)
* **Status:** **❌ Gesperrt im Produktivbetrieb (Lizenz: ElevenLabs Free-Tier)**
* **Detailprüfung:** Der kostenlose Tarif untersagt die kommerzielle Nutzung und verlangt eine sichtbare Namensnennung (Attribution).
* **Maßnahme:** ElevenLabs wird serverseitig in der Produktion blockiert und ist nur in der lokalen Entwicklungsumgebung (`isLocalDev === true`) für interne Tests zugelassen.

### D. Foto-Animator (AKOOL / JoyPix / DreamFace)
* **Status:** **🟡 Eingeschränkt (Gegatete API & Kostenrisiko)**
* **Detailprüfung:** 
  1. *Lizenz:* Beide Plattformen erlauben die kommerzielle Verwertung der Ergebnisse, sofern man einen kostenpflichtigen Plan besitzt.
  2. *API-Zugang:* Der programmatische API-Zugang ist bei AKOOL standardmäßig an teure Developer-Pläne (z. B. Pro Max) gebunden. Kostenlose Test-Credits sind meist nur über das Web-UI, nicht über die API nutzbar.
* **Maßnahme (Dual-Path-Architektur):**
  * *Default-Pfad (Entwickler/Free):* Ein lokaler Mockup-Simulator liefert bei fehlendem API-Schlüssel eine Auswahl von 5 vorgefertigten, lustigen, singenden Tier-Videos als Anschauungsmaterial.
  * *Produktiv-Pfad (Plattform):* API-Aufrufe an AKOOL werden nur initiiert, wenn ein kostenpflichtiger API-Key in den Netlify-Umgebungsvariablen hinterlegt ist. Jeder Aufruf wird durch ein hartes monatliches User-Kontingent (max. 3 Generierungen pro Account) gedeckelt.

### E. Hintergrundmusik (Creative Commons / KI-Musik)
* **Status:** **🟡 Eingeschränkt (Lizenz-Mischmasch)**
* **Detailprüfung:** Creative-Commons-Lizenzen sind nicht einheitlich. CC0 is unbedenklich, CC-BY verlangt Namensnennung, CC-NC verbietet kommerzielle Nutzung.
* **Maßnahme (Automatisierte Filterung):**
  1. *CC-NC (Non-Commercial):* Wird im System komplett gefiltert und blockiert, um Urheberrechtsstrafen für monetarisierte User-Accounts auszuschließen.
  2. *CC0 (Public Domain):* Wird uneingeschränkt und ohne Maßnahmen zur Verfügung gestellt.
  3. *CC-BY (Attribution Required):* Wird im System zugelassen, aber H.I.T. **generiert automatisch den korrekten Attributions-Text** (z. B. *„Musik: [Titel] von [Künstler] (CC-BY 4.0)“*) und hängt ihn direkt an das herunterladbare Skript-Asset an, damit der Nutzer diesen einfach in seine Videobeschreibung kopieren kann.
