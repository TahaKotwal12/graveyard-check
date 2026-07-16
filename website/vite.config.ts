import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    fs: {
      // The successor dataset is imported straight from the repository root.
      allow: ['..'],
    },
  },
});
