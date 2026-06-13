import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "/tmp/fables-shots";
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || "http://localhost:5173";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const log = (m) => console.log(m);

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log(`  shot: ${name}.png`);
}

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
await shot("01-ask");

// fill name + pick a chip
await page.fill('input[placeholder*="first name" i]', "Maya");
await page.getByText("Sharing", { exact: true }).first().click();
await page.waitForTimeout(400);
await shot("02-ask-filled");

// use the instant ready-made tale path (deterministic, fast) -> conjure -> story
await page.getByRole("button", { name: "Sharing" }).last().click();
await page.waitForTimeout(700);
await shot("03-conjure");
// conjure min is ~1.6s
await page.waitForTimeout(2200);
await shot("04-setup-scene");

// advance to the fork
for (let i = 0; i < 4; i++) {
  const go = page.getByRole("button", { name: /Go on/i });
  if (await go.count()) {
    await go.first().click();
    await page.waitForTimeout(700);
  }
  // stop once choice cards appear
  if (await page.getByText(/What does .* do\?/i).count()) break;
}
await page.waitForTimeout(500);
await shot("05-fork");

// choose the first card
const cards = page.locator(".parchment");
await cards.first().click({ force: true });
await page.waitForTimeout(1100);
await shot("06-branch");

// advance to the parent bridge (detect the real bridge by its restart button)
for (let i = 0; i < 6; i++) {
  if (await page.getByRole("button", { name: /Tell another tale/i }).count()) break;
  const go = page.getByRole("button", { name: /Go on/i });
  if (await go.count()) {
    await go.first().click();
    await page.waitForTimeout(800);
  } else {
    await page.waitForTimeout(600);
  }
}
await page.waitForTimeout(600);
await shot("07-parent-bridge");

// studio panel
const studio = page.getByRole("button", { name: /studio/i });
if (await studio.count()) {
  await studio.first().click();
  await page.waitForTimeout(700);
  await shot("08-studio");
}

await browser.close();
log("done");
