# Happiness App

Social-Community-Plattform für Glück, Vernetzung und persönliche Entwicklung.

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Supabase (Auth + Datenbank)
- **Deployment:** Netlify

## Setup

### 1. Supabase

1. Erstelle ein Konto auf [supabase.com](https://supabase.com)
2. Erstelle ein neues Projekt
3. Öffne den SQL Editor und führe den Inhalt von `supabase-schema.sql` aus
4. Kopiere deine **Project URL** und **anon key** aus den Supabase Settings

### 2. Umgebungsvariablen

Erstelle eine `.env` Datei im Projektroot:

```
VITE_SUPABASE_URL=https://dein-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=dein-anon-key
```

### 3. Installieren & Starten

```bash
npm install
npm run dev
```

### 4. Deploy auf Netlify

1. Push das Repo auf GitHub
2. Verbinde es mit [Netlify](https://netlify.com)
3. Setze die Umgebungsvariablen in den Netlify Settings
4. Build-Befehl: `npm run build`
5. Publish-Verzeichnis: `dist`

## Admin-Rechte

Um Admin-Rechte zu erhalten, ändere in der Supabase Datenbank den `role` Wert deines Profils auf `admin`:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'deine-email@example.com';
```
