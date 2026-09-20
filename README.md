# Weathervane

A small weather web app. Search for a city and see its current conditions and a
5-day forecast. The whole page changes colour to match the weather.

Built with plain HTML, CSS and JavaScript. No frameworks, no API key.

**Live app:** https://rehmansaeed06-byte.github.io/weathervane/

## Features

- Search any city in the world (with "try one of these" suggestions for ambiguous names)
- Current temperature, "feels like", humidity and wind
- 5-day forecast with a low-to-high range bar for each day
- Switch between °C and °F (remembers your choice and your last city)
- Page colour follows the conditions: sunny, night, cloudy, fog, rain, snow, storm
- Works on phones, keyboard-friendly, and readable colour contrast in every theme

Weather data comes from [Open-Meteo](https://open-meteo.com/).

## Project files

| File | What it does |
| --- | --- |
| `index.html` | Page structure |
| `style.css` | Design and colour themes |
| `weather.js` | Weather logic (unit conversion, parsing, labels). No page code, so it can be tested |
| `script.js` | Connects the page to the logic and to the Open-Meteo API |
| `test/weather.test.js` | Unit tests for `weather.js` |
| `scripts/check-build.js` | Build check: makes sure the HTML, CSS and JS files agree with each other |
| `.github/workflows/ci.yml` | GitHub Actions CI workflow |

## Run it locally

Open `index.html` in your browser (double-click it). That's all.

## Run the checks locally

You need [Node.js](https://nodejs.org/) 18 or newer. There is nothing to install.

```bash
npm run verify        # syntax check + build check + unit tests
npm test              # unit tests only
```

## Continuous Integration (CI)

`.github/workflows/ci.yml` runs automatically on every push to `main`
(and on pull requests to `main`). It runs three checks:

1. **Check JavaScript syntax** - `node --check` on `weather.js` and `script.js`
2. **Check build files** - `scripts/check-build.js` verifies that `index.html` loads
   every file, every element id used in `script.js` exists in the HTML, and every
   colour theme has CSS
3. **Run unit tests** - `npm test`

If any step fails, the run turns red in the **Actions** tab.

## Deployment

The site is static, so it is hosted with GitHub Pages:
**Settings > Pages > Build and deployment > Source: Deploy from a branch >
Branch: `main` / `(root)` > Save.**
