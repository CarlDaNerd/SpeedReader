# Speed Reader

A lightweight RSVP (Rapid Serial Visual Presentation) speed reader available as a standalone browser file and a Chrome extension. Words flash one at a time with the optimal recognition point pinned to the centre of the screen, letting you read at speeds up to 1000 WPM without moving your eyes.

---

## Versions

### Standalone HTML
A single self-contained file. Open it in any browser, paste your text, and read. No install, no internet connection required. Works in Chrome, Firefox, Safari, and Edge.

### Chrome Extension
Integrates directly into your browser. Select text on any webpage, press `Alt+S` or right-click, and the reader opens as an overlay on top of the page. Closes automatically when finished.

---

## Features

- **RSVP display** — optimal recognition point (ORP) pinned to centre of screen so your eye never moves
- **Variable pacing** — long words and punctuation are held slightly longer to match natural reading rhythm
- **Context viewer** — pausing reveals a scrollable panel showing surrounding text with the current word highlighted
- **Click to jump** — click any word in the context viewer to jump to that position and resume from there
- **WPM control** — slider, +/− stepper buttons, or keyboard arrow keys. Default 700 WPM
- **Adjustable font size**
- **Dark / light mode**
- **Smart text parser** — correctly splits words at periods, em dashes, and run-together sentence boundaries
- **Settings persistence** *(extension only)* — WPM and font size remembered between sessions

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Alt+S` | Open extension with selected text *(extension only)* |
| `Space` | Play / pause |
| `←` `→` | Step one word back / forward |
| `↑` `↓` | WPM up / down by 10 |
| `Esc` | Close the reader *(extension only)* |

---

## Installation

### Standalone HTML
1. Download `speed-reader.html`
2. Open it in any browser

### Chrome Extension
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Toggle **Developer Mode** on in the top right corner
4. Click **Load unpacked**
5. Select the `extension/` folder
6. The Speed Reader icon appears in your Chrome toolbar

See [`extension/README.md`](extension/README.md) for full extension documentation including permissions and usage details.

---

## Repository Structure

```
speed-reader/
│
├── README.md                   — this file
├── speed-reader.html           — standalone browser version
│
└── extension/
    ├── README.md               — extension install and usage guide
    ├── manifest.json
    ├── background.js
    ├── content.js
    ├── reader.css
    ├── popup.html
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```