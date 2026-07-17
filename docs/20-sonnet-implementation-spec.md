# 20. Sonnet Implementation Specification — HIBISTACK v2

> 実装エージェント(Sonnet)向けの完全実装指示書。13〜19章が設計の正、本書は実装の正。
> V1(12章)は実装・検証済み。**本書はV1の上に積む差分実装であり、V1の再実装ではない。**
> 迷ったら: 設計と実装が食い違う場合は docs/ を正とし、矛盾は構造化して報告(README冒頭の原則)。

## 0. 前提(現状の実装状態)

- Astro 7 静的出力 / Cloudflare Pages(`dist/`直配信・アダプタ不要)/ Pagefind / satori OGP / GitHub Actions CI(astro check → build → check:content → LHCI 0.95)
- サイト名HIBISTACK反映済み。tokens.cssはWCAG実測済みライトテーマ+`--text-3xl-mobile`まで導入済み
- カードのline-clamp+min-height、Gallery縦横比保持(width指定のみ)、`:global()`によるIconスタイル修正まで完了

## 1. 実装優先順位

### High(ブランドの顔・全ページ影響)
1. ブランド文言更新(タグライン差替)
2. ロゴ導入(favicon / apple-touch-icon / PWAアイコン / フッターシンボル / OGPテンプレート)
3. デザイントークンv2(モーショントークン・シャドウ・ダークテーマ変数)
4. ダークモード(初期化スクリプト・切替UI・両テーマ実測検証)
5. アイコンシステム拡張(15章の新規アイコン)

### Medium(主要ページ体験)
6. ヘッダーv2(blur・テーマ切替ボタン・メニュー内テーマ行)
7. フッターv2(シンボル+3群ナビ+英語タグライン行)
8. 商品ページ: RecommendFor化・Sticky CTA・同カテゴリ比較表
9. 記事ページ: 目次・読了プログレス・シェア行・figure/引用スタイル
10. トップ: Hero文言+初回演出・Instagramセクション・Follow CTA

### Low(磨き込み)
11. View Transitionsの商品画像morph(`transition:name`)
12. Back to Top
13. 検索結果プレースホルダー / favicon PNGフォールバック
14. 比較表の自動生成条件調整・季節Hero差替え運用整備

## 2. コミット単位(この順で。各コミットで `astro check`+`build`+`check:content` を通すこと)

| # | コミット | 内容 | 受け入れ基準 |
|---|---|---|---|
| c1 | `feat(brand): タグライン・ブランド文言をHIBISTACK正式版へ更新` | site.json(tagline/taglineEn/description)、Hero文言、フッター文言、About文言を13章に合わせる | 全ページで旧タグライン非表示。build成功 |
| c2 | `feat(brand): ロゴシステム導入` | favicon.svg差替(14章§6)、`scripts/generate-brand-icons.mjs`新規+PNG群再生成、`src/components/base/BrandSymbol.astro`新規(currentColorのインラインSVG)、og-image.tsへシンボル追加(14章§8) | favicon/タッチアイコンが新シンボル。OGP画像目視確認(dist/og/*.pngをRead) |
| c3 | `feat(tokens): デザイントークンv2` | tokens.cssへ §16の shadow/motion トークン+`html[data-theme='dark']`ブロック追加 | ライト表示に回帰なし(スクリーンショット比較) |
| c4 | `feat(theme): ダークモード` | BaseLayout head最上部にis:inline初期化スクリプト、theme-color meta×2、ThemeToggle.astro新規(ヘッダーPC+モバイルメニュー内)、img brightness規定 | 両テーマ×主要5ページでLighthouse a11y 100実測。VT遷移後もトグル動作(rerunパターン) |
| c5 | `feat(icons): アイコンシステム拡張` | Icon.astroへ15章の新規アイコン追加(arrow系はrotate共通化) | astro check通過。既存アイコン変更なし |
| c6 | `feat(header,footer): ヘッダー/フッターv2` | 17章§1§2。blur+shadow-sm、テーマ切替配置、フッター再構成(シンボル・3群・英語タグライン) | スクロール挙動維持。キーボード操作でメニュー・トグル完結 |
| c7 | `feat(product): 商品ページv2` | RecommendFor.astro新規(本文のh2「こんな人におすすめ/合わないかも」をレイアウト側で装飾するのではなく、ReviewBlock後段に構造化表示するコンポーネント。データ源は本文継続=07章スキーマ変更なし)、StickyCta.astro新規(17章§4.2)、ComparisonAuto(同カテゴリ2商品以上で表示) | Sticky CTAが主CTA可視時に出ない/文末CTA可視で消える。CLS 0 |
| c8 | `feat(article): 記事ページv2` | Toc.astro(自動生成+sticky/details)、ReadingProgress.astro、ShareRow.astro、figure/blockquoteスタイル | 目次アンカー動作・現在地ハイライト・navigator.share分岐 |
| c9 | `feat(home): トップv2` | Hero初回演出、site.jsonへinstagramフィールド追加+InstagramGrid.astro、FollowCta.astro | 演出はVT再訪で再生しない。reduced-motionで即時表示 |
| c10 | `feat(motion): モーション磨き込み` | 2.7 morph、Back to Top、ボタンactive scale、テーマ切替トランジション | 18章§4の品質基準(transform/opacityのみ・will-change3箇所以内) |
| c11 | `chore(quality): 両テーマ最終検証` | 両テーマ×モバイル/デスクトップのLighthouse実測、lighthouserc.jsonへダークテーマ計測追加検討、README更新 | 4カテゴリ0.95以上維持(実測値をコミットメッセージに記録) |

## 3. コンポーネント一覧

### 新規
`base/BrandSymbol.astro` `base/ThemeToggle.astro` `content/RecommendFor.astro` `content/StickyCta.astro` `content/Toc.astro` `content/ReadingProgress.astro` `content/ShareRow.astro` `section/InstagramGrid.astro` `section/FollowCta.astro`

### 変更
`Icon.astro`(アイコン追加) `Header.astro` `Footer.astro` `MobileMenu.astro` `Hero.astro` `BaseLayout.astro`(テーマ初期化・meta) `ProductLayout.astro` `ArticleLayout.astro` `pages/index.astro` `lib/og-image.ts` `styles/tokens.css` `styles/global.css` `content.config.ts`(siteスキーマにinstagram追加・optional)

### 新規ファイル(非コンポーネント)
`public/favicon.svg`(差替) `public/icons/*.png`(再生成) `scripts/generate-brand-icons.mjs` `src/assets/instagram/`(プレースホルダー6枚)

## 4. CSS構成

- 階層は現状維持: `tokens.css`(変数の正)→ `global.css`(reset+基本要素)→ 各コンポーネントscoped style
- ダークテーマは `html[data-theme='dark']` の変数上書きのみで実現(コンポーネント側にダーク分岐を書かない)
- 子コンポーネントへ渡すclassのスタイルは必ず `:global()`(既知バグの再発防止)
- 新規CSS合計は+8KB(圧縮前)以内を目安

## 5. Astro構成の遵守事項(V1で実証済みの落とし穴)

1. content configは `src/content.config.ts`(ルート)。zは `astro/zod` からimport
2. VT後に動くスクリプト: `is:inline data-astro-rerun` + IIFE + **プレーンJS**(TS構文はブラウザに届く)+ 再バインド/多重実行ガード
3. ビルド時Nodeから読むファイルパスは `process.cwd()` 基準(import.meta.url不可)
4. `<Image>` はアスペクト比を保つ場合widthのみ指定。トリミングしたい場合のみwidth+height
5. satoriはWOFF2不可。日本語は統合TTF(`src/assets/fonts/README.md`)
6. 実測が正: 性能・コントラストは必ずLighthouse/スクリーンショットで確認してからコミット

## 6. アクセシビリティ(受け入れ基準)

- 両テーマ全ページ Lighthouse a11y 100
- テーマ切替: `aria-label` 状態反映+キーボード操作可+`prefers-color-scheme` 初期尊重
- Sticky CTA/TOC/プログレスバーがタブ順を乱さない。TOCは `<nav aria-label="目次">`
- 44×44pxタップターゲット、`:focus-visible` リング統一
- reduced-motion で全モーション無効(18章)

## 7. SEO(17章§6準拠)

- 構造化データは現行(Product+Review/Article/Breadcrumb/ItemList)維持。ダークモードは構造化データ非影響
- meta theme-color両対応、canonical/OGPは現行ロジック維持(OGP画像テンプレートのみ更新)
- 目次アンカーid付与、シェアURLはcanonical
- 見出し階層検査をc11で全ページ再確認

## 8. 画像・アイコン・ロゴ

- ロゴ/アイコンはすべてSVG・currentColor(14/15章)。AI画像は19章の運用ルール(`ai-`プレフィックス+alt明記)
- 実写真: 長辺1600px以下・元ファイルはjpg、最適化はAstroに委任。LCP画像のみ eager+fetchpriority=high
- Instagramプレースホルダーは19章プロンプトで生成、正方形640×640

## 9. Cloudflare Pages対応

- 変更不要(静的のまま)。`_headers` キャッシュ設定は現行維持
- ダークモード初期化はインラインスクリプトのためエッジ側の対応不要
- プレビューURLで両テーマの見た目確認をデプロイ前チェックに追加(README「開発」節に追記)

## 10. Lighthouse / Core Web Vitals

| 項目 | 予算 |
|---|---|
| スコア | 4カテゴリ×両テーマ×3ページ(home/product/article)で95以上(CIは現行0.95維持) |
| LCP | デスクトップ1.5s以内 / モバイル(スロットル)2.5s目標 ※実写真ページは既知の重さあり(該当コミット参照)。改善はfetchpriority+サイズ上限で図り、未達なら実測値を正直に記録 |
| CLS | 0(モーションは領域確保済みのtransform/opacityのみ) |
| JS追加 | 本仕様全体で+6KB(圧縮後)以内。外部ライブラリ追加禁止 |
| フォント | 現行の単一WOFF2構成を変更しない(V1の性能事故の教訓) |

## 11. 報告

各コミット完了時に: 変更ファイル・実測結果(Lighthouse数値/スクリーンショット確認内容)・設計との差異(あれば理由)を記録。
全完了時に: コミット一覧・残課題(Low未着手分)・オーナー引き継ぎ事項の更新(README)。

---
*Sonnet Implementation Specification — HIBISTACK v2 / 設計: Fable(13〜19章)/ 本書が実装順序と受け入れ基準の正。*
