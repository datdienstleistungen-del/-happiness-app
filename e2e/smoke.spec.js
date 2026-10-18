import { test, expect } from '@playwright/test'

// Smoke-Tests gegen die Live-Seite (https://nexus-hit.netlify.app).
// Angepasst an die NeXus-Revenue-OS-UI (Abgeschotteter Zustand / Route-Guards aktiv).

test.describe('NeXus Landing & Core Pages (Smoke)', () => {

  test('root page leitet anonyme Nutzer zu /login um', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Einloggen' }).first()).toBeVisible()
  })

  test('login page rendert', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Einloggen' }).first()).toBeVisible()
  })

  test('register route leitet geschuetzt auf /login um (Registrierung deaktiviert)', async ({ page }) => {
    await page.goto('/register')
    await expect(page).toHaveURL(/\/login/)
  })

  test('marketplace route leitet geschuetzt auf /login um', async ({ page }) => {
    await page.goto('/marketplace')
    await expect(page).toHaveURL(/\/login/)
  })

  test('community route leitet geschuetzt auf /login um', async ({ page }) => {
    await page.goto('/community')
    await expect(page).toHaveURL(/\/login/)
  })

  test('legal pages laden (Impressum + Datenschutz)', async ({ page }) => {
    await page.goto('/impressum')
    await expect(page.locator('text=Impressum').first()).toBeVisible()

    await page.goto('/datenschutz')
    await expect(page.locator('text=Datenschutz').first()).toBeVisible()
  })

  test('geschuetzte Route leitet anonyme Nutzer zu /login um', async ({ page }) => {
    await page.goto('/nexus/dashboard')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
  })

  test('unbekannte Route leitet geschuetzt auf /login um', async ({ page }) => {
    await page.goto('/diese-seite-gibt-es-nicht')
    await expect(page).toHaveURL(/\/login/)
  })

})
