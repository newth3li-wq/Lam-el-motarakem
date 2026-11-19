import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// `src/pages/Subjects.jsx` and `Landing.jsx` read the official curriculum from
// `app/shared/curriculum.json`, which sits outside the web root. The dev server
// needs explicit permission to serve it; the production build resolves it anyway.
const webRoot = fileURLToPath(new URL('.', import.meta.url));
const shared = fileURLToPath(new URL('../shared/', import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: [webRoot, shared] }
  }
});
