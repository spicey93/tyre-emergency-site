import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://tyreemergency.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'auto'
  }
});
