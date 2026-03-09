import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const DEFAULT_BACKEND_TARGET = "http://127.0.0.1:3000";
const API_PREFIX = "/stc-proj-mgmt/api";
const CURRENT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT_DIRECTORY = path.resolve(CURRENT_DIRECTORY, "..");
const FRONTEND_ROOT_DIRECTORY = CURRENT_DIRECTORY;
const DHTMLX_GANTT_CODEBASE_DIRECTORY = path.resolve(
  PROJECT_ROOT_DIRECTORY,
  "dhtmlx-gantt/codebase",
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@dhtmlx-gantt": DHTMLX_GANTT_CODEBASE_DIRECTORY,
    },
  },
  root: "./frontend",
  server: {
    fs: {
      allow: [
        FRONTEND_ROOT_DIRECTORY,
        DHTMLX_GANTT_CODEBASE_DIRECTORY,
      ],
    },
    proxy: {
      [API_PREFIX]: {
        changeOrigin: true,
        target: process.env.VITE_BACKEND_PROXY_TARGET ?? DEFAULT_BACKEND_TARGET,
      },
    },
  },
});
