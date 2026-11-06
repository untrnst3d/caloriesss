import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxy = { "/api": env.API_PROXY_TARGET || "http://127.0.0.1:8000" };
  return {
    server: { port: 5173, strictPort: false, proxy },
    preview: { port: 4173, strictPort: false, proxy },
  };
});
