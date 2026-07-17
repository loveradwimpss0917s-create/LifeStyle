/**
 * OGP画像生成(satori→PNG)
 * 出典: docs/12-implementation-spec.md §3(OG画像: 1200×630、白背景+タイトル+サイト名の定型)
 *
 * 12章は「写真+タイトル+サイト名」の構成を想定しているが、Astroのビルド時アセット
 * パイプライン(画像最適化の出力先)とsatoriの実行タイミングを整合させる複雑さ・リスクを
 * 避けるため、V1ではテキストのみの定型カード(カテゴリ+タイトル+サイト名)とする。
 * 写真合成はV2以降の課題とする。
 *
 * 日本語フォントについて: satoriはTTF/OTF/WOFFのみ対応(WOFF2非対応)。
 * @fontsource/zen-kaku-gothic-new はブラウザのunicode-range配信を前提に120以上の
 * サブセットWOFFに分割されており、satoriはunicode-rangeを解釈しないためそのままでは
 * 日本語グリフを解決できない(空pathになることを確認済み)。そのため事前にfonttoolsで
 * 全サブセットを1つのTTFへ統合したファイルを使用する(src/assets/fonts/README.md参照)。
 */
import satori from 'satori';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// import.meta.url は Vite バンドル後にチャンクの出力先(dist/.prerender/chunks/...)を
// 指してしまい相対パスが壊れるため、ビルド実行時のプロジェクトルート(process.cwd())を
// 基準にした絶対パスで解決する。
const CJK_FONT_PATH = path.join(
  process.cwd(),
  'src/assets/fonts/zen-kaku-gothic-new-cjk-400.ttf'
);
const LATIN_FONT_PATH = path.join(
  process.cwd(),
  'node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff'
);

let cachedFonts: ReturnType<typeof loadFonts> | undefined;

function loadFonts() {
  return [
    {
      name: 'Zen Kaku Gothic New',
      data: readFileSync(CJK_FONT_PATH),
      weight: 400 as const,
      style: 'normal' as const,
    },
    {
      name: 'Cormorant Garamond',
      data: readFileSync(LATIN_FONT_PATH),
      weight: 700 as const,
      style: 'normal' as const,
    },
  ];
}

export interface OgImageInput {
  title: string;
  categoryLabel?: string;
}

export async function renderOgImage({ title, categoryLabel }: OgImageInput): Promise<Buffer> {
  if (!cachedFonts) cachedFonts = loadFonts();

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: 1200,
          height: 630,
          padding: 80,
          background: '#FFFFFF',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      position: 'relative',
                      width: 24,
                      height: 36,
                      border: '4px solid #1A1A18',
                      borderRadius: 6,
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex',
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: '50%',
                            height: 4,
                            marginTop: -2,
                            background: '#1A1A18',
                          },
                        },
                      },
                    ],
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      fontFamily: 'Cormorant Garamond',
                      fontSize: 28,
                      letterSpacing: 4,
                      textTransform: 'uppercase',
                      color: '#8A6D4B',
                    },
                    children: categoryLabel ?? 'HIBISTACK',
                  },
                },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                fontFamily: 'Zen Kaku Gothic New',
                fontSize: 56,
                lineHeight: 1.4,
                color: '#1A1A18',
              },
              children: title,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                fontFamily: 'Cormorant Garamond',
                fontSize: 32,
                letterSpacing: 6,
                color: '#1A1A18',
              },
              children: 'HIBISTACK',
            },
          },
        ],
      },
    },
    { width: 1200, height: 630, fonts: cachedFonts }
  );

  return sharp(Buffer.from(svg)).png().toBuffer();
}
