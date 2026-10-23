import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "/tmp/ttdp-browser/node_modules/playwright/index.mjs";

const root = process.cwd();
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8" };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url || "/", "http://127.0.0.1").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end("Forbidden"); return; }
    const data = await readFile(file);
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404).end("Not found"); }
});

await new Promise((resolve, reject) => { server.once("error", reject); server.listen(4173, "127.0.0.1", resolve); });

let browser;
const runtimeErrors = [];
function pass(message) { console.log("PASS:", message); }
async function noHorizontalOverflow(page, label) {
  const size = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
  assert.ok(size.content <= size.viewport + 1, label + " has horizontal overflow (" + size.content + "px > " + size.viewport + "px)");
  pass(label + " has no page-level horizontal overflow");
}
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, timezoneId: "Asia/Jakarta" });
  const page = await context.newPage();
  page.on("pageerror", error => runtimeErrors.push(error.message));
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await page.locator("#destinationGrid .destination-card").first().waitFor({ timeout: 15000 });
  assert.match(await page.title(), /Travel & Tourism Digital Platform/);
  assert.equal(await page.locator("#destinationGrid .destination-card").count(), 9);
  pass("Desktop landing page and initial destination catalogue render");

  await page.locator("#languageToggle").click();
  assert.equal(await page.locator("html").getAttribute("lang"), "id");
  await page.locator("#languageToggle").click();
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  pass("English / Indonesian language switch works");

  await page.locator("[data-detail]").first().click();
  assert.ok((await page.locator("#dialogBackdrop").getAttribute("class")).includes("open"));
  await page.locator("#dialogClose").click();
  assert.ok(!(await page.locator("#dialogBackdrop").getAttribute("class")).includes("open"));
  pass("Destination detail dialog opens and closes");

  await page.locator("#destinationGrid [data-save]").first().click();
  await page.locator("#savedFilter").click();
  assert.equal(await page.locator("#destinationGrid .destination-card").count(), 1);
  await page.locator("#savedFilter").click();
  pass("Saved destinations and saved-only filter work");

  await page.locator("#routeDestinationPicker").selectOption("tokyo");
  await page.locator("#addSelectedStop").click();
  assert.equal(await page.locator("#routeStops .stop-chip").count(), 1);
  await page.locator("#planStart").selectOption("bali");
  await page.locator("#planDuration").selectOption({ label: "6–9 days" });
  await page.locator("#planDate").evaluate(el => {
    const d = new Date();
    const value = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
    el.value = value < el.min ? el.min : value;
  });
  await page.locator('#plannerForm button[type="submit"]').click();
  assert.ok(await page.locator("#tripResult").evaluate(el => el.classList.contains("visible")));
  assert.ok(await page.locator("#tripEstimate").isVisible());
  assert.equal(await page.locator("#tripItinerary .day-card").count(), 7);
  assert.ok(await page.locator("#tripWarnings").isVisible(), "International route should display a border-crossing warning");
  assert.equal(await page.locator("#tripItinerary .day-map").count(), 7);
  assert.match(await page.locator("#tripResultText").innerText(), /Route sequence/);
  assert.match(await page.locator("#tripItinerary .day-card").first().innerText(), /202\d/);
  pass("Planner builds dated day cards, indicative budget, cross-border warning and destination map links");

  await page.locator("#languageToggle").click();
  assert.match(await page.locator("#tripResultText").innerText(), /Urutan rute/);
  assert.ok((await page.locator("#tripItinerary").innerText()).includes("Buka peta destinasi"));
  pass("Generated planner output stays bilingual after switching languages");

  await noHorizontalOverflow(page, "Desktop 1440px");
  assert.deepEqual(runtimeErrors, [], "Runtime JavaScript errors: " + runtimeErrors.join("; "));
  await context.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: "Asia/Jakarta" });
  const mobile = await mobileContext.newPage();
  const mobileErrors = [];
  mobile.on("pageerror", error => mobileErrors.push(error.message));
  await mobile.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await mobile.locator("#destinationGrid .destination-card").first().waitFor({ timeout: 15000 });
  assert.equal(await mobile.locator("#destinationGrid").evaluate(el => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length), 1);
  assert.ok(Number.parseFloat(await mobile.locator("#planNotes").evaluate(el => getComputedStyle(el).fontSize)) >= 16);
  await mobile.locator("#menuToggle").click();
  assert.equal(await mobile.locator("#menuToggle").getAttribute("aria-expanded"), "true");
  await mobile.locator('#mobileNav a[href="#destinations"]').click();
  assert.equal(await mobile.locator("#menuToggle").getAttribute("aria-expanded"), "false");
  await noHorizontalOverflow(mobile, "Mobile 390px");
  await mobile.setViewportSize({ width: 350, height: 800 });
  await noHorizontalOverflow(mobile, "Small mobile 350px");
  assert.deepEqual(mobileErrors, [], "Mobile runtime JavaScript errors: " + mobileErrors.join("; "));
  pass("Mobile navigation, touch layout and 16px form controls work at 390px and 350px");

  await mobileContext.close();
  console.log("\nBrowser smoke tests passed.");
} catch (error) {
  console.error("BROWSER SMOKE TEST FAILED:", error?.stack || error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
