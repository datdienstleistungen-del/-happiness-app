
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://happiness-eu.netlify.app/coach', { waitUntil: 'networkidle' });
  
  try {
    // Wait for the input field to be visible
    await page.waitForSelector('input[type=	ext]', { timeout: 10000 });
  } catch (e) {
    console.log('No input field found');
  }

  await page.screenshot({ path: 'C:/Users/Suwan/.gemini/antigravity/brain/971c73d2-9238-4990-b0a9-ca186d6e4c44/scratch/live_coach2.png' });
  await browser.close();
  console.log('Screenshot saved');
})();

