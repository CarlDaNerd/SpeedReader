\# Speed Reader — Chrome Extension



A Chrome extension that lets you speed read any text on any webpage using RSVP (Rapid Serial Visual Presentation). Select text, trigger the reader, and words flash one at a time with the optimal recognition point pinned to the centre of the screen.



\## Installation



This extension is not on the Chrome Web Store and is loaded manually as an unpacked extension.



1\. Download or clone this repository

2\. Open Chrome and go to `chrome://extensions`

3\. Toggle \*\*Developer Mode\*\* on using the switch in the top right corner

4\. Click \*\*Load unpacked\*\*

5\. Select the `extension/` folder from this repository

6\. The Speed Reader icon appears in your Chrome toolbar



To update after pulling new changes, go back to `chrome://extensions` and click the refresh icon on the Speed Reader card.



\## Usage



\### With selected text

1\. Select any text on a webpage by highlighting it with your mouse

2\. Either:

&#x20;  - Press \*\*`Alt+S`\*\* to open the reader instantly, or

&#x20;  - Right-click the selection and choose \*\*Speed Read selection\*\*

3\. The reader opens as an overlay on top of the current page

4\. Press \*\*play\*\* or `Space` to start

5\. When finished the reader closes automatically

6\. Press \*\*`Esc`\*\* or click × to close manually at any time



\### Without selected text

\- Press `Alt+S` or click the toolbar icon and use the paste box to enter text manually



\## Keyboard Shortcuts



| Key | Action |

|-----|--------|

| `Alt+S` | Open reader with selected text |

| `Space` | Play / pause |

| `←` `→` | Step one word back / forward |

| `↑` `↓` | WPM up / down by 10 |

| `Esc` | Close the reader |



The `Alt+S` shortcut can be changed at `chrome://extensions/shortcuts`.



\## Features



\- \*\*RSVP display\*\* — optimal recognition point (ORP) pinned to centre of screen

\- \*\*Context viewer\*\* — appears on pause, shows surrounding text with current word highlighted

\- \*\*Click to jump\*\* — click any word in the context viewer to resume from that position

\- \*\*WPM control\*\* — slider, +/− buttons, or keyboard arrows. Default 700 WPM

\- \*\*Adjustable font size\*\*

\- \*\*Dark / light mode\*\*

\- \*\*Paste box\*\* — fallback for manually entering text, hides during playback

\- \*\*Smart text parser\*\* — handles em dashes, run-together sentences, and curly quotes

\- \*\*Settings persistence\*\* — WPM and font size are remembered between sessions



\## File Structure



```

extension/

├── manifest.json      — extension config and permissions

├── background.js      — service worker, context menu and shortcut handling

├── content.js         — reader logic injected into host pages

├── reader.css         — overlay styles

├── popup.html         — toolbar icon click popup

├── icon16.png

├── icon48.png

└── icon128.png

```



\## Permissions



| Permission | Reason |

|------------|--------|

| `contextMenus` | Adds "Speed Read selection" to the right-click menu |

| `storage` | Saves WPM and font size between sessions |

| `activeTab` | Injects the reader overlay into the current tab |

| `scripting` | Reads selected text when triggered via keyboard shortcut |



\## Compatibility



Tested in Chrome and Chromium-based browsers (Edge, Brave). Firefox uses a slightly different extension format and is not currently supported.

