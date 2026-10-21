import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    // `npm run dev:e2e`: its own mode (.env.e2e) and port, independent of `npm run dev`
    baseUrl: "http://localhost:5174",
    // Phone viewport matching the designs (iPhone 14, 390x844)
    viewportWidth: 390,
    viewportHeight: 844,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});