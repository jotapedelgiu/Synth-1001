import { defineConfig } from 'vite';

// No GitHub Pages o site mora em /Synth-1001/; no `npm run dev` fica na raiz
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Synth-1001/' : '/',
}));
