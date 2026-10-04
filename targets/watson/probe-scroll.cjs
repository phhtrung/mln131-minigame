const { chromium } = require('C:/Users/seu/AppData/Roaming/npm/node_modules/pingfusi/packages/motion/node_modules/playwright-core');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: {
    width: Number(process.argv[5]) || 1728,
    height: Number(process.argv[6]) || 982,
  } });
  const target = process.argv[2];
  const label = process.argv[3];
  const directory = path.join(__dirname, 'ref-motion', label);
  fs.mkdirSync(directory, { recursive: true });
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  await page.mouse.move((Number(process.argv[5]) || 1728) / 2, (Number(process.argv[6]) || 982) / 2);
  const rows = [];
  for (let step = 0; step < 8; step++) {
    if (step) {
      if (process.argv[4] !== 'still') await page.mouse.wheel(0, 480);
      await page.waitForTimeout(900);
    }
    await page.screenshot({ path: path.join(directory, `${step}.png`) });
    rows.push(await page.evaluate((index) => {
      const element = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const box = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return { top: Math.round(box.top), bottom: Math.round(box.bottom), transform: style.transform, opacity: style.opacity };
      };
      return { step: index, scrollY, bodyHeight: document.body.scrollHeight,
        hero: element('#home-hero'), main: element('#home-main'),
        about: element('#home-about'), footer: element('#home-footer'),
        home: element('#home'),
        footerPhoto: (() => {
          const image = document.querySelector('#home-footer img');
          if (!image) return null;
          const style = getComputedStyle(image);
          const box = image.getBoundingClientRect();
          return { opacity: style.opacity, inlineOpacity: image.style.opacity,
            src: image.currentSrc, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
            parentOpacity: getComputedStyle(image.parentElement).opacity,
            parentInlineOpacity: image.parentElement.style.opacity,
            visibility: style.visibility, display: style.display,
            top: Math.round(box.top), width: Math.round(box.width), height: Math.round(box.height),
            animations: image.getAnimations().map((animation) => animation.playState) };
        })(),
        images: [...document.querySelectorAll('#home-main img')].map((image) => ({
          src: image.currentSrc.split('/').pop(),
          opacity: getComputedStyle(image).opacity,
          top: Math.round(image.getBoundingClientRect().top),
        })),
        reveal: index === 3 ? [...document.querySelectorAll('#home-about *, #home-footer *')]
          .filter((node) => node.children.length === 0 || node.style.transform)
          .map((node) => ({
            tag: node.tagName, class: node.className, id: node.id,
            text: node.textContent.trim().slice(0, 36),
            inlineTransform: node.style.transform,
            transform: getComputedStyle(node).transform,
            opacity: getComputedStyle(node).opacity,
            top: Math.round(node.getBoundingClientRect().top),
          })) : [] };
    }, step));
  }
  fs.writeFileSync(path.join(directory, 'states.json'), JSON.stringify(rows, null, 2));
  const footerReport = await page.evaluate(() => {
    const right = document.querySelector('#home-footer-r');
    const left = document.querySelector('#home-footer-l');
    const label = document.querySelector('#home-footer-l-l');
    const photo = document.querySelector('#home-footer-l-i');
    const metrics = (node) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return { top: box.top, height: box.height, width: box.width,
        marginTop: style.marginTop, fontSize: style.fontSize, lineHeight: style.lineHeight };
    };
    return { right: metrics(right), left: metrics(left), label: metrics(label),
      photo: metrics(photo), rightHtml: right.innerHTML, labelHtml: label.innerHTML };
  });
  fs.writeFileSync(path.join(directory, 'footer.json'), JSON.stringify(footerReport, null, 2));
  console.log(JSON.stringify(rows, null, 2));
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
