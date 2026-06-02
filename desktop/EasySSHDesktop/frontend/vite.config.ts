import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wails from "@wailsio/runtime/plugins/vite";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
    fs: {
      allow: [new URL("../../..", import.meta.url).pathname],
    },
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      {
        find: /^react$/,
        replacement: `${new URL("./node_modules/react", import.meta.url).pathname}`,
      },
      {
        find: /^react-dom$/,
        replacement: `${new URL("./node_modules/react-dom", import.meta.url).pathname}`,
      },
      {
        find: /^react\/jsx-runtime$/,
        replacement: `${new URL("./node_modules/react/jsx-runtime.js", import.meta.url).pathname}`,
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: `${new URL("./node_modules/react/jsx-dev-runtime.js", import.meta.url).pathname}`,
      },
      {
        find: /^react-dom\/client$/,
        replacement: `${new URL("./node_modules/react-dom/client.js", import.meta.url).pathname}`,
      },
      {
        find: /^@easyssh\/ssh-workspace$/,
        replacement: `${new URL("../../../web/packages/ssh-workspace/src/index.ts", import.meta.url).pathname}`,
      },
      {
        find: /^@easyssh\/ssh-workspace\/desktop$/,
        replacement: `${new URL("../../../web/packages/ssh-workspace/src/desktop.ts", import.meta.url).pathname}`,
      },
      {
        find: /^@\//,
        replacement: `${new URL("../../../web/src/", import.meta.url).pathname}`,
      },
    ],
  },
  plugins: [react(), wails("./bindings")],
});
