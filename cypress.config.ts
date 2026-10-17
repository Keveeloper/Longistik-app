import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    // Phone viewport matching the designs (iPhone 14, 390x844)
    viewportWidth: 390,
    viewportHeight: 844,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});