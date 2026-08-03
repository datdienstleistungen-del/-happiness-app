
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://happiness-eu.netlify.app/', { waitUntil: 'networkidle' });
  
  try {
    await page.waitForTimeout(3000); 
  } catch (e) {
  }

  await page.screenshot({ path: 'C:/Users/Suwan/.gemini/antigravity/brain/971c73d2-9238-4990-b0a9-ca186d6e4c44/scratch/live_coach_final.png', fullPage: true });
  await browser.close();
  console.log('Screenshot saved');
})();

