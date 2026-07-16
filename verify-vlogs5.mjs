import { chromium } from 'playwright';
const OUT = '/private/tmp/claude-501/-Users-haoyangli-projects-greenpage/955475f4-94ad-46be-a7e4-97d3a16fd640/scratchpad';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:5173/greenpage/tripdots', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const item = page.locator('.tripdots-sidebar__item', { hasText: 'Boston' }).first();
await item.scrollIntoViewIfNeeded();
await item.click();
await page.waitForTimeout(2500);

async function drag(fromX, fromY, toX, toY) {
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}
await drag(950, 300, 300, 300);
await page.waitForTimeout(400);
for (let i = 0; i < 9; i++) {
  await page.mouse.move(505, 380);
  await page.mouse.wheel(0, -250);
  await page.waitForTimeout(250);
}
await page.waitForTimeout(600);

console.log('marker count', await page.locator('.maplibregl-marker').count());
await page.evaluate(() => {
  document.querySelectorAll('.maplibregl-marker').forEach((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/vlog-en-multi2.png` });

const langToggle = page.locator('button', { hasText: 'EN' }).first();
console.log('lang toggle count', await langToggle.count());
if (await langToggle.count() > 0) {
  await langToggle.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/vlog-zh-multi2.png` });
}

await browser.close();
