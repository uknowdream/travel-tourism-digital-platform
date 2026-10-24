import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
let chromium;
try { ({ chromium } = await import("playwright")); }
catch { ({ chromium } = await import("/tmp/ttdp-browser/node_modules/playwright/index.mjs")); }

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

  assert.equal(await page.locator("#heroDestinationCount").textContent(), "41");
  assert.equal(await page.locator("#sectionDestinationCount").textContent(), "41");
  assert.equal((await page.locator('[data-region-count="Asia"]').textContent()).trim(), "23 places");
  await page.locator("#searchText").fill("Tumpak Sewu");
  assert.equal(await page.locator("#destinationGrid .destination-card").count(), 1);
  assert.match(await page.locator("#destinationGrid .destination-card").innerText(), /Tumpak Sewu Waterfall/);
  await page.locator("#searchText").fill("");
  pass("Dynamic destination totals and search cover the Indonesia additions");

  await page.locator("#indonesiaFilter").click();
  const indonesiaDiagnostics = await page.evaluate(() => ({
    pressed: document.querySelector("#indonesiaFilter")?.getAttribute("aria-pressed"),
    countrySelect: document.querySelector("#searchCountry")?.value,
    query: document.querySelector("#searchText")?.value,
    resultCount: document.querySelector("#resultCount")?.textContent,
    cards: document.querySelectorAll("#destinationGrid .destination-card").length,
    visibleCountries: [...document.querySelectorAll("#destinationGrid .card-image-caption small")].map(el => el.textContent).slice(0, 12)
  }));
  assert.equal(indonesiaDiagnostics.cards, 18, "Indonesia quick filter diagnostics: " + JSON.stringify(indonesiaDiagnostics));
  assert.equal(indonesiaDiagnostics.pressed, "true", "Indonesia button should expose pressed state");
  await page.locator("#indonesiaFilter").click();
  assert.equal(await page.locator("#destinationGrid .destination-card").count(), 9);
  pass("Indonesia quick filter returns all 18 local destinations and toggles cleanly");
  const countrySelect = page.locator("#searchCountry");
  assert.equal(await countrySelect.locator('option[value="Indonesia"]').count(), 1);
  await countrySelect.selectOption("Indonesia");
  assert.equal(await page.locator("#destinationGrid .destination-card").count(), 18);
  assert.equal(await countrySelect.inputValue(), "Indonesia");
  await countrySelect.selectOption("all");
  assert.equal(await page.locator("#destinationGrid .destination-card").count(), 9);
  pass("Country dropdown filters all Indonesian destinations and resets correctly");




  await page.locator("#languageToggle").click();
  assert.equal(await page.locator("html").getAttribute("lang"), "id");
  await page.locator("#languageToggle").click();
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  pass("English / Indonesian language switch works");
  assert.equal(await page.locator("#heroSlideDots button").count(), 5);
  assert.equal(await page.locator("#heroSlideIndex").innerText(), "01 / 05");
  await page.locator("#heroSlideNext").click();
  assert.equal(await page.locator("#heroSlideIndex").innerText(), "02 / 05");
  assert.equal(await page.locator("#heroSlideDots button").nth(1).getAttribute("aria-current"), "true");
  await page.locator("#heroSlidePrev").click();
  assert.equal(await page.locator("#heroSlideIndex").innerText(), "01 / 05");
  pass("Five-slide hero carousel controls and active pagination work");
  assert.equal(await page.locator("#heroSlideToggle").isEnabled(), true);
  await page.locator("#heroSlideToggle").click();
  assert.equal(await page.locator("#heroSlideToggle").getAttribute("aria-pressed"), "true");
  assert.match(await page.locator("#heroSlideToggle").getAttribute("aria-label"), /Pause|Play automatic slideshow/);
  await page.locator("#heroSlideToggle").click();
  assert.equal(await page.locator("#heroSlideToggle").getAttribute("aria-pressed"), "false");
  pass("Slideshow has a working accessible pause/play toggle");



  await page.locator("[data-detail]").first().click();
  assert.ok((await page.locator("#dialogBackdrop").getAttribute("class")).includes("open"));
  assert.match(await page.locator("#dialogMap").getAttribute("href"), /google\.com\/maps\/search/);
  assert.equal(await page.locator("#dialogShare").count(), 1);
  const firstCompareId = await page.locator("#dialogCompare").getAttribute("data-place");
  await page.locator("#dialogCompare").click();
  assert.equal(await page.locator("#dialogCompare").getAttribute("aria-pressed"), "true");
  await page.locator("#dialogClose").click();
  assert.ok(!(await page.locator("#dialogBackdrop").getAttribute("class")).includes("open"));
  await page.locator("#destinationGrid [data-detail]").nth(1).click();
  const secondCompareId = await page.locator("#dialogCompare").getAttribute("data-place");
  assert.notEqual(firstCompareId, secondCompareId);
  await page.locator("#dialogCompare").click();
  await page.locator("#dialogClose").click();
  assert.ok(await page.locator("#comparePanel").isVisible());
  assert.equal(await page.locator("#compareGrid .compare-card").count(), 2);
  assert.equal(await page.locator("#compareSaved").isEnabled(), true);
  await page.locator("#compareSaved").click();
  assert.ok(!(await page.locator("#comparePanel").isVisible()));
  await page.locator("#compareSaved").click();
  assert.ok(await page.locator("#comparePanel").isVisible());
  await page.locator("#clearCompare").click();
  assert.equal(await page.locator("#compareGrid .compare-card").count(), 0);
  assert.equal(await page.locator("#compareSaved").isEnabled(), false);
  pass("Destination detail map/share actions and two-place comparison work");

  await page.locator("#destinationGrid [data-save]").first().click();
  await page.locator("#savedFilter").click();
  assert.equal(await page.locator("#destinationGrid .destination-card").count(), 1);
  await page.locator("#savedFilter").click();
  pass("Saved destinations and saved-only filter work");

  await page.locator("#routeDestinationPicker").selectOption("tokyo");
  await page.locator("#addSelectedStop").click();
  assert.equal(await page.locator("#routeStops .stop-chip").count(), 1);
  await page.locator("#routeDestinationPicker").selectOption("kyoto");
  await page.locator("#addSelectedStop").click();
  assert.equal(await page.locator("#routeStops .stop-chip").count(), 2);
  let stopNames = await page.locator("#routeStops .stop-name").allTextContents();
  assert.match(stopNames[0], /tokyo/i);
  assert.match(stopNames[1], /kyoto/i);
  await page.locator("#routeStops [data-move-stop-up='kyoto']").click();
  stopNames = await page.locator("#routeStops .stop-name").allTextContents();
  assert.match(stopNames[0], /kyoto/i);
  assert.match(stopNames[1], /tokyo/i);
  pass("Route stops can be reordered and the selected order is reflected in the planner");

  await page.locator("#planNotes").fill("Keep this personal note out of share links");
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
  assert.match(await page.locator("#tripResultText").textContent(), /Route sequence/);
  assert.match(await page.locator("#tripItinerary .day-card").first().innerText(), /202\d/);
  pass("Planner builds dated day cards, indicative budget, cross-border warning and destination map links");

  const [calendarDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#calendarBrief").click()
  ]);
  assert.match(calendarDownload.suggestedFilename(), /\.ics$/);
  const calendarPath = await calendarDownload.path();
  assert.ok(calendarPath, "Calendar export should produce a downloadable file");
  const calendarText = await readFile(calendarPath, "utf8");
  assert.match(calendarText, /BEGIN:VCALENDAR/);
  assert.equal((calendarText.match(/BEGIN:VEVENT/g) || []).length, 7);
  assert.match(calendarText, /DTSTART;VALUE=DATE:/);
  pass("Calendar export downloads valid seven-day all-day iCalendar events");

  await page.evaluate(() => {
    window.__testSharePayload = null;
    Object.defineProperty(navigator, "share", { configurable: true, value: async payload => { window.__testSharePayload = payload; } });
  });
  await page.locator("#shareBrief").click();
  await page.waitForFunction(() => Boolean(window.__testSharePayload));
  const sharedPayload = await page.evaluate(() => window.__testSharePayload);
  const sharedUrl = new URL(sharedPayload.url);
  assert.equal(sharedUrl.searchParams.get("trip"), "1");
  assert.equal(sharedUrl.searchParams.get("start"), "bali");
  assert.equal(sharedUrl.searchParams.get("stops"), "kyoto,tokyo");
  assert.ok(!sharedUrl.search.includes("personal") && !sharedUrl.search.includes("Keep%20this"), "Personal notes must not be serialized into the URL");
  const destinationDeepLinkPage = await context.newPage();
  destinationDeepLinkPage.on("pageerror", error => runtimeErrors.push("shared-plan: " + error.message));
  await destinationDeepLinkPage.goto(sharedPayload.url, { waitUntil: "domcontentloaded" });
  assert.equal(await destinationDeepLinkPage.locator("#planStart").inputValue(), "bali");
  assert.equal(await destinationDeepLinkPage.locator("#planDate").inputValue(), await page.locator("#planDate").inputValue());
  assert.equal(await destinationDeepLinkPage.locator("#routeStops .stop-chip").count(), 2);
  const restoredStopNames = await destinationDeepLinkPage.locator("#routeStops .stop-name").allTextContents();
  assert.match(restoredStopNames[0], /kyoto/i);
  assert.match(restoredStopNames[1], /tokyo/i);
  assert.equal(await destinationDeepLinkPage.locator("#planNotes").inputValue(), "");
  await destinationDeepLinkPage.close();
  pass("Share link restores trip settings and stops without exposing personal notes");

  await page.evaluate(() => { window.__printCalled = 0; window.print = () => { window.__printCalled += 1; }; });
  await page.locator("#printBrief").click();
  assert.equal(await page.evaluate(() => window.__printCalled), 1);
  assert.ok(await page.locator("body").evaluate(el => el.classList.contains("print-trip")));
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  assert.ok(!(await page.locator("body").evaluate(el => el.classList.contains("print-trip"))));
  pass("Print view activates and restores the page after printing");


  await page.locator("#languageToggle").click();
  assert.match(await page.locator("#tripResultText").textContent(), /Urutan rute/);
  assert.ok((await page.locator("#tripItinerary").innerText()).includes("Buka peta destinasi"));
  pass("Generated planner output stays bilingual after switching languages");

  if (await page.locator("#destinationGrid .destination-card").count() < 41) await page.locator("#showMore").click();
  assert.equal(await page.locator("#destinationGrid .destination-card").count(), 41);
  await page.locator("#destinationGrid img").evaluateAll(images => images.forEach(img => { img.loading = "eager"; }));
  await page.waitForFunction(() => [...document.querySelectorAll("#destinationGrid .card-image img")].every(img =>
    (img.complete && img.naturalWidth > 0) || img.closest(".card-image")?.classList.contains("image-fallback")
  ), null, { timeout: 30000 }).catch(async error => {
    const broken = await page.locator("#destinationGrid .card-image img").evaluateAll(images =>
      images.filter(img => !(img.complete && img.naturalWidth > 0) && !img.closest(".card-image")?.classList.contains("image-fallback")).map(img => ({ src: img.src, attempts: img.dataset.imageRecoveryAttempt }))
    );
    throw new Error("Destination image recovery never settled: " + JSON.stringify(broken) + " " + error.message);
  });
  const imageReport = await page.locator("#destinationGrid .card-image img").evaluateAll(images => ({
    total: images.length,
    photosLoaded: images.filter(img => img.complete && img.naturalWidth > 0).length,
    usedRecovery: images.filter(img => img.dataset.usingImageFallback === "true" && img.complete && img.naturalWidth > 0).length,
    gracefulPlaceholders: images.filter(img => img.closest(".card-image")?.classList.contains("image-fallback")).length,
    unresolved: images.filter(img => !(img.complete && img.naturalWidth > 0) && !img.closest(".card-image")?.classList.contains("image-fallback")).length
  }));
  assert.equal(imageReport.total, 41);
  assert.equal(imageReport.unresolved, 0);
  pass("All 41 destination cards have a loaded photo or a deliberate accessible fallback: " + JSON.stringify(imageReport));

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
  assert.ok(await mobile.locator("#destinationGrid .destination-card img").first().getAttribute("srcset"));

  assert.ok(Number.parseFloat(await mobile.locator("#planNotes").evaluate(el => getComputedStyle(el).fontSize)) >= 16);
  await mobile.locator("#planner").scrollIntoViewIfNeeded();
  const plannerLayout = await mobile.evaluate(() => {
    const layout = document.querySelector(".planner-layout");
    const fields = document.querySelector(".planner-fields");
    const card = document.querySelector(".planner-card");
    const actions = [...document.querySelectorAll(".planner-actions > *")];
    const cardRect = card.getBoundingClientRect();
    return {
      layoutColumns: getComputedStyle(layout).gridTemplateColumns.trim().split(/\s+/).length,
      fieldColumns: getComputedStyle(fields).gridTemplateColumns.trim().split(/\s+/).length,
      cardFits: cardRect.left >= -1 && cardRect.right <= innerWidth + 1,
      actionsFit: actions.every(el => { const r = el.getBoundingClientRect(); return r.width === 0 || (r.left >= cardRect.left - 1 && r.right <= cardRect.right + 1); }),
      inputFont: parseFloat(getComputedStyle(document.querySelector("#planStart")).fontSize)
    };
  });
  assert.equal(plannerLayout.layoutColumns, 1, "Planner narrative and form must stack on phones");
  assert.equal(plannerLayout.fieldColumns, 1, "Planner form fields must become one column on phones");
  assert.ok(plannerLayout.cardFits, "Planner card should fit viewport");
  assert.ok(plannerLayout.actionsFit, "Route-stop controls should stay inside the planner card");
  assert.ok(plannerLayout.inputFont >= 16, "Mobile inputs should avoid browser auto-zoom");
  pass("Trip planner responsive layout fits mobile viewport: " + JSON.stringify(plannerLayout));

  const responsiveMatrix = [];
  for (const width of [1024, 820, 600, 520, 390, 350]) {
    await mobile.setViewportSize({ width, height: 844 });
    await mobile.locator("#planner").scrollIntoViewIfNeeded();
    const metrics = await mobile.evaluate(() => {
      const layout = document.querySelector(".planner-layout");
      const fields = document.querySelector(".planner-fields");
      const card = document.querySelector(".planner-card").getBoundingClientRect();
      const actions = [...document.querySelectorAll(".planner-actions > *")];
      return {
        width: innerWidth,
        layoutTracks: getComputedStyle(layout).gridTemplateColumns.trim().split(/\s+/).length,
        fieldTracks: getComputedStyle(fields).gridTemplateColumns.trim().split(/\s+/).length,
        documentWidth: document.documentElement.scrollWidth,
        cardFits: card.left >= -1 && card.right <= innerWidth + 1,
        actionsFit: actions.every(el => {
          const r = el.getBoundingClientRect();
          return r.width === 0 || (r.left >= card.left - 1 && r.right <= card.right + 1);
        })
      };
    });
    assert.ok(metrics.documentWidth <= width + 1, "Planner page overflow at " + width + "px: " + JSON.stringify(metrics));
    assert.equal(metrics.layoutTracks, width > 820 ? 2 : 1, "Unexpected planner shell columns at " + width + "px");
    assert.equal(metrics.fieldTracks, width <= 600 ? 1 : 2, "Unexpected form field columns at " + width + "px");
    assert.ok(metrics.cardFits && metrics.actionsFit, "Planner elements escape card at " + width + "px: " + JSON.stringify(metrics));
    responsiveMatrix.push(metrics);
  }
  pass("Trip planner viewport matrix 1024 / 820 / 600 / 520 / 390 / 350px: " + JSON.stringify(responsiveMatrix));
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.locator("#destinations").scrollIntoViewIfNeeded();
  await mobile.locator("#destinationGrid [data-detail]").first().click();
  await mobile.locator("#dialogCompare").click();
  await mobile.locator("#dialogClose").click();
  await mobile.locator("#destinationGrid [data-detail]").nth(1).click();
  await mobile.locator("#dialogCompare").click();
  await mobile.locator("#dialogClose").click();
  assert.ok(await mobile.locator("#comparePanel").isVisible());
  assert.equal(await mobile.locator("#compareGrid .compare-card").count(), 2);
  pass("Comparison panel opens for two selected destinations on mobile");

  const fullSiteMatrix = [];
  for (const width of [1440, 1280, 1100, 1024, 900, 820, 768, 600, 520, 430, 390, 375, 350, 320]) {
    await mobile.setViewportSize({ width, height: 900 });
    await mobile.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const metrics = await mobile.evaluate(() => {
      const selectors = [".header .nav", ".hero", ".search-panel", "#regionBar", "#destinationGrid", ".experience-grid", "#routeGrid", ".planner-card", ".journal-grid", ".faq-layout", ".footer-top", "#comparePanel"];
      const outside = [];
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.left < -1 || r.right > innerWidth + 1)) {
          outside.push({ selector, left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) });
        }
      }
      const hero = document.querySelector(".hero")?.getBoundingClientRect();
      const art = document.querySelector(".hero-art-image")?.getBoundingClientRect();
      const copy = document.querySelector(".hero-copy")?.getBoundingClientRect();
      const controls = document.querySelector(".hero-slideshow-controls")?.getBoundingClientRect();
      const heroLayers = hero && art && copy && controls ? {
        backgroundCoversPanel: Math.abs(art.left - hero.left) <= 2 && Math.abs(art.top - hero.top) <= 2 && Math.abs(art.right - hero.right) <= 2 && Math.abs(art.bottom - hero.bottom) <= 2,
        copyInsidePanel: copy.left >= hero.left - 1 && copy.right <= hero.right + 1 && copy.top >= hero.top - 1 && copy.bottom <= hero.bottom + 2,
        controlsInsidePanel: controls.left >= hero.left - 1 && controls.right <= hero.right + 1 && controls.top >= hero.top - 1 && controls.bottom <= hero.bottom + 1
      } : null;
      return {
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        outside,
        heroLayers
      };
    });
    assert.ok(metrics.documentWidth <= width + 1, "Full page horizontal overflow at " + width + "px: " + JSON.stringify(metrics));
    assert.ok(metrics.bodyWidth <= width + 1, "Body horizontal overflow at " + width + "px: " + JSON.stringify(metrics));
    assert.deepEqual(metrics.outside, [], "A major site section escapes the viewport at " + width + "px: " + JSON.stringify(metrics.outside));
    assert.ok(metrics.heroLayers?.backgroundCoversPanel, "Hero background image does not cover the full hero panel at " + width + "px: " + JSON.stringify(metrics.heroLayers));
    assert.ok(metrics.heroLayers?.copyInsidePanel, "Hero copy escapes the hero panel at " + width + "px: " + JSON.stringify(metrics.heroLayers));
    assert.ok(metrics.heroLayers?.controlsInsidePanel, "Slideshow controls escape the hero panel at " + width + "px: " + JSON.stringify(metrics.heroLayers));
    fullSiteMatrix.push(metrics);
  }
  pass("Whole-site responsive matrix 1440 down to 320px: " + JSON.stringify(fullSiteMatrix));
  await mobile.locator("#clearCompare").scrollIntoViewIfNeeded();
  await mobile.locator("#clearCompare").click();
  await mobile.setViewportSize({ width: 390, height: 844 });


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

  const destinationDeepLinkContext = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Jakarta" });
  const destinationGuidePage = await destinationDeepLinkContext.newPage();
  destinationGuidePage.on("pageerror", error => runtimeErrors.push(error.message));
  await destinationGuidePage.goto("http://127.0.0.1:4173/?destination=nusa-penida", { waitUntil: "domcontentloaded" });
  await destinationGuidePage.locator("#dialogBackdrop.open").waitFor({ timeout: 10000 });
  assert.match(await destinationGuidePage.locator("#dialogTitle").innerText(), /Nusa Penida/);
  pass("Shared destination links open the intended destination detail");
  await destinationDeepLinkContext.close();

  console.log("\nBrowser smoke tests passed.");
} catch (error) {
  console.error("BROWSER SMOKE TEST FAILED:", error?.stack || error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
