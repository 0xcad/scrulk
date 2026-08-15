import { defineConfig, type Plugin } from "vite";
import preact from "@preact/preset-vite";
import { crx } from "@crxjs/vite-plugin";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import manifest from "./manifest.config";
import { EXTENSION_PAGES } from "./src/shared/extensionPages";

/**
 * Post-build manifest fixups:
 *
 * Firefox: crxjs only emits `background.service_worker`; Firefox requires
 * `background.scripts` instead (service workers are behind a flag). Add it
 * when BROWSER=firefox.
 *
 * Firefox: crxjs injects `use_dynamic_url` into every
 * `web_accessible_resources` entry. That key is Chrome-only; Firefox logs
 * an "unexpected property" warning per entry. Strip it — Chrome treats its
 * absence as `false`, matching prior behavior.
 */
function manifestFixups(): Plugin {
  const isFirefox = process.env["BROWSER"] === "firefox";
  return {
    name: "scrulk:manifest-fixups",
    apply: "build",
    closeBundle() {
      const manifestPath = resolve("dist", "manifest.json");
      const m = JSON.parse(readFileSync(manifestPath, "utf8"));
      let changed = false;
      if (isFirefox) {
        const sw = m.background?.service_worker;
        if (sw && !m.background.scripts) {
          m.background.scripts = [sw];
          delete m.background.service_worker;
          changed = true;
        }
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
  define: {
    __SCRULK_DEBUG__: JSON.stringify(process.env["SCRULK_DEBUG"] === "1"),
  },
  plugins: [preact(), crx({ manifest }), manifestFixups()],
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
        survey: resolve(__dirname, EXTENSION_PAGES.survey),
        gateway: resolve(__dirname, EXTENSION_PAGES.gateway),
        camera: resolve(__dirname, EXTENSION_PAGES.camera),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
});
