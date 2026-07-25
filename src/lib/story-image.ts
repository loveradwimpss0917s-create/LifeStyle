/**
 * ストーリー共有用画像生成(satori→PNG)
 *
 * /og/配下のOGP画像(1200×630・白背景+テキストのみ)はTwitter/Facebook/LINE等の
 * リンクプレビュー規格に合わせた横型の定型カードで、これはこれで正しい仕様
 * (docs/12-implementation-spec.md §3)。
 *
 * 一方、ShareRow(17章§5)のネイティブ共有ボタンでファイル添付する画像は
 * Instagramストーリーズ/リールのようなOSの共有シートに渡るものであり、
 * 縦型(9:16)・実写真を主役にした画像でないと「目に留まるインパクト」が
 * 出ず、リーチに繋がらない(実際のユーザーフィードバックにより判明)。
 * そのため、OGPカードとは別に、実写真を全面背景にした1080×1920の
 * ストーリー専用画像をここで生成する。
 *
 * 実写真の取得方法について: content.config.tsのimage()スキーマヘルパーで
 * 解決された article.data.heroImage / product.data.images[0].src は
 * Viteのビルドパイプラインを経由した最終ハッシュ付きパスであり、これらの
 * 静的アセット出力タイミングとsatoriのレンダリングタイミングの整合は
 * リスクが大きい(scripts/check-images.mjs・og-image.tsの既存コメント参照)。
 * そのため本ファイルではcontent側のfrontmatterを直接パースして元画像への
 * 相対パス文字列を取得し、Viteを経由せずファイルシステムから直接
 * sharpで読み込む(scripts/check-content-integrity.mjsと同じ手法)。
 */
import satori from 'satori';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';

const CONTENT_DIR = path.join(process.cwd(), 'src/content');
const CJK_FONT_PATH = path.join(process.cwd(), 'src/assets/fonts/zen-kaku-gothic-new-cjk-400.ttf');
const LATIN_FONT_PATH = path.join(
  process.cwd(),
  'node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff'
);

const WIDTH = 1080;
const HEIGHT = 1920;

let cachedFonts: ReturnType<typeof loadFonts> | undefined;

function loadFonts() {
  return [
    { name: 'Zen Kaku Gothic New', data: readFileSync(CJK_FONT_PATH), weight: 400 as const, style: 'normal' as const },
    { name: 'Cormorant Garamond', data: readFileSync(LATIN_FONT_PATH), weight: 700 as const, style: 'normal' as const },
  ];
}

function parseFrontmatter(filePath: string): Record<string, any> {
  const raw = readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return {};
  return (parseYaml(match[1]) as Record<string, any>) ?? {};
}

/** 記事のヒーロー画像の元ファイルへの絶対パスを、frontmatterを直接パースして取得する */
export function resolveArticleHeroImagePath(articleId: string): string {
  const contentPath = path.join(CONTENT_DIR, 'articles', `${articleId}.mdx`);
  const data = parseFrontmatter(contentPath);
  return path.resolve(path.dirname(contentPath), data.heroImage);
}

/** 商品の1枚目の画像の元ファイルへの絶対パスを、frontmatterを直接パースして取得する */
export function resolveProductImagePath(productId: string): string {
  const contentPath = path.join(CONTENT_DIR, 'products', `${productId}.md`);
  const data = parseFrontmatter(contentPath);
  const firstImage = data.images?.[0]?.src;
  return path.resolve(path.dirname(contentPath), firstImage);
}

/** site.json のヒーロー画像の元ファイルへの絶対パスを取得する(JSONなのでYAML frontmatterではなく直接JSON.parseする) */
export function resolveSiteHeroImagePath(): string {
  const sitePath = path.join(CONTENT_DIR, 'site.json');
  const data = JSON.parse(readFileSync(sitePath, 'utf-8'));
  return path.resolve(path.dirname(sitePath), data.main.heroImage);
}

export interface StoryImageInput {
  title: string;
  categoryLabel?: string;
  sourceImagePath: string;
}

export async function renderStoryImage({ title, categoryLabel, sourceImagePath }: StoryImageInput): Promise<Buffer> {
  if (!cachedFonts) cachedFonts = loadFonts();

  // 縦型9:16へのカバークロップはsatoriではなくsharp側で行う(attention: 被写体の
  // 密度が高い領域を自動検出してクロップ位置を決める。人物・料理写真等で
  // 単純な中央クロップより見切れにくい)。
  const photoBuffer = await sharp(sourceImagePath)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: sharp.strategy.attention })
    .png()
    .toBuffer();
  const photoDataUri = `data:image/png;base64,${photoBuffer.toString('base64')}`;

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: { display: 'flex', width: WIDTH, height: HEIGHT, position: 'relative' },
        children: [
          {
            type: 'img',
            props: {
              src: photoDataUri,
              width: WIDTH,
              height: HEIGHT,
              style: { position: 'absolute', top: 0, left: 0 },
            },
          },
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: WIDTH,
                height: HEIGHT,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: 72,
                // satoriは`to top`等のキーワードを期待通りに解釈しないため、
                // 上から下へのストップ順(0%=上端が透明・100%=下端が最も暗い)で
                // 明示的に指定する。
                background:
                  'linear-gradient(180deg, rgba(20,16,12,0) 0%, rgba(20,16,12,0) 38%, rgba(20,16,12,0.55) 68%, rgba(20,16,12,0.88) 100%)',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      fontFamily: 'Cormorant Garamond',
                      fontSize: 34,
                      letterSpacing: 6,
                      textTransform: 'uppercase',
                      color: '#E8C99B',
                    },
                    children: categoryLabel ?? 'HIBISTACK',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      marginTop: 28,
                      fontFamily: 'Zen Kaku Gothic New',
                      fontSize: 68,
                      lineHeight: 1.35,
                      color: '#FFFFFF',
                    },
                    children: title,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      marginTop: 44,
                      fontFamily: 'Cormorant Garamond',
                      fontSize: 30,
                      letterSpacing: 6,
                      color: 'rgba(255,255,255,0.82)',
                    },
                    children: 'HIBISTACK',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    { width: WIDTH, height: HEIGHT, fonts: cachedFonts }
  );

  return sharp(Buffer.from(svg)).png().toBuffer();
}
