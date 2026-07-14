# PROJECT LIFESTACK

**AI Affiliate Media Platform — 設計書 v1.0**

日々の生活の発信(ストーリー投稿)を起点に、AIがコンテンツ資産へ変換し、
ライフスタイルブランドとして蓄積・収益化するプラットフォームの詳細設計。

> このリポジトリは現時点では**設計フェーズ**です。コードは含まれません。
> `docs/` 配下の設計書は、AI実装エージェント(Sonet)が質問なしで実装を開始できる粒度で記述されています。

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
