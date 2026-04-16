import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: "/ycda/",
  plugins: [react()],
  optimizeDeps: { exclude: ["@mlc-ai/web-llm"] },
  worker: { format: "es" },
})
