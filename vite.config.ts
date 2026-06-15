import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
server: {
    allowedHosts: ['les-freres-barbiers.signaweb.ca'],
    port: 3001
  },  

plugins: [react(), tailwindcss()],
})
