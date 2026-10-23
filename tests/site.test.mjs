import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('includes document language, viewport, and search/social metadata', () => {
  assert.match(html, /<html lang="id">/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /name="description"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /name="robots"/);
});

test('has unique IDs and all primary interactive controls', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique');
  for (const id of ['menuToggle', 'mobileNav', 'searchForm', 'destination', 'tripType', 'travelers', 'subscribeForm', 'email', 'toast']) {
    assert.ok(ids.includes(id), `Missing required element #${id}`);
  }
});

test('every image has alternative text and external new tabs are protected', () => {
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map(match => match[0]);
  assert.ok(images.length >= 1, 'Expected destination imagery');
  for (const img of images) assert.match(img, /\balt="[^"]*"/i, `Image missing alt attribute: ${img}`);
  const newTabLinks = [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)].map(match => match[0]);
  for (const link of newTabLinks) assert.match(link, /\brel="[^"]*(?:noopener|noreferrer)[^"]*"/i, `New-tab link should include rel=noopener or noreferrer: ${link}`);
});

test('inline JavaScript parses without syntax errors', () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(source => source.trim());
  assert.ok(scripts.length >= 1, 'Expected inline application script');
  for (const source of scripts) assert.doesNotThrow(() => new vm.Script(source), 'Inline JavaScript must parse');
});

test('demo-only services are disclosed rather than presented as live integrations', () => {
  assert.match(html, /belum mengirim email|belum aktif|belum terhubung/i);
  assert.match(html, /nusatrip:favorites:v1/);
});
