import { defineConfig, type Plugin } from "vite";
import preact from "@preact/preset-vite";
import { crx } from "@crxjs/vite-plugin";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import manifest from "./manifest.config";

/**
 * Post-build manifest fixups for Firefox compatibility:
 *
 *  1. crxjs only emits `background.service_worker` (Chrome). Firefox MV3
 *     requires `background.scripts` (event page). Add both; each browser
 *     ignores the one it doesn't recognize.
 *  2. crxjs injects `use_dynamic_url` into every `web_accessible_resources`
 *     entry. That key is Chrome-only; Firefox logs an "unexpected property"
 *     warning per entry. Strip it — Chrome treats its absence as `false`,
 *     matching prior behavior.
 */
function firefoxManifestFixups(): Plugin {
  return {
    name: "scrulk:firefox-manifest-fixups",
    apply: "build",
    closeBundle() {
      const manifestPath = resolve("dist", "manifest.json");
      const m = JSON.parse(readFileSync(manifestPath, "utf8"));
      let changed = false;
      const sw = m.background?.service_worker;
      if (sw && !m.background.scripts) {
        m.background.scripts = [sw];
        changed = true;
      }
      if (Array.isArray(m.web_accessible_resources)) {
        for (const entry of m.web_accessible_resources) {
          if (entry && typeof entry === "object" && "use_dynamic_url" in entry) {
            delete entry.use_dynamic_url;
            changed = true;
          }
        }
      }
      if (changed) {
        writeFileSync(manifestPath, JSON.stringify(m, null, 2));
      }
    },
  };
}

export default defineConfig({
  plugins: [preact(), crx({ manifest }), firefoxManifestFixups()],
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
        gateway: resolve(__dirname, "src/gateway/index.html"),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
});
