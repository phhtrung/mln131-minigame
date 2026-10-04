const { chromium } = require('C:/Users/seu/AppData/Roaming/npm/node_modules/pingfusi/packages/motion/node_modules/playwright-core');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1728, height: 982 } });
  await page.goto(process.argv[2] || 'https://watson.la/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  const changes = await page.evaluate(() => new Promise((resolve) => {
    const images = [...document.querySelectorAll('#home-main-i-0 img, #home-main-i-1 img')];
    const start = performance.now();
    let previous = '';
    const rows = [];
    const timer = setInterval(() => {
      const opacity = images.map((image) => Number(getComputedStyle(image).opacity).toFixed(2));
      const state = opacity.join(',');
      if (state !== previous) {
        rows.push({ ms: Math.round(performance.now() - start), opacity });
        previous = state;
      }
      if (performance.now() - start > 6000) {
        clearInterval(timer);
        resolve(rows);
      }
    }, 50);
  }));
  fs.writeFileSync(`targets/watson/ref-motion/${process.argv[3] || 'carousel'}.json`, JSON.stringify(changes, null, 2));
  console.log(JSON.stringify(changes, null, 2));
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
