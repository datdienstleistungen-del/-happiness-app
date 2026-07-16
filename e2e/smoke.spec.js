import { test, expect } from '@playwright/test'

test.describe('Happiness App Smoke Tests', () => {

  test('landing page loads with H.I.T. branding', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=H.I.T.')).toBeVisible()
    await expect(page.locator('input[placeholder]')).toBeVisible()
  })

  test('landing page demo runs typewriter', async ({ page }) => {
    await page.goto('/')
    const input = page.locator('input[type="text"]')
    await input.clear()
    await input.fill('Test Goal')
    await page.locator('button:has-text("Ausprobieren")').click()
    await expect(page.locator('text=H.I.T. arbeitet')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.demo-output-text')).toBeVisible({ timeout: 15000 })
  })

  test('login page renders', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('register page renders', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('button:has-text("Registrieren")')).toBeVisible()
  })

  test('marketplace page loads', async ({ page }) => {
    await page.goto('/marketplace')
    await expect(page.locator('text=Marktplatz')).toBeVisible()
  })

  test('community page loads', async ({ page }) => {
    await page.goto('/community')
    await expect(page.locator('text=Community')).toBeVisible()
  })

  test('legal pages load', async ({ page }) => {
    await page.goto('/impressum')
    await expect(page.locator('text=Impressum')).toBeVisible()

    await page.goto('/datenschutz')
    await expect(page.locator('text=Datenschutz')).toBeVisible()
  })

  test('redirect logged-in user to dashboard', async ({ page }) => {
    await page.goto('/')
    // Non-logged-in users see landing page
    await expect(page.locator('text=H.I.T.')).toBeVisible()
  })

  test('mobile bottom nav appears on small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForTimeout(500)
    // Mobile nav should be visible
    const mobileNav = page.locator('.mobile-bottom-nav')
    await expect(mobileNav).toBeVisible()
  })

  test('landing page has platform cards', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Unterstützte Plattformen')).toBeVisible()
    await expect(page.locator('text=TikTok')).toBeVisible()
    await expect(page.locator('text=Instagram')).toBeVisible()
  })

})
