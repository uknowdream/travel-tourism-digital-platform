#!/usr/bin/env python3
"""Dependency-free structural QA for the single-page travel site."""
from __future__ import annotations
import argparse, json, re, sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_FILE = ROOT / "index.html"

class SiteParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.anchors, self.images, self.scripts, self.styles = [], [], [], [], []
        self.current_script = None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "a":
            self.anchors.append(a)
        if tag == "img":
            self.images.append(a)
        if tag == "script":
            self.current_script = {"attrs": a, "content": ""}
            self.scripts.append(self.current_script)
        if tag == "style":
            self.current_style = ""
    def handle_data(self, data):
        if self.current_script is not None:
            self.current_script["content"] += data
    def handle_endtag(self, tag):
        if tag == "script":
            self.current_script = None

def fail(message):
    print("FAIL:", message)
    return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--js-out", default="/tmp/travel-tourism-inline.js")
    args = parser.parse_args()
    if not HTML_FILE.exists():
        return 1
    html = HTML_FILE.read_text(encoding="utf-8")
    p = SiteParser()
    p.feed(html)
    ok = True
    def check(condition, message):
        nonlocal ok
        print(("PASS: " if condition else "FAIL: ") + message)
        ok = ok and condition

    duplicate_ids = [k for k, count in Counter(p.ids).items() if count > 1]
    check(not duplicate_ids, "HTML IDs are unique" + (f" (duplicates: {duplicate_ids})" if duplicate_ids else ""))

    internal = sorted({a.get("href", "")[1:] for a in p.anchors if a.get("href", "").startswith("#") and len(a.get("href", "")) > 1})
    missing = [x for x in internal if x not in set(p.ids)]
    check(not missing, "Internal navigation fragments resolve" + (f" (missing: {missing})" if missing else ""))

    missing_alt = [img.get("src", "(no src)") for img in p.images if "alt" not in img]
    check(not missing_alt, "All HTML images declare alt text" + (f" (missing: {missing_alt})" if missing_alt else ""))

    unsafe = []
    for a in p.anchors:
        if a.get("target", "").lower() == "_blank":
            rel = set(a.get("rel", "").lower().split())
            if not {"noopener", "noreferrer"}.issubset(rel):
                unsafe.append(a.get("href", "(no href)"))
    check(not unsafe, "External new-tab links use noopener and noreferrer" + (f" (issues: {unsafe})" if unsafe else ""))

    title = re.search(r"<title>(.*?)</title>", html, re.I | re.S)
    check(bool(title and "Travel &amp; Tourism Digital Platform" in title.group(1)), "Document title includes product name")
    check('name="description"' in html and 'property="og:title"' in html and 'property="og:image"' in html, "SEO and social preview metadata present")

    ids_required = ["destinationGrid", "plannerForm", "tripEstimate", "tripWarnings", "tripItinerary", "tripResult", "routeDestinationPicker"]
    check(all(f'id="{value}"' in html for value in ids_required), "Destination catalogue and planner features are present")
    keys_ok = html.count("briefRawToggle:") == 2
    check(keys_ok, "Planner result summary has English and Indonesian labels")

    card_matches = re.findall(r'id:"([a-z0-9-]+)",name:"([^"]+)"[\s\S]*?image:"(https://images\.unsplash\.com/[^"]+)"', html)
    ids = [m[0] for m in card_matches]
    images = [m[2] for m in card_matches]
    check(len(card_matches) == 25, f"Expected 25 destination records (found {len(card_matches)})")
    check(len(set(ids)) == len(ids) and len(set(images)) == len(images), "Destination IDs and catalogue images are unique")

    for bp in ("@media(max-width:1100px)", "@media(max-width:820px)", "@media(max-width:520px)", "@media(max-width:350px)", "prefers-reduced-motion:reduce"):
        check(bp in html, f"Responsive/accessibility rule exists: {bp}")
    check("grid-template-columns:1fr" in html[html.rfind("@media(max-width:520px)"):], "Mobile destination cards prioritize readable single-column layout")
    check("function makeBrief(focusOutput=true)" in html and "indicative daily budget" in html and "not live prices" in html, "Planner generates daily outline and labels budget as indicative")
    check("image-fallback" in html, "Broken images receive a designed fallback state")

    css = re.search(r"<style>([\s\S]*?)</style>", html)
    if css:
        cleaned_css = re.sub(r"/\*[\s\S]*?\*/", "", css.group(1))
        check(cleaned_css.count("{") == cleaned_css.count("}"), "CSS braces are balanced")
    else:
        check(False, "Inline stylesheet exists")

    main_scripts = [s["content"] for s in p.scripts if not s["attrs"].get("type", "").lower().endswith("ld+json") and s["content"].strip()]
    check(len(main_scripts) == 1, "One inline application script is present")
    if main_scripts:
        Path(args.js_out).write_text(main_scripts[0], encoding="utf-8")
        check("updateStaticTranslations" in main_scripts[0] and "renderDestinations" in main_scripts[0], "Core interaction functions are present")
    else:
        check(False, "Application JavaScript can be extracted")

    ld_scripts = [s["content"] for s in p.scripts if s["attrs"].get("type", "").lower() == "application/ld+json"]
    try:
        check(bool(ld_scripts) and all(isinstance(json.loads(s), dict) for s in ld_scripts), "JSON-LD structured data is valid JSON")
    except Exception as exc:
        check(False, f"JSON-LD structured data parses ({exc})")

    if not ok:
        print("\nSite QA failed. Fix failures before merging to main.")
        return 1
    print("\nSite QA passed. Browser-level visual and interaction checks are still required for full release confidence.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
