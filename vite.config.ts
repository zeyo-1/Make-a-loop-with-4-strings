import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base を './' にしておくと、GitHub Pages のリポジトリ名が何であっても動く
export default defineConfig({
  base: './',
  plugins: [react()],
});
