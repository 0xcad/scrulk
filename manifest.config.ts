import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Scroll Unlock",
  short_name: "ScrUlk",
  description:
    "Yet another digital wellness tool, but this is the one that works for me. Get unlocked.",
  version: "0.1.0",

  // Slice 2 adds alarms (daily reset), idle (pause-when-AFK).
  // webNavigation intercepts top-frame tracked navigation for the gateway.
  // declarativeNetRequestWithHostAccess removes framing headers only for
  // active, tab-scoped Peek subframes.
  permissions: [
    "storage",
    "tabs",
    "alarms",
    "idle",
    "webNavigation",
    "declarativeNetRequestWithHostAccess",
  ],

  // One universal content script owns clocks, Peek interception, and every
  // tracked-site overlay.
  host_permissions: ["<all_urls>"],

  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.tsx"],
      run_at: "document_start",
      all_frames: true,
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

  // The survey page is opened in a tab via browser.tabs.create + getURL. Listed
  // here so crxjs treats it as an entry HTML and bundles it; web_accessible
  // makes the moz-extension:// URL loadable from a fresh tab.
  web_accessible_resources: [
    {
      resources: [
        "src/survey/index.html",
        "src/gateway/index.html",
      ],
      matches: ["<all_urls>"],
    },
  ],

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
