import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";

const url = process.argv[2] || "http://localhost:3000";
const label = process.argv[3];

const dir = "./temporary screenshots";
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const existing = fs
  .readdirSync(dir)
  .map((f) => f.match(/^screenshot-(\d+)/))
  .filter(Boolean)
  .map((m) => parseInt(m[1], 10));
const n = existing.length ? Math.max(...existing) + 1 : 1;
const filename = label ? `screenshot-${n}-${label}.png` : `screenshot-${n}.png`;
const filePath = path.join(dir, filename);

const browser = await puppeteer.launch({
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 800));

// the site's scroll-unfold is reversible (elements fold shut again once
// they leave the viewport), so for a full-page QA capture we force every
// .reveal element to its unfolded state rather than relying on live scroll
// position, which would leave off-screen sections folded shut in the shot.
await page.evaluate(() => {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in-view'));
});
await new Promise((r) => setTimeout(r, 700));

// puppeteer's fullPage:true mis-paints position:fixed backgrounds when
// stitching beyond the viewport. Temporarily pin the fixed bg layers to
// absolute (with an explicit px height, computed at the current viewport
// so vh-based sections don't reflow) before capturing, then restore.
const fullHeight = await page.evaluate(() => document.body.scrollHeight);
await page.evaluate((h) => {
  document.querySelectorAll('.bg-video-wrap, .bg-overlay, .bg-grain').forEach((el) => {
    el.dataset.prevPosition = el.style.position;
    el.style.position = 'absolute';
    el.style.height = h + 'px';
  });
}, fullHeight);
await new Promise((r) => setTimeout(r, 200));

await page.screenshot({ path: filePath, fullPage: true });

await page.evaluate(() => {
  document.querySelectorAll('.bg-video-wrap, .bg-overlay, .bg-grain').forEach((el) => {
    el.style.position = el.dataset.prevPosition || '';
    el.style.height = '';
  });
});

await browser.close();

console.log(`Saved ${filePath}`);
