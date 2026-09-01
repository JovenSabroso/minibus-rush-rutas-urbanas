import { defineConfig } from 'vite';

// Configuracion minima de Vite para el prototipo Minibus Rush.
// base: './' permite abrir el build tambien desde archivo local si hiciera falta.
export default defineConfig({
  base: './',
  server: {
    open: true,
  },
});
