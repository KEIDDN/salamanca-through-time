import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // three.js alone is ~600 kB; the 3D chunk is lazy-loaded behind the intro
  build: { chunkSizeWarningLimit: 1200 },
})
