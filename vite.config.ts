import { defineConfig } from "vite";

export default defineConfig({
  base: "/open-physics/",
  server: {
    allowedHosts: ["gungbuntu"],
  },
});
