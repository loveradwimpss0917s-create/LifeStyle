# PROJECT LIFESTACK

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
npm run dev       # ローカル開発サーバー起動(http://localhost:4321)
npm run build     # 本番ビルド(astro build → pagefind インデックス生成 → ./dist/)
npm run preview   # ビルド済みサイトのローカルプレビュー
npm run astro -- check   # 型チェック(コミット前に必ず実行)
```

コンテンツの追加方法(商品・記事・カテゴリ等)は、`src/content/config.ts` 実装後に本セクションへ追記予定です(commit2以降)。

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
npx wrangler pages deploy dist --project-name=lifestack
```

静的アセットのみのデプロイのため、この場合も `wrangler.toml` は不要(コマンドライン引数で完結)。

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

