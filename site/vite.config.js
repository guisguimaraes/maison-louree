import { defineConfig } from 'vite';

// caminhos relativos: o site funciona em qualquer endereço
// em desenvolvimento, /api vai para o servidor local (npm run servidor)
export default defineConfig({
  base: './',
  server: { proxy: { '/api': 'http://localhost:3000' } },
  // duas páginas: a home e a história
  build: { rollupOptions: { input: { main: 'index.html', historia: 'historia.html' } } },
});
