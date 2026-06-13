import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  define: {
    // Dev:  API at localhost:3000
    // Prod: API on same domain at /api (served by Express on same port)
    'import.meta.env.VITE_API_URL': mode === 'production'
      ? JSON.stringify('/api')
      : JSON.stringify('http://localhost:3000/api'),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router"],
          axios: ["axios"],
        },
      },
    },
  },
  base: "/",
}));
