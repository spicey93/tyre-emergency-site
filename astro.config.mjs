import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tyreemergencyltd.co.uk',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'auto'
  },
  integrations: [sitemap()],
});
