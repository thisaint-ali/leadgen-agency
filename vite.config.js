import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Inject GA4 ID from env var at build time
    // Set VITE_GA4_ID=G-XXXXXXXXXX in Vercel environment variables
    '__GA4_ID__': JSON.stringify(process.env.VITE_GA4_ID || ''),
  },
})
