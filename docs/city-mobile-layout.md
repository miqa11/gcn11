# Mobile control layout

Stamina, contextual vehicle/garden controls, the interior exit and minimized-window launchers share `.city-bottom-hud` in normal document flow on touch screens. They retain their existing desktop positions. The lower HUD scrolls when expanded options need more space. Stamina labels wrap instead of extending beyond their box.

`city-hud-layout.js` measures the real joystick/action row, visible fire control and lower HUD with ResizeObserver. The lower HUD reserves the input region; the upper HUD scrolls within the space left above it. Orientation/viewport changes and minimized panels update those measurements. Touch controls include the browser's bottom safe-area inset. This avoids maintaining separate, conflicting pixel offsets for each status/action panel.

## Repeatable browser regression

Install project dependencies plus Playwright in a development checkout (Playwright is optional QA tooling, not a production dependency):

```sh
npm install
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node scripts/check-city-mobile-layout.cjs
```

Alternatively set `CITY_QA_CHROME` to an installed Chromium/Chrome executable. `CITY_QA_OUTPUT` selects a screenshot directory; the default is `gaicani-city-mobile-layout` in the OS temporary directory. The fixture starts an ephemeral localhost server and uses three browser clients without accounts, real provider keys or production data.

The check compares clipped visible rectangles for every button/select, joystick and stamina indicator. It checks nine viewport sizes from 320×568 portrait through 568×320 landscape and 768×1024 tablet, expanded car seats/settings, minimized/restore controls, actual vehicle entry/exit, garden options and zombie HUD/fire controls. It checks page errors and horizontal overflow and saves representative screenshots. Scroll content outside its visible clip is excluded. Passing this fixture does not prove every future modal or physical device is overlap-free; rerun it when controls or translations change and inspect new states.
