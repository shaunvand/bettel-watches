# Bettél — redesign preview

Static preview of a redesign for [bettelwatches.com](https://www.bettelwatches.com/), built from their own copy and photography.

- `index.html` + `assets/` — no build step. Serve locally: `python -m http.server 8797`.
- `assets/js/watch3d.js` — Three.js watch textured with crops of the real product photos (exploded/assembled as a pure function of scroll).
- `assets/js/app.js` — Lenis + GSAP ScrollTrigger, making-of story, builder (all 16 real watch configurations → real photos, prices, specs), sunglasses lens switcher.
- `assets/js/data.js` — product data scraped from bettelwatches.com product pages (2026-10-24).

`noindex` + `robots.txt` Disallow while this is a preview; remove both at go-live.
