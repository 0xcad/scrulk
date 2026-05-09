import { defineConfig, type Plugin } from "vite";
import preact from "@preact/preset-vite";
import { crx } from "@crxjs/vite-plugin";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import manifest from "./manifest.config";

/**
 * crxjs targets Chrome and only emits `background.service_worker`. Firefox
 * MV3 requires `background.scripts` (event page). This plugin amends the
 * built manifest to include both keys; each browser ignores the one it
 * doesn't recognize.
 */
function firefoxBackgroundScripts(): Plugin {
  return {
    name: "scrulk:firefox-background-scripts",
    apply: "build",
    closeBundle() {
      const manifestPath = resolve("dist", "manifest.json");
      const m = JSON.parse(readFileSync(manifestPath, "utf8"));
      const sw = m.background?.service_worker;
      if (sw && !m.background.scripts) {
        m.background.scripts = [sw];
        writeFileSync(manifestPath, JSON.stringify(m, null, 2));
      }
    },
  };
}

export default defineConfig({
  plugins: [preact(), crx({ manifest }), firefoxBackgroundScripts()],
  build: {
    target: "es2022",
    sourcemap: true,
    // setIcon needs real file paths in MV3, not data URLs — keep PNGs as files.
    assetsInlineLimit: 0,
    // The survey page isn't referenced by manifest entry points (popup,
    // options, background); it's opened via tabs.create + getURL. Register
    // it as an extra HTML input so Vite/crxjs bundles its scripts and CSS.
    rollupOptions: {
      input: {
        survey: resolve(__dirname, "src/survey/index.html"),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
});
