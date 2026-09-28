import { test, expect } from '@playwright/test'

// Regression zu Phase 1a (Migration 20260928_secure_profiles_rls.sql):
// Der Anon-Key duerfte OHNE Login keine profiles-Zeile mit Name/role/banned lesen,
// der Signup-Username-Check (id, username) muss aber weiter funktionieren.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

test.describe('Security: profiles RLS (Phase 1a)', () => {
  test.skip(!SUPABASE_URL || !ANON_KEY, 'VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY fehlen in der Env')

  const headers = () => ({ apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` })

  test('Anon kann profiles NICHT als ganze Zeilen lesen (select=*)', async ({ request }) => {
    const res = await request.get(`${SUPABASE_URL}/rest/v1/profiles?select=*&limit=1`, { headers: headers() })
    expect(res.status(), 'Anon select=* muss verweigert werden').toBe(401)
    const body = await res.text()
    expect(body).toContain('permission denied')
    // Keine Datenspalten im Fehlerfall
    expect(body).not.toContain('Harro Goerndt')
    expect(body).not.toContain('admin')
  })

  test('Anon darf weiterhin id+username lesen (Signup-Username-Check)', async ({ request }) => {
    const res = await request.get(`${SUPABASE_URL}/rest/v1/profiles?select=id,username&limit=1`, { headers: headers() })
    expect(res.status(), 'spaltenbeschraenkter SELECT muss erlaubt sein').toBe(200)
    const rows = await res.json()
    expect(Array.isArray(rows)).toBe(true)
    if (rows.length > 0) {
      expect(Object.keys(rows[0]).sort()).toEqual(['id', 'username'])
    }
  })

  test('Anon kann keine Spalten ausser id/username lesen (name blockiert)', async ({ request }) => {
    const res = await request.get(`${SUPABASE_URL}/rest/v1/profiles?select=id,name&limit=1`, { headers: headers() })
    expect(res.status(), 'name-Spalte muss fuer Anon gesperrt sein').toBe(401)
  })

  test('fremde nexus_*-Tabellen liefern fuer Anon keine Daten', async ({ request }) => {
    for (const table of ['nexus_offerings', 'nexus_radar_hits']) {
      const res = await request.get(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, { headers: headers() })
      // 200 mit leerem Array ist ok (RLS filtert), 401/403 auch - aber NIEMALS echte fremde IDs
      if (res.status() === 200) {
        const rows = await res.json()
        expect(rows.length, `${table} darf Anon keine Zeilen liefern`).toBe(0)
      } else {
        expect([401, 403]).toContain(res.status())
      }
    }
  })
})
