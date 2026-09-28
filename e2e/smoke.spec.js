import { test, expect } from '@playwright/test'

// Smoke-Tests gegen die Live-Seite (https://nexus-hit.netlify.app).
// Angepasst an die NeXus-Revenue-OS-UI (2026-09); die alte Happiness/H.I.T.-
// Spec pruefte Elemente, die es im Code nicht mehr gibt (mobile-bottom-nav,
// demo-output-text, platform cards).

test.describe('NeXus Landing & Core Pages (Smoke)', () => {

  test('landing page laedt mit NeXus-Branding', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/NeXus Revenue OS/)
    await expect(page.locator('h1').first()).toContainText('Sie geben Ihr Angebot ein')
  })

  test('landing page zeigt die primaeren CTAs', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Anmelden' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Kostenlos testen' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Live-Test' }).first()).toBeVisible()
  })

  test('login page rendert', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('register page rendert', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
    await expect(page.locator('button:has-text("Registrieren")').first()).toBeVisible()
  })

  test('marketplace page laedt', async ({ page }) => {
    await page.goto('/marketplace')
    await expect(page.locator('text=Marktplatz').first()).toBeVisible()
  })

  test('community page laedt', async ({ page }) => {
    await page.goto('/community')
    await expect(page.locator('text=Community').first()).toBeVisible()
  })

  test('legal pages laden (Impressum + Datenschutz)', async ({ page }) => {
    await page.goto('/impressum')
    await expect(page.locator('text=Impressum').first()).toBeVisible()
    await expect(page.locator('h1').first()).toBeVisible()

    await page.goto('/datenschutz')
    await expect(page.locator('text=Datenschutz').first()).toBeVisible()
  })

  test('geschuetzte Route leitet anonyme Nutzer zu /login um', async ({ page }) => {
    await page.goto('/nexus/dashboard')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
  })

  test('unbekannte Route faengt auf Landing-Seite', async ({ page }) => {
    await page.goto('/diese-seite-gibt-es-nicht')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('h1').first()).toBeVisible()
  })

})
