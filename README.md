# PROJECT HIBISTACK

**AI Affiliate Media Platform**

日々の生活の発信(ストーリー投稿)を起点に、AIがコンテンツ資産へ変換し、
ライフスタイルブランドとして蓄積・収益化するプラットフォーム。

> このリポジトリは `docs/`(設計書)と `src/` 等(実装コード)を同一リポジトリ内で分離管理しています。
> 設計はFableが `docs/` を更新し、実装はSonet(実装エージェント)が `docs/` を読んで `src/` を実装します。
> 設計と実装が食い違った場合は `docs/` を正とし、実装側で矛盾が見つかった場合は構造化して報告します。

## 最重要思想

このプロジェクトは「商品を売るサイト」ではない。
**「人生を記録するライフスタイルブランド」**である。

- 生活そのものがコンテンツになる
- AIはその生活を整理し、価値あるコンテンツへ変換する
- 訪問者は商品ではなく世界観を楽しみに来る
- その結果として自然にアフィリエイト収益が発生する

## 技術スタック(決定事項)

- **フレームワーク**: Astro(静的生成・Content Collections)
- **ホスティング**: Cloudflare Pages
- **コンテンツ管理**: Git(Markdown/JSON as CMS)
- **検索**: Pagefind(ビルド時インデックス)
- **AI**: Claude API(GitHub Actions経由・段階導入)
- **計測**: Cloudflare Web Analytics + 自前クリック計測(将来Workers)

選定理由と比較は [docs/08-tech-architecture.md](docs/08-tech-architecture.md) を参照。

## セットアップ

```sh
# 依存関係のインストール
npm install
```

Node.js 22 以上が必要です(`package.json` の `engines` で強制)。

## 開発

```sh
npm run dev            # ローカル開発サーバー起動(http://localhost:4321)
npm run build          # 本番ビルド(astro build → pagefind インデックス生成 → ./dist/)
npm run preview        # ビルド済みサイトのローカルプレビュー
npx astro check        # 型チェック(コミット前に必ず実行)
npm run check:content  # コンテンツ整合性チェック(07章§7・警告のみ、ビルドは失敗しない)
```

### コンテンツの追加方法

- 商品: `src/content/products/{slug}.md` を追加(`src/content.config.ts` のスキーマに従う)。画像は `src/assets/products/{slug}/`
- 記事: `src/content/articles/{slug}.mdx` を追加。商品を紹介する場合は本文に `<ProductEmbed id="商品slug" note="ひとこと" />` を埋め込む
- カテゴリ・タグ・ブランド: `src/content/{categories,tags,brands}/{slug}.json`
- トップページの「編集部のおすすめ」「特集バンド」は `src/content/site.json` の `editorsPicks` / `pinned` で指定

`status: draft` のままではビルド出力に含まれない(`status: published` + `publishedAt` が必須)。

## CI(.github/workflows/ci.yml)

`main` への push・全PRで以下を自動実行します。

1. `npx astro check`(型チェック)
2. `npm run build`(本番ビルド)
3. `npm run check:content`(07章§7の警告チェック。affiliateリンク未設定・リンク未確認180日超・孤立コンテンツを検出。ビルドは失敗させない)
4. `npx @lhci/cli autorun`(Lighthouse CI。`lighthouserc.json` の設定でホーム・商品・記事ページを計測し、Performance/Accessibility/Best Practices/SEOがいずれも95未満ならCI失敗。01章§4.3の受け入れ基準に対応)

## ディレクトリ構成

```
LifeStyle/
├── docs/            # 設計書(Fableが更新。実装の唯一の正)
├── src/
│   ├── content/     # 商品・記事・カテゴリ等(Content Collections)
│   ├── components/  # base / content / section / island / layout
│   ├── layouts/
│   ├── pages/
│   ├── lib/
│   └── styles/
├── public/
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

詳細は [docs/08-tech-architecture.md](docs/08-tech-architecture.md) §3 を参照。

## Cloudflare Pages へのデプロイ

このサイトは**完全静的サイト**(`astro.config.mjs` に `output`/adapter指定なし=デフォルトの `output: 'static'`)としてビルドされ、`dist/` をそのまま配信します。SSR・Cloudflare Functionsは使用しないため、**`@astrojs/cloudflare` アダプターや `wrangler.toml` は不要**です(V3でクリック計測用Workersを導入する際に別途追加。[docs/08-tech-architecture.md](docs/08-tech-architecture.md) §5)。

### 初回接続手順(Cloudflare Dashboard)

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git** で本リポジトリ(`LifeStyle`)を接続し、本番運用ブランチを指定
2. ビルド設定:

   | 項目 | 値 |
   |---|---|
   | Framework preset | `Astro` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | 未指定(リポジトリ直下がAstroプロジェクトルート) |

3. 環境変数(**Settings → Environment variables**):

   | 変数名 | 値 | 用途 | 設定タイミング |
   |---|---|---|---|
   | `NODE_VERSION` | `22` | ビルドNode.jsバージョン固定(`package.json` の `engines` と一致させる) | 初回デプロイ時に設定推奨 |
   | `PREVIEW` | `true`(Preview環境のみ) | draft/reviewコンテンツもプレビューURLに出力([08章§4](docs/08-tech-architecture.md)) | commit2(Content Collections実装)以降 |
   | `ANTHROPIC_API_KEY` 等 | — | AIパイプライン用。GitHub Actions側で使用し、Pages自体には不要 | V2以降 |

4. **Save and Deploy** で初回ビルドを実行 → `*.pages.dev` の発行URLで公開される
5. 以降は対象ブランチへの `git push` で自動的に再ビルド・再デプロイ。他ブランチ・PRは自動でプレビューURLが発行される
6. 独自ドメイン取得後は Pagesプロジェクトの **Custom domains** で追加し、`astro.config.mjs` の `site` を実ドメインに変更(現在は仮ドメイン `https://lifestack.pages.dev`)

### キャッシュ設定

`public/_headers` に定義済み(ビルド時に `dist/_headers` としてそのまま出力され、Cloudflare Pages標準機能で反映される):

- HTML: `Cache-Control: public, max-age=0, must-revalidate`(コンテンツ更新を即時反映)
- `/_astro/*`(ハッシュ付きビルド成果物): `Cache-Control: public, max-age=31536000, immutable`
- `/pagefind/*`(検索インデックス): `Cache-Control: public, max-age=3600, must-revalidate`

### Wrangler CLIでの手動デプロイ(代替手段)

Dashboard接続の代わりにCLIから直接デプロイする場合:

```sh
npm run build
npx wrangler pages deploy dist --project-name=hibistack
```

静的アセットのみのデプロイのため、この場合も `wrangler.toml` は不要(コマンドライン引数で完結)。

## オーナーへの引き継ぎ事項(公開前に必須)

V1・V2(ブランド刷新・ダークモード等)ともに実装は完了していますが、以下はオーナー本人の対応が必要です(12章§7・20章§11)。

1. **サイト名の確定** — 完了。サイト名は「HIBISTACK」に確定し、`src/content/site.json` の `siteName` 等、`src/layouts/BaseLayout.astro`・`src/lib/seo.ts` の定数、ロゴ表示箇所を含め全箇所を更新済み
2. **独自ドメインの取得・Cloudflare Pages接続** — サイトURLは実デプロイ先 `https://lifestyle-ako.pages.dev` に統一済み(canonical/OGP/sitemap/robots.txtすべてここから導出)。独自ドメイン取得後は `astro.config.mjs` の `site`・`src/content/site.json` の `url`・`public/robots.txt` の `Sitemap:` 行の3箇所を実ドメインに変更する
3. **Yahoo!アフィリエイト登録・各商品へのURL貼り付け** — 各商品Markdownの `affiliate.yahooShopping.url` / `affiliate.yahooTravel.url` に実際のリンクを追加(`checkedAt` も併せて設定)。未設定の間はAffiliateButton・PrLabelは自動的に非表示になる
4. **サンプル写真から実写真への差し替え** — `src/assets/products/` `src/assets/articles/` `src/assets/categories/` `src/assets/site/`(`instagram/` 配下6枚を含む)のプレースホルダーSVGを実写真(JPEG/PNG)に差し替え、各商品・記事・`site.json` の画像パスを更新。AI生成画像を使う場合は19章の運用ルール(`ai-` プレフィックス・alt明記)に従うこと
5. **About・Privacy・Disclosureの文面確認** — `src/pages/about.astro` `src/pages/privacy.astro` `src/pages/disclosure.astro` はドラフトです。特にdisclosure(景表法ステマ規制対応)は法的文面のため、最終的に本人確認のうえ必要に応じて修正してください
6. **Instagram/Threadsのフォロー導線URL確認** — `site.json` の `sns.instagramHome` / `sns.threads` 等は仮のプレースホルダーURL(`https://www.instagram.com/` 等)のままです。トップページのInstagramセクション・Follow CTAで実際に使われるため、公開前に実アカウントのURLへ差し替えてください
7. **ダークモードの見た目の最終確認** — ヘッダー右上(PC)またはメニュー内(モバイル)のアイコンで切り替え可能。実写真差し替え後、写真がダーク背景で浮いて見えないか改めて目視確認することを推奨します(現状は `img { filter: brightness(.92) }` で軽く減光済み)
8. **Cloudflare Web Analyticsの有効化** — 推奨手順は「Web Analyticsにサイトを追加」ではなく**Pagesプロジェクト側のワンクリック有効化**(Web Analytics側のAdd a siteはUIによってはpages.devサブドメインを受け付けないため):
   1. ダッシュボード > **Workers & Pages > (lifestyle-akoプロジェクト) > Metrics** タブ > Web Analytics の **Enable**
   2. 次のデプロイからビーコンJSが自動注入される。デプロイ後にページのソースに `cloudflareinsights.com/beacon.min.js` があるか確認
   3. **自動注入が入らない場合のみ**(Pagesの既知の不安定挙動): Web Analytics > 対象サイト > **Manage site** のスニペットからトークンを取得し、Pagesの環境変数 `PUBLIC_CF_BEACON_TOKEN` に設定 → 再デプロイ(こちらの手動ビーコンは実装済み・`.env.example`参照)
   4. 注意: 自動注入と環境変数の**両方を有効にしない**(二重計測になる)。ソースにビーコンが2つ出ていたら環境変数側を削除

## 設計書の読み方

| # | ドキュメント | 内容 | 主な読者 |
|---|---|---|---|
| 00 | [docs/00-overview.md](docs/00-overview.md) | プロジェクト概要・現状分析・競合分析・戦略提言 | 全員(最初に読む) |
| 01 | [docs/01-requirements.md](docs/01-requirements.md) | 要件定義・MVP定義・スコープ外の明確化 | PM / 実装者 |
| 02 | [docs/02-information-architecture.md](docs/02-information-architecture.md) | 情報設計・サイトマップ・URL設計・分類体系 | 実装者 / SEO |
| 03 | [docs/03-design-system.md](docs/03-design-system.md) | デザイントークン・タイポグラフィ・ブランドガイドライン | UI実装者 |
| 04 | [docs/04-ui-design.md](docs/04-ui-design.md) | 全8画面のワイヤーフレームレベル画面設計 | UI実装者 |
| 05 | [docs/05-ux-design.md](docs/05-ux-design.md) | 6つの主要UXフロー設計 | PM / UI実装者 |
| 06 | [docs/06-component-design.md](docs/06-component-design.md) | 全コンポーネントのProps・状態・使用箇所 | 実装者 |
| 07 | [docs/07-data-model.md](docs/07-data-model.md) | データモデル・ER図・スキーマ定義(Zod) | 実装者 |
| 08 | [docs/08-tech-architecture.md](docs/08-tech-architecture.md) | 技術選定(比較付き)・ディレクトリ構成・ビルド/デプロイ | 実装者 |
| 09 | [docs/09-ai-pipeline.md](docs/09-ai-pipeline.md) | AIコンテンツ生成パイプライン・プロンプト設計 | 実装者 / 運用者 |
| 10 | [docs/10-seo-affiliate.md](docs/10-seo-affiliate.md) | SEO設計・アフィリエイト導線・計測設計 | 運用者 |
| 11 | [docs/11-roadmap.md](docs/11-roadmap.md) | V1〜V4ロードマップ・工数見積・優先順位 | PM |
| 12 | [docs/12-implementation-spec.md](docs/12-implementation-spec.md) | **Sonet向け実装指示書**(受け入れ基準付き) | 実装エージェント |
| 13 | [docs/13-brand-identity.md](docs/13-brand-identity.md) | **HIBISTACKブランド設計**(ストーリー・理念・トーン・ライティングガイド) | 全員 |
| 14 | [docs/14-logo-design.md](docs/14-logo-design.md) | ロゴ・favicon・OGPテンプレート・SVG仕様 | UI実装者 |
| 15 | [docs/15-icon-system.md](docs/15-icon-system.md) | 統一アイコンシステム(造形ルール・一覧) | UI実装者 |
| 16 | [docs/16-design-system-v2.md](docs/16-design-system-v2.md) | デザインシステムv2(ダークテーマ・トークン拡張) | UI実装者 |
| 17 | [docs/17-ui-design-v2.md](docs/17-ui-design-v2.md) | UI設計v2(ヘッダー/フッター/トップ/商品/記事) | UI実装者 |
| 18 | [docs/18-motion-design.md](docs/18-motion-design.md) | モーションデザイン(原則・カタログ・品質基準) | UI実装者 |
| 19 | [docs/19-ai-image-prompts.md](docs/19-ai-image-prompts.md) | AI画像生成プロンプト集(写真素材用・運用ルール) | 運用者 |
| 20 | [docs/20-sonnet-implementation-spec.md](docs/20-sonnet-implementation-spec.md) | **Sonnet向けv2実装指示書**(優先順位・コミット計画・受け入れ基準) | 実装エージェント |
| 21 | [docs/21-current-state-audit.md](docs/21-current-state-audit.md) | **V2完了時点の現状監査**(9軸採点・CTO評価) | 全員(V3の起点) |
| 22 | [docs/22-roadmap-v3.md](docs/22-roadmap-v3.md) | V3ロードマップ(Phase1〜4・機能優先順位S/A/B/C) | PM |
| 23 | [docs/23-monetization-strategy.md](docs/23-monetization-strategy.md) | 収益化戦略(チャネル別・やらないことリスト) | 運用者 |
| 24 | [docs/24-ai-operations.md](docs/24-ai-operations.md) | AI運営戦略(業務別自動化レベルL0〜L3・ガードレール・コスト) | 運用者 |
| 25 | [docs/25-ai-first-cms.md](docs/25-ai-first-cms.md) | AIファーストCMS設計(受信箱アーキテクチャ・段階導入) | PM / 実装者 |
| 26 | [docs/26-sonnet-implementation-spec-v3.md](docs/26-sonnet-implementation-spec-v3.md) | **Sonnet向けV3実装指示書**(次の30コミット・完了条件付き) | 実装エージェント |

