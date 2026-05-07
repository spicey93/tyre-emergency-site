import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://tyreemergencyltd.co.uk',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'auto'
  }
});
