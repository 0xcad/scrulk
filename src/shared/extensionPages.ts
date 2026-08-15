export const EXTENSION_PAGES = {
  camera: "src/camera/index.html",
  gateway: "src/gateway/index.html",
  survey: "src/survey/index.html",
} as const;

export type ExtensionPage = (typeof EXTENSION_PAGES)[keyof typeof EXTENSION_PAGES];
