import { defineConfig } from "vite"
import viteCompression from "vite-plugin-compression"
import basicSsl from "@vitejs/plugin-basic-ssl"

// https://vitejs.dev/config/

export default defineConfig({
  publicDir: "public",
  base: "./",
  server: {
    port: 3000,
  },
  plugins: [viteCompression(), basicSsl()],
})
