/**
 * generate-brand-icons.mjs — 14章§6/§7
 * BrandSymbol(角丸矩形+中線)から favicon/Apple Touch Icon/PWAアイコンを再生成する。
 * 実行: node scripts/generate-brand-icons.mjs
 * 生成物はコミットする(実行はローカルのみ。ビルド時には実行しない)。
 */
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BG = '#F7F6F4';
const STROKE = '#1A1A18';

// symbolHeightPx: rect(高さ48/64viewBox)を何pxとして描画するか
function buildIconSvg({ canvas, bg, symbolHeight, stroke }) {
  const scale = symbolHeight / 48;
  const symbolPx = 64 * scale;
  const t = (canvas - symbolPx) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}">
  ${bg ? `<rect width="${canvas}" height="${canvas}" fill="${bg}"/>` : ''}
  <g transform="translate(${t} ${t}) scale(${scale})" fill="none" stroke="${stroke}" stroke-width="5" stroke-linecap="round">
    <rect x="16" y="8" width="32" height="48" rx="7"/>
    <path d="M16 32h32"/>
  </g>
</svg>`;
}

const targets = [
  { file: 'public/icons/apple-touch-icon.png', canvas: 180, bg: BG, symbolHeight: 96 },
  { file: 'public/icons/icon-192.png', canvas: 192, bg: BG, symbolHeight: 192 * 0.54 },
  { file: 'public/icons/icon-512.png', canvas: 512, bg: BG, symbolHeight: 512 * 0.54 },
  { file: 'public/icons/icon-512-maskable.png', canvas: 512, bg: BG, symbolHeight: 512 * 0.4 },
  { file: 'public/icons/favicon-48.png', canvas: 48, bg: null, symbolHeight: 34 },
];

for (const t of targets) {
  const svg = buildIconSvg({ ...t, stroke: STROKE });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const outPath = path.join(ROOT, t.file);
  await writeFile(outPath, png);
  console.log(`generated ${t.file} (${t.canvas}x${t.canvas})`);
}
