#!/usr/bin/env node
/**
 * コンテンツ整合性チェック — 07章§7
 *
 * 07章§7の5項目のうち、以下2つは既にビルド時のZodスキーマ・コンポーネントで
 * 強制されているため、ここでは扱わない(ビルド自体が失敗する):
 *   1. ProductEmbedのproductIdが存在しない → src/lib/product-index.ts / ProductEmbed.astro が throw
 *   2. published商品の画像0枚・alt欠落 → content.config.ts の Zod スキーマで強制
 *
 * ここでは残り3項目(警告レベル・ビルドは失敗させない)をチェックする:
 *   3. affiliate URL未設定のpublished商品
 *   4. checkedAtが180日超のaffiliateリンク
 *   5. 孤立コンテンツ(どこからもリンクされない商品・記事)
 *
 * Astro Content Layer(astro:content)はVite経由の仮想モジュールのため、
 * astro buildを経由しない素のNodeスクリプトからは読み込めない。そのため
 * 本スクリプトはsrc/content配下のMarkdown/MDX/JSONを直接パースする。
 * (content.config.tsのZodスキーマと二重管理になる項目もあるが、警告レベルの
 * 軽量チェックに留めているため許容している)
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, 'src/content');

function parseFrontmatter(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const data = parseYaml(match[1]) ?? {};
  const body = match[2] ?? '';
  return { data, body };
}

function loadEntries(dir, extension) {
  const dirPath = path.join(CONTENT_DIR, dir);
  return readdirSync(dirPath)
    .filter((f) => f.endsWith(extension))
    .map((f) => {
      const id = f.replace(new RegExp(`${extension}$`), '');
      const { data, body } = parseFrontmatter(path.join(dirPath, f));
      return { id, data, body };
    });
}

const products = loadEntries('products', '.md');
const articles = loadEntries('articles', '.mdx');
const site = JSON.parse(readFileSync(path.join(CONTENT_DIR, 'site.json'), 'utf-8')).main ?? {};

const warnings = [];
const warn = (message) => warnings.push(message);

const publishedProducts = products.filter((p) => p.data.status === 'published');
const publishedArticles = articles.filter((a) => a.data.status === 'published');

// --- 3. affiliate URL未設定のpublished商品 ---
for (const product of publishedProducts) {
  const affiliate = product.data.affiliate ?? {};
  const hasAnyLink = Object.values(affiliate).some((entry) => entry && entry.url);
  if (!hasAnyLink) {
    warn(`[affiliate-missing] 商品 "${product.id}" にアフィリエイトリンクが1件も設定されていません`);
  }
}

// --- 4. checkedAtが180日超のaffiliateリンク ---
const STALE_DAYS = 180;
const now = new Date();
for (const product of products) {
  const affiliate = product.data.affiliate ?? {};
  for (const [mall, entry] of Object.entries(affiliate)) {
    if (!entry?.checkedAt) continue;
    const checkedAt = new Date(entry.checkedAt);
    const ageDays = (now.getTime() - checkedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > STALE_DAYS) {
      warn(
        `[affiliate-stale] 商品 "${product.id}" の ${mall} リンクは${Math.floor(ageDays)}日間未確認です(${STALE_DAYS}日超)。リンク切れ・価格変動を確認してください`
      );
    }
  }
}

// --- 5. 孤立コンテンツ ---
const PRODUCT_EMBED_PATTERN = /<ProductEmbed\s+id="([^"]+)"/g;
const embeddedProductIds = new Set();
for (const article of articles) {
  for (const match of article.body.matchAll(PRODUCT_EMBED_PATTERN)) {
    embeddedProductIds.add(match[1]);
  }
}
const editorsPicks = new Set(site.editorsPicks ?? []);

for (const product of publishedProducts) {
  if (!embeddedProductIds.has(product.id) && !editorsPicks.has(product.id)) {
    warn(
      `[orphan-product] 商品 "${product.id}" はどの記事にも埋め込まれておらず、editorsPicksにも含まれていません(カテゴリ・ランキングページからは到達可能です)`
    );
  }
}

const referencedArticleIds = new Set();
for (const article of articles) {
  for (const ref of article.data.related ?? []) {
    referencedArticleIds.add(ref);
  }
}
const pinnedArticleIds = new Set(Object.values(site.pinned ?? {}));

for (const article of publishedArticles) {
  if (!referencedArticleIds.has(article.id) && !pinnedArticleIds.has(article.id)) {
    warn(
      `[orphan-article] 記事 "${article.id}" は他の記事のrelatedからも site.json の pinned からも参照されていません(記事一覧・カテゴリページからは到達可能です)`
    );
  }
}

// --- レポート出力 ---
if (warnings.length === 0) {
  console.log('[check-content-integrity] 警告なし。すべてのコンテンツが整合しています。');
} else {
  console.warn(`[check-content-integrity] ${warnings.length}件の警告があります(ビルドは失敗させません):`);
  for (const w of warnings) console.warn('  - ' + w);
}

// 警告のみで exit code は常に 0(07章§7: これらはビルド失敗対象ではない)
process.exit(0);
