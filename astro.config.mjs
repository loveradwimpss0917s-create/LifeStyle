// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
// site: 実デプロイ先(Cloudflare Pages)。独自ドメイン取得時はここと src/content/site.json の
// url、public/robots.txt の Sitemap 行の3箇所を変更する(README「オーナーへの引き継ぎ事項」参照)。
export default defineConfig({
  site: 'https://lifestyle-ako.pages.dev',
  trailingSlash: 'always',
  integrations: [mdx(), sitemap()],
  build: {
    inlineStylesheets: 'always'
  }
});