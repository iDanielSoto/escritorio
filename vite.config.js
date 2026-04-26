import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  base: './', // Usar rutas relativas para que funcione con file://
  server: {
    port: 5174,
    host: '127.0.0.1',
    strictPort: true, // Falla si el puerto 5174 no está disponible
  },
})
