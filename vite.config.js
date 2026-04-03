import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // Usar rutas relativas para que funcione con file://
  server: {
    port: 5174,
    host: '127.0.0.1',
    strictPort: true, // Falla si el puerto 5174 no está disponible
  },
})
