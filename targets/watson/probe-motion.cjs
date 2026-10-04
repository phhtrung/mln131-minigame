const { chromium } = require('C:/Users/seu/AppData/Roaming/npm/node_modules/pingfusi/packages/motion/node_modules/playwright-core');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1728, height: 982 } });
  const directory = path.join(__dirname, 'ref-motion', process.argv[3]);
  fs.mkdirSync(directory, { recursive: true });
  await page.addInitScript(() => {
    window.__loadSamples = [];
    const started = performance.now();
    const read = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const style = getComputedStyle(node);
      return { transform: style.transform, opacity: style.opacity, inline: node.style.transform };
    };
    const sample = () => {
      const ms = Math.round(performance.now() - started);
      window.__loadSamples.push({ ms,
        hero: read('#home-hero'), letter: read('#home-hero-t span span'),
        letters: [...document.querySelectorAll('#home-hero-t > span > span')]
          .map((node) => getComputedStyle(node).transform),
        main: read('#home-main'), mainText: read('#home-main-0'),
        mainMasks: [...document.querySelectorAll('#home-main .mask-y > div')]
          .slice(0, 8).map((node) => getComputedStyle(node).transform),
        topImage: read('#home-main-i-0'), bottomImage: read('#home-main-i-1'),
        aboutText: read('#home-about .j-u'),
      });
      if (ms < 7000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.goto(process.argv[2], { waitUntil: 'domcontentloaded' });
  const shots = [0, 200, 450, 700, 1000, 1400, 2000, 3000, 4500, 7000];
  let elapsed = 0;
  for (const ms of shots) {
    await page.waitForTimeout(ms - elapsed);
    elapsed = ms;
    await page.screenshot({ path: path.join(directory, `load-${ms}.png`) });
  }
  fs.writeFileSync(path.join(directory, 'load.json'), JSON.stringify(await page.evaluate(() => window.__loadSamples), null, 2));
  await page.mouse.move(864, 491);
  const captureWheel = async (label) => {
    await page.evaluate(() => {
      const read = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const style = getComputedStyle(node);
        const box = node.getBoundingClientRect();
        return { y: Math.round(box.y * 100) / 100, transform: style.transform, opacity: style.opacity };
      };
      window.__wheelSamples = [];
      const started = performance.now();
      const sample = () => {
        const ms = Math.round(performance.now() - started);
        window.__wheelSamples.push({ ms,
          hero: read('#home-hero'), main: read('#home-main'),
          aboutText: read('#home-about .j-u'),
          footerText: read('#home-footer-r .mask-y > div'),
          footerPhoto: read('#home-footer-l-i'),
          footerImage: read('#home-footer-l-i img'),
          footerLines: [...document.querySelectorAll('#home-footer-r .mask-y > div')]
            .filter((_, index) => [0, 2, 4, 10, 14].includes(index))
            .map((node) => getComputedStyle(node).transform),
        });
        if (ms < 1600) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.mouse.wheel(0, 480);
    await page.waitForTimeout(1650);
    fs.writeFileSync(path.join(directory, `${label}.json`), JSON.stringify(await page.evaluate(() => window.__wheelSamples), null, 2));
    await page.screenshot({ path: path.join(directory, `${label}.png`) });
  };
  await captureWheel('wheel-1');
  await captureWheel('wheel-2');
  await browser.close();
  console.log(directory);
})().catch((error) => { console.error(error); process.exit(1); });
