import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [{
    name: 'vesper-preview',
    apply: 'serve',
    transformIndexHtml() {
      return [{ tag: 'script', children: 'window.__VESPER_DEV__ = true;', injectTo: 'head-prepend' }];
    },
  }],
});
