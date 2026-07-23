#!/usr/bin/env node
/**
 * 画像規約チェック — 26章c28(20章§10・19章§3)
 *
 * src/assets配下のラスター画像(jpg/jpeg/png/webp)について3つを警告する
 * (check-content-integrity.mjsと同じく警告レベル・ビルドは失敗させない):
 *   1. 長辺1600px超(20章§10「実写真: 長辺1600px以下」)
 *   2. ファイルサイズ1MB超
 *   3. `ai-`プレフィックス画像で、参照元コンテンツのalt文言に
 *      「イメージ写真」が含まれない(19章§3のAI生成画像運用ルール)
 *
 * 1・2は`ai-`プレフィックス画像には適用しない。19章§2.1のHero等、AI生成画像は
 * 実写真より大きいターゲットサイズ(例: Hero 1920×1080)が個別に規定されて
 * おり、20章§10の「実写真」は撮影した実写真のみを指すため。
 * SVGはベクター(サイズ無制限で軽量)なのでチェック対象外。
 *
 * astro:contentはVite経由の仮想モジュールのため素のNodeスクリプトからは
 * 読み込めない(scripts/check-content-integrity.mjsと同じ制約)。そのため
 * src/content配下のMarkdown/MDX/JSONを直接パースしてalt文言を突合する。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import sharp from 'sharp';

const ROOT = process.cwd();
const ASSETS_DIR = path.join(ROOT, 'src/assets');
const CONTENT_DIR = path.join(ROOT, 'src/content');

const MAX_LONG_SIDE = 1600;
const MAX_BYTES = 1024 * 1024;
const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const REQUIRED_AI_ALT_SUBSTRING = 'イメージ写真';

function listImageFiles(dir) {
  return readdirSync(dir, { recursive: true })
    .map((f) => path.join(dir, f))
    .filter((f) => {
      try {
        return statSync(f).isFile() && RASTER_EXTENSIONS.has(path.extname(f).toLowerCase());
      } catch {
        return false;
      }
    });
}

function parseFrontmatter(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return {};
  return parseYaml(match[1]) ?? {};
}

/**
 * `ai-`プレフィックス画像の絶対パス → その画像を参照しているコンテンツの
 * alt文言一覧、のMapを作る(1つの画像を複数箇所が参照するケースを許容)。
 */
function collectAiImageAlts() {
  const altsByAbsPath = new Map();

  function register(assetRelativeFromContentFile, contentFileDir, alt) {
    if (!assetRelativeFromContentFile || alt === undefined) return;
    const absPath = path.resolve(contentFileDir, assetRelativeFromContentFile);
    const list = altsByAbsPath.get(absPath) ?? [];
    list.push(alt);
    altsByAbsPath.set(absPath, list);
  }

  const productsDir = path.join(CONTENT_DIR, 'products');
  for (const f of readdirSync(productsDir).filter((name) => name.endsWith('.md'))) {
    const filePath = path.join(productsDir, f);
    const data = parseFrontmatter(filePath);
    const dir = path.dirname(filePath);
    for (const scene of data.scenes ?? []) register(scene.image, dir, scene.alt);
    for (const img of data.images ?? []) register(img.src, dir, img.alt);
  }

  const articlesDir = path.join(CONTENT_DIR, 'articles');
  for (const f of readdirSync(articlesDir).filter((name) => name.endsWith('.mdx'))) {
    const filePath = path.join(articlesDir, f);
    const data = parseFrontmatter(filePath);
    register(data.heroImage, path.dirname(filePath), data.heroAlt);
  }

  const siteData = JSON.parse(readFileSync(path.join(CONTENT_DIR, 'site.json'), 'utf-8')).main ?? {};
  register(siteData.heroImage, CONTENT_DIR, siteData.heroAlt);
  register(siteData.author?.image, CONTENT_DIR, siteData.author?.imageAlt);
  for (const img of siteData.instagram?.images ?? []) register(img.src, CONTENT_DIR, img.alt);

  const categoriesDir = path.join(CONTENT_DIR, 'categories');
  for (const f of readdirSync(categoriesDir).filter((name) => name.endsWith('.json'))) {
    const filePath = path.join(categoriesDir, f);
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    register(data.image, categoriesDir, data.imageAlt);
  }

  return altsByAbsPath;
}

const warnings = [];
const warn = (message) => warnings.push(message);

const imageFiles = listImageFiles(ASSETS_DIR);
const aiAlts = collectAiImageAlts();

for (const filePath of imageFiles) {
  const relPath = path.relative(ROOT, filePath);
  const isAiImage = path.basename(filePath).startsWith('ai-');

  if (!isAiImage) {
    const { size } = statSync(filePath);
    if (size > MAX_BYTES) {
      warn(`[size] ${relPath} は${(size / 1024 / 1024).toFixed(2)}MBです(上限1MB・20章§10)`);
    }
    const metadata = await sharp(filePath).metadata();
    const longSide = Math.max(metadata.width ?? 0, metadata.height ?? 0);
    if (longSide > MAX_LONG_SIDE) {
      warn(`[dimension] ${relPath} は長辺${longSide}pxです(上限${MAX_LONG_SIDE}px・20章§10「実写真」)`);
    }
  } else {
    const alts = aiAlts.get(filePath) ?? [];
    if (alts.length === 0) {
      warn(`[ai-alt] ${relPath} を参照しているコンテンツが見つからず、alt文言を確認できません`);
    } else if (!alts.every((alt) => alt.includes(REQUIRED_AI_ALT_SUBSTRING))) {
      warn(`[ai-alt] ${relPath} のalt文言に「${REQUIRED_AI_ALT_SUBSTRING}」が含まれていません(19章§3)`);
    }
  }
}

if (warnings.length === 0) {
  console.log('[check-images] 画像規約に違反するファイルはありませんでした。');
} else {
  console.log(`[check-images] ${warnings.length}件の警告があります(ビルドは失敗させません):`);
  for (const w of warnings) console.log(`  - ${w}`);
}

process.exit(0);
