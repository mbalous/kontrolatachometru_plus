# Kontrola Tachometru Plus

Browser extension that enhances [kontrolatachometru.cz](https://www.kontrolatachometru.cz) with a mileage history graph.

## Features

- 📈 **Interactive mileage chart** - Visualizes odometer readings over time
- 📊 **Statistics** - Shows first/last reading, total increase, and average km/year
- ⚠️ **Anomaly detection** - Warns about mileage decreases (potential odometer tampering)
- 🖱️ **Tooltips** - Hover over data points to see exact values

## Installation

### Chrome / Edge / Brave

1. Download or clone this repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Open `chrome://extensions` (or `edge://extensions`)
5. Enable **Developer mode** (toggle in top-right)
6. Click **Load unpacked**
7. Select the `dist` folder

### Firefox

1. Download or clone this repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Open `about:debugging#/runtime/this-firefox`
5. Click **Load Temporary Add-on**
6. Select `dist/manifest.json`

## Usage

1. Go to [kontrolatachometru.cz](https://www.kontrolatachometru.cz)
2. Enter a VIN and complete the captcha
3. After results load, a mileage graph will appear below the inspection table

## Project Structure

```
├── src/                    # Extension source code
│   ├── manifest.json       # Extension manifest (MV3)
│   ├── content.js          # Main content script
│   ├── styles.css          # Chart styling
│   └── icons/              # Extension icons
├── docs/                   # Documentation & reference files
│   └── example-page.html   # Sample page for development
├── LICENSE
└── README.md
```

## Development

The extension source is written in TypeScript and built to `dist/`.

To test changes:
1. Run `npm install`
2. Run `npm run watch`
3. Load the `dist` folder in Edge/Chromium or load `dist/manifest.json` in Firefox
4. Reload the target page

## License

See [LICENSE](LICENSE) file.
