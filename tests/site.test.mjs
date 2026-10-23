import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(source => source.trim());
const css = html.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || '';

test('includes product branding, responsive viewport and search/social metadata', () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /name="description"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /name="robots"/);
  assert.match(html, /Travel & Tourism Digital Platform/);
  assert.match(html, /href="\/favicon\.svg"/);
});

test('has unique element IDs and destination/planner controls', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique');
  for (const id of [
    'menuToggle', 'mobileNav', 'quickSearch', 'searchText', 'searchCategory',
    'searchRegion', 'destinationGrid', 'heroSlideshow', 'heroSlideImage',
    'heroSlidePrev', 'heroSlideNext', 'heroSlideDots', 'plannerForm',
    'routeDestinationPicker', 'tripEstimate', 'tripItinerary', 'indonesiaFilter', 'shareBrief', 'printBrief', 'calendarBrief'
  ]) assert.ok(ids.includes(id), 'Missing required element #' + id);
});

test('all images declare alternative text and external new tabs are protected', () => {
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map(match => match[0]);
  assert.ok(images.length >= 3, 'Expected destination imagery');
  for (const img of images) assert.match(img, /\balt="[^"]*"/i, 'Image missing alt attribute: ' + img);
  const newTabLinks = [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)].map(match => match[0]);
  for (const link of newTabLinks) {
    assert.match(link, /\brel="[^"]*(?:noopener|noreferrer)[^"]*"/i,
      'New-tab link should include rel=noopener or noreferrer: ' + link);
  }
});

test('inline JavaScript parses without syntax errors', () => {
  assert.ok(scripts.length >= 1, 'Expected inline application script');
  for (const source of scripts) assert.doesNotThrow(() => new vm.Script(source));
});

test('hero background uses the first destination card image and carousel data', () => {
  assert.match(html, /id:"bali",name:"Bali"/);
  assert.match(html, /id="heroSlideImage" src="[^"]*photo-1537996194471-e657df975ab4/);
  assert.match(html, /\{destinationId:"bali"/);
  assert.match(html, /destination\?\.image\?destination\.image\.replace/);
  assert.match(html, /id="heroSlideNext"/);
  assert.match(html, /id="heroSlidePrev"/);
  const destinationRecords = [...html.matchAll(/id:"([a-z0-9-]+)",name:"([^"]+)"[\s\S]*?image:"(https:\/\/images\.unsplash\.com\/[^"]+)"/g)];
  assert.equal(destinationRecords.length, 41, 'Expected 41 destination records');
  assert.equal(new Set(destinationRecords.map(record => record[1] )).size, 41, 'Destination IDs must be unique');
  assert.equal(new Set(destinationRecords.map(record => record[3] )).size, 41, 'Destination images must be unique');

  const indonesiaCount = (html.match(/\{id:"[^"]+",name:"[^"]+",country:\{en:"Indonesia",id:"Indonesia"\}/g) || []).length;
  assert.ok(indonesiaCount >= 18, 'Expected at least 18 Indonesia destinations');
  assert.match(html, /id="heroDestinationCount"/);
  assert.match(html, /id="sectionDestinationCount"/);
  assert.match(html, /id="indonesiaFilter"/);
  assert.match(html, /id="indonesiaCount"/);
  assert.match(html, /id="searchCountry"/);
  assert.match(html, /function moveStop\(id,delta\)/);
  assert.match(html, /data-move-stop-up/);
  assert.match(html, /data-move-stop-down/);
  assert.match(html, /id="heroSlideToggle"/);
  assert.match(html, /function syncHeroSlideToggle\(\)/);
  assert.match(html, /srcset=/);
  assert.match(html, /sizes="\(max-width:600px\)/);
  assert.match(html, /data-region-count="Asia"/);
  assert.ok(html.includes('document.querySelectorAll("[data-region-count]")'));
});

test('hero is immersive, readable and responsive rather than using a floating info card', () => {
  assert.match(css, /\.hero\{position:relative;display:block;width:min\(1500px,calc\(100% - 40px\)\)/);
  assert.match(css, /\.hero-art\{position:absolute;inset:0/);
  assert.match(css, /\.floating-insight\{display:none\}/);
  assert.match(css, /@media\(max-width:820px\)/);
  assert.match(css, /@media\(max-width:520px\)/);
  assert.match(css, /@media\(max-width:370px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(html, /heroSlideshow\.addEventListener\("mouseenter"/);
  assert.match(html, /heroSlideshow\.addEventListener\("focusin"/);
});

test('trip planner makes a dated itinerary and labels estimates as indicative', () => {
  assert.match(html, /function makeBrief\(focusOutput=true\)/);
  assert.match(html, /id="tripEstimate"/);
  assert.match(html, /id="tripItinerary"/);
  assert.match(html, /Indicative daily budget/);
  assert.match(html, /not live prices/);
  assert.match(html, /ttdp:saved/);
  assert.match(html, /localStorage\.setItem/);
});


test('Indonesia filter, share-safe planner links, print and calendar export are present', () => {
  assert.match(html, /data-country-search="Indonesia"/);
  assert.match(html, /function makeShareUrl\(\)/);
  assert.match(html, /function loadSharedPlanFromUrl\(\)/);
  assert.match(html, /function downloadCalendar\(\)/);
  assert.match(html, /function printBrief\(\)/);
  assert.match(html, /sharePrivacyNote/);
  assert.match(html, /params\.set\("trip","1"\)/);
  assert.match(html, /params\.set\("stops",stops\.join\(","\)\)/);
  assert.doesNotMatch(html.slice(html.indexOf("function makeShareUrl()"), html.indexOf("function goToResults()")), /planNotes|notes:/);
  assert.match(html, /text\/calendar;charset=utf-8/);
  assert.match(html, /@media print/);
});

test('visible typography has a 10px minimum on explicit pixel font sizes', () => {
  const declarations = [...css.matchAll(/font-size\s*:\s*([^;]+);/g)].map(match => match[1]);
  const tooSmall = declarations.flatMap(value => [...value.matchAll(/(\d+(?:\.\d+)?)px/g)]
    .map(match => Number(match[1])).filter(px => px < 10));
  assert.deepEqual(tooSmall, []);
});

test('the destination image fallback and high-priority hero preload are configured', () => {
  assert.match(html, /const IMAGE_FALLBACKS=/);
  assert.match(html, /imageRecoveryAttempt/);
  assert.match(html, /rel="preload" as="image"/);
});

test('stylesheet braces and structured data are valid', () => {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal((stripped.match(/\{/g) || []).length, (stripped.match(/\}/g) || []).length);
  const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  assert.ok(jsonLd.length >= 1, 'Expected JSON-LD');
  for (const match of jsonLd) assert.doesNotThrow(() => JSON.parse(match[1]));
});
