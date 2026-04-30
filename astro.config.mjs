import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://bellsoftware.dev',
  integrations: [sitemap()],
  build: {
    format: 'directory',
  },
});
