# UI preview (design review tool)

Renders the **real** `src/screens` and `src/components` code through
`react-native-web` inside jsdom and writes a static page:

```
docs/ui-preview/live.html
```

Nothing in here ships in the app bundle. Screen effects run, so `Home`,
`StoryDetail` and `Chat` render their loaded state (device-only modules —
SQLite, keystore, network content loader, haptics — are replaced by
`preview/stubs/all.tsx`).

## Run it

```bash
# one-time (dev only — intentionally NOT added to package.json)
npm i --no-save react-dom@19.2.3 react-native-web@0.21.2 jest-environment-jsdom@30.0.5

# render docs/ui-preview/live.html
npx jest -c preview/jest.preview.config.js

# view it
npx http-server docs/ui-preview   # or any static server, then open /live.html
```

Cover images used by the preview live in `docs/ui-preview/covers/` (downscaled
copies of the app's own artwork) and are referenced relatively, so `live.html`
also works when opened straight from disk.

## Files

| File | Purpose |
| --- | --- |
| `jest.preview.config.js` | jsdom + ts-jest + module mapping for the stubs |
| `setup.js` | minimal `matchMedia` / `ResizeObserver` / rAF polyfills |
| `stubs/all.tsx` | device-module stubs + the preview story/chat fixtures |
| `render.preview.render.tsx` | renders the four panels and writes `live.html` |

## Notes

* Interactive states (pressed, typing animation) render at their resting state.
* `react-native-safe-area-context` is stubbed with a 26px top / 22px bottom
  inset, i.e. a typical phone.
* The page is a review artifact: it is regenerated whenever the UI changes, so
  it should be re-run (and re-committed) as part of UI work.
