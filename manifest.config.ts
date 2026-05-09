import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Scroll Unlock",
  short_name: "ScrUlk",
  description:
    "Notice and reduce time on websites you flag. Friction tools: usage clock, breaktime alerts, tab limits, regret survey.",
  version: "0.1.0",

  // Slice 2 adds alarms (daily reset), idle (pause-when-AFK).
  // Future slices add: scripting (slice 4 dynamic injection), webNavigation.
  permissions: ["storage", "tabs", "alarms", "idle"],

  // Content script for the usage clock + (later) sleep clock runs on every
  // page; it bails fast on non-tracked hosts.
  host_permissions: ["<all_urls>"],

  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.tsx"],
      run_at: "document_idle",
      all_frames: false,
    },
  ],

  action: {
    default_title: "Scroll Unlock",
    default_popup: "src/popup/index.html",
    default_icon: {
      "16": "src/assets/icon-inactive-16.png",
      "32": "src/assets/icon-inactive-32.png",
      "48": "src/assets/icon-inactive-48.png",
      "128": "src/assets/icon-inactive-128.png",
    },
  },

  options_ui: {
    page: "src/options/index.html",
    open_in_tab: true,
  },

  icons: {
    "16": "src/assets/icon-inactive-16.png",
    "32": "src/assets/icon-inactive-32.png",
    "48": "src/assets/icon-inactive-48.png",
    "128": "src/assets/icon-inactive-128.png",
  },

  background: {
    // Chrome uses service_worker. Firefox MV3 only honors background.scripts;
    // the `scripts` key is injected post-build by the firefoxBackgroundScripts
    // Vite plugin (crxjs strips unknown keys here).
    service_worker: "src/background/index.ts",
    type: "module",
  },

  browser_specific_settings: {
    gecko: {
      id: "scrulk@local",
      strict_min_version: "115.0",
      data_collection_permissions: {
        required: ["none"],
      },
    },
  },
});
