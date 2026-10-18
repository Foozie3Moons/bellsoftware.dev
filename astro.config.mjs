import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://bellsoftware.dev',
  integrations: [sitemap(), mdx(), react()],
  build: {
    format: 'directory',
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'tokyo-night',
      },
      wrap: false,
    },
  },
});
