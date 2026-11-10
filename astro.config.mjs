// @ts-check
import { defineConfig } from 'astro/config';

import preact from '@astrojs/preact';
import serviceWorker from './integrations/service-worker.mjs';

// Le site est publié par GitHub Pages, sous l'organisation GitHub du jeu (à part du portfolio) :
// https://sinople-jeu.github.io/sinople/
export default defineConfig({
  site: 'https://sinople-jeu.github.io',
  base: '/sinople',
  integrations: [preact(), serviceWorker()],
});