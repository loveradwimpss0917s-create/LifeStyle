/**
 * generate-category-icons.mjs
 * カテゴリー一覧・詳細ページで使う画像を、AI生成写真からBrandSymbolと同じ
 * 線画スタイルのイラストに置き換えるための生成スクリプト。
 * 実行: node scripts/generate-category-icons.mjs
 * 生成物はコミットする(実行はローカルのみ。ビルド時には実行しない)。
 */
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BG = '#F7F6F4';
const STROKE = '#1A1A18';

// 各カテゴリのアイコン(viewBox 0 0 64 64、BrandSymbolと同じ線の太さ・角丸)
const icons = {
  travel: `<rect x="16" y="20" width="32" height="30" rx="4"/>
    <path d="M26 20v-4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/>
    <path d="M16 32h32"/>
    <path d="M24 20v30M40 20v30"/>`,
  parenting: `<path d="M24 12h10"/>
    <path d="M26 12v6c-4 2-6 6-6 10v18a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V28c0-4-2-8-6-10v-6"/>
    <path d="M20 34h18"/>`,
  living: `<path d="M22 10v42"/>
    <path d="M22 36h20"/>
    <path d="M42 36v16"/>`,
  'daily-goods': `<path d="M24 24v-4a8 8 0 0 1 16 0v4"/>
    <path d="M16 24h32l-3 26H19z"/>`,
  appliances: `<path d="M26 10v14M38 10v14"/>
    <rect x="20" y="24" width="24" height="18" rx="4"/>
    <path d="M32 42v4a6 6 0 0 0 6 6h4"/>`,
  coffee: `<path d="M16 22v30h26V22"/>
    <path d="M16 34h26"/>
    <path d="M42 26a7 7 0 0 1 0 14"/>
    <path d="M27 6c-3 3-3 5 0 8"/>`,
  photography: `<rect x="12" y="22" width="40" height="28" rx="4"/>
    <path d="M24 22l3-6h10l3 6"/>
    <circle cx="32" cy="36" r="9"/>`,
};

// カード表示が4:3(CategoryCard.astro)のため960x720で書き出す(実写真の
// 長辺上限1600pxルール内・retina対応)
const CANVAS_W = 960;
const CANVAS_H = 720;
const ICON_HEIGHT = 260; // viewBox高さ(およそ48〜52分)を何pxとして描画するか

function buildIconSvg(body) {
  const scale = ICON_HEIGHT / 56;
  const symbolPx = 64 * scale;
  const tx = (CANVAS_W - symbolPx) / 2;
  const ty = (CANVAS_H - symbolPx) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="${BG}"/>
  <g transform="translate(${tx} ${ty}) scale(${scale})" fill="none" stroke="${STROKE}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    ${body}
  </g>
</svg>`;
}

for (const [key, body] of Object.entries(icons)) {
  const svg = buildIconSvg(body);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const outPath = path.join(ROOT, `src/assets/categories/${key}.png`);
  await writeFile(outPath, png);
  console.log(`generated src/assets/categories/${key}.png`);
}
