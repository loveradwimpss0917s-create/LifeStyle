// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
// site: 仮ドメイン。将来オーナーの独自ドメイン取得時に要変更（README TODO参照）。
export default defineConfig({
  site: 'https://lifestack.pages.dev',
  trailingSlash: 'always',
  integrations: [mdx(), sitemap()]
});