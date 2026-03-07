import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const DEFAULT_BACKEND_TARGET = "http://127.0.0.1:3000";
const API_PREFIX = "/stc-proj-mgmt/api";

export default defineConfig({
  plugins: [react()],
  root: "./frontend",
  server: {
    proxy: {
      [API_PREFIX]: {
        changeOrigin: true,
        target: process.env.VITE_BACKEND_PROXY_TARGET ?? DEFAULT_BACKEND_TARGET,
      },
    },
  },
});
