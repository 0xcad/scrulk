# Scroll Unlock (ScrUlk)

A cross-browser extension that helps you notice and reduce time spent on
websites you flag. Add a domain to your tracked list and the extension layers
on friction: a usage clock, breaktime alerts, a tab limit, a regret survey,
and a sleep-time countdown.

## Develop

```sh
npm install
npm run dev    # Vite + crxjs HMR
npm run build  # → dist/
npm test       # vitest
```

## Load the extension

**Firefox** (115+):
1. `npm run build`
2. Open `about:debugging#/runtime/this-firefox`
3. *Load Temporary Add-on…* → select `dist/manifest.json`

**Chrome / Chromium**:
1. `npm run build`
2. Open `chrome://extensions`
3. Enable *Developer mode*
4. *Load unpacked* → select `dist/`

## Stack

Manifest V3 · Preact · Vite · `@crxjs/vite-plugin` · TypeScript ·
`webextension-polyfill`.
