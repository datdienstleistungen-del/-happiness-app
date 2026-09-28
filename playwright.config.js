import { defineConfig } from '@playwright/test'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Lokale Env laden (CI setzt die Werte stattdessen ueber Secrets/Env der Runner).
// Werte, die schon gesetzt sind, bleiben unangetastet.
const envPath = join(dirname(fileURLToPath(import.meta.url)), '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  use: {
    baseURL: process.env.E2E_SITE_URL || 'https://nexus-hit.netlify.app',
    headless: true,
    screenshot: 'only-on-failure',
    // Die Seite waehlt die Sprache ueber navigator.language (translations.jsx) -
    // ohne fixen Locale laufen die Tests je nach Runner-Default englisch.
    locale: 'de-DE',
  },
  projects: [
    // API-/Sicherheits-Specs brauchen keinen Browser (nur fetch)
    { name: 'api', testMatch: /api-.*\.spec\.js/ },
    // UI-Smoke-Tests gegen die Live-Seite
    { name: 'chromium', testMatch: /smoke\.spec\.js/, use: { browserName: 'chromium' } },
  ],
})
