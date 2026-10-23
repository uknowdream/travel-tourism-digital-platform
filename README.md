# Travel & Tourism Digital Platform

A bilingual (English / Indonesian) travel-discovery website focused on destination research and practical itinerary planning. Built as a responsive, portfolio-grade single-page web experience with editorial photography, destination filters, saved places, route ideas, and a local trip planner.

**Live website:** https://travel-tourism-digital-platform.vercel.app  
**Source repository:** https://github.com/uknowdream/travel-tourism-digital-platform

## Experience and features

- **Global destination catalogue:** 25 destinations across six world regions, with search, category and region filters, sorting, and destination details.
- **Saved places and route builder:** Save favourites and add up to five additional stops. State is stored locally in the current browser where local storage is available.
- **Bilingual interface:** Toggle English and Indonesian without losing the selected route.
- **Itinerary builder:** Create a dated daily outline with arrival, destination activities, potential transfer days, and a departure / buffer day. Each stop offers a link to a destination map.
- **Planning-budget heuristic:** Presents an indicative USD range based on broad region and budget-style assumptions. It is not supplier pricing, a quote, or a live calculation.
- **Responsive and accessibility foundations:** Desktop and mobile layouts, keyboard focus styles, accessible destination dialog behavior, and reduced-motion support.
- **SEO and sharing basics:** Page metadata, Open Graph and Twitter card metadata, structured JSON-LD, robots.txt, sitemap.xml, and a custom SVG favicon.
- **Image resilience:** Images are loaded from Unsplash; a designed fallback appears when a remote image fails.

## Technology

- HTML5
- CSS3 with responsive breakpoints
- Vanilla JavaScript
- Python for structural QA
- Node.js and Playwright for browser smoke-test automation
- GitHub Actions for checks on pushes and pull requests
- Vercel for static deployment

## Run locally

Because this is a static website, no build step is required.

1. Clone the repository.
2. Open index.html in a modern browser, or serve the repository root with any static HTTP server.
3. Internet access is needed for remote Unsplash imagery and Google Fonts.

## Quality checks

The repository includes a dependency-free structural audit:

    python scripts/site_qa.py --js-out /tmp/travel-tourism-inline.js
    node --check /tmp/travel-tourism-inline.js

A browser smoke-test suite is available in tests/browser-smoke.mjs. It covers core destination interactions, language switching, favourites, planner output, map links, and representative desktop and mobile viewport behavior. The GitHub Actions workflow installs Playwright/Chromium and runs these checks on pushes and pull requests.

The static audit and a production source audit have been performed. Browser CI results must be checked in the Actions tab for the latest run; automated checks do not replace visual review on actual devices, screen readers, and a wider browser matrix.

## Scope and data transparency

This is a travel-discovery and planning companion, **not a live travel agency or booking marketplace**.

- No hotel, flight, tour, transport, payment, or reservation API is connected.
- Prices and availability are not fetched live. The displayed budget is a broad planning aid only and excludes many variable costs; verify current prices with official and provider sources.
- Route concepts and daily outlines are editable starting points, not geographically optimized routes or verified transport timetables. Check border-entry rules, schedules, travel times, local conditions, and safety guidance before departure.
- Destination information is editorial inspiration, not a live alert or guarantee of current conditions.
- Saved favourites and route stops stay in browser storage when available and do not sync to an account. Planner notes are used to generate the on-page brief. Avoid entering passport, payment, or other sensitive details.

## Deployment

Vercel is connected to the GitHub repository. Updates pushed to main trigger production deployment. The current canonical website is the Vercel domain shown above.
