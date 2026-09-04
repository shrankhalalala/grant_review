import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (mode === "production" && !env.VITE_API_BASE_URL?.trim()) {
    throw new Error("VITE_API_BASE_URL must be configured for production builds.");
  }
  return {
    plugins: [react()],
    test: {
      fileParallelism: false,
      environment: "jsdom",
      environmentOptions: { jsdom: { url: "http://localhost/" } },
      setupFiles: ["./src/test/setup.ts"],
    },
  };
});
