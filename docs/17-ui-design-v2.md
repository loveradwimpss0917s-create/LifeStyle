# 17. UI設計 v2 — ヘッダー / フッター / トップ / 商品 / 記事

> 04章のV1画面設計を継承し、HIBISTACK正式版として拡張する。実装済み構造は壊さず、差分を積む。

## 1. ヘッダー

### 1.1 構成

```
PC(≥1024px) 高さ72px:
[HIBISTACK] ── [旅行 子育て 暮らし 日用品 家電] ── [Ranking] [search] [sun/moon]

Tablet/Mobile(<1024px) 高さ64px:
[HIBISTACK] ──────────────── [search] [menu]
```

- ワードマークは常時表示・改行禁止(14章§9)
- テーマ切替は PC=ヘッダー直置き / <1024px=モバイルメニュー内(ヘッダーのアイコンを3つ以上並べない)
- 検索アイコンは `/search/` へ遷移(モーダル化しない。04章踏襲)

### 1.2 スクロール挙動(実装済み+追加)

| 状態 | 挙動 |
|---|---|
| 最上部 | 背景 --color-bg・下線なし |
| 8pxスクロール後 | 下線(--border-thin)+ --shadow-sm + 背景を `color-mix(in srgb, var(--color-bg) 92%, transparent)` + `backdrop-filter: blur(8px)`(非対応ブラウザは不透明bgへフォールバック) |
| 下スクロール | ヘッダー退場(translateY(-100%)・350ms)— 実装済み |
| 上スクロール | 再表示 — 実装済み |

スクリプトは既存パターン厳守: `is:inline data-astro-rerun` + IIFE + プレーンJS + 重複バインドガード。

### 1.3 モバイルメニュー(既存MobileMenuを拡張)

フルスクリーンオーバーレイ(実装済み)に以下を追加:
カテゴリ一覧(既存)→ Ranking / About / 検索 → **テーマ切替行**(sun/moon+ラベル「ダークモード」)→ SNSアイコン行。
開閉アニメーションは opacity+8px上昇の350ms(18章)。フォーカストラップは実装済みを維持。

## 2. フッター

```
┌────────────────────────────────────────┐
│ [シンボル32px]                                            │
│ HIBISTACK                                                 │
│ 日々の暮らしを、少しだけ豊かにする。                       │
│                                                           │
│ カテゴリ         コンテンツ        アバウト                │
│ 旅行            記事一覧          About                   │
│ 子育て          商品一覧          プライバシーポリシー      │
│ 暮らし          ランキング        アフィリエイト・PR表記    │
│ …               検索                                      │
│                                                           │
│ [instagram] [instagram] [youtube] [tiktok] [threads]      │
│ ───────────────────────────────────────│
│ © 2026 HIBISTACK          Stacking better days.           │
└────────────────────────────────────────┘
```

- 背景: --color-bg-secondary(現行踏襲)。上端に --border-thin
- ブランドブロックにシンボルロゴを初導入(サイト内で「日」マークを学習させる場所)
- SNSは既存SocialLinksを流用しアイコン行として配置
- 最下段: 左に©、右に英語タグライン(Cormorant Italic・--text-xs・tertiary)
- モバイルは1カラム縦積み(ブランド→ナビ3群→SNS→法務)

## 3. トップページ

セクション順(V1の8構成を拡張。「世界観→鮮度→商品→分類→深掘り→人格→接点」の物語順):

| # | セクション | 内容 | 状態 |
|---|---|---|---|
| ① | Hero | フルブリード写真+タグライン「日々の暮らしを、少しだけ豊かにする。」に差替。初回ロード演出(18章§3) | 文言変更 |
| ② | Journal 新着記事 | ArticleCard×3 | 実装済み |
| ③ | Editor's Picks 人気商品 | FeaturedArticle+ProductCard×4。「人気」=編集部選定(13章§8) | 実装済み |
| ④ | Explore カテゴリ | CategoryCard×6 | 実装済み |
| ⑤⑥ | 特集バンド(旅行/子育て) | pinned記事+商品 | 実装済み |
| ⑦ | Best Picks ランキング | RankingList Top5 → /ranking/ | 実装済み |
| ⑧ | Instagram(新規) | 正方形サムネ6枚(2×3/6×1)+「@handle をフォローする」外部リンク。画像は `site.json` に `instagram: { handle, images[6] }` を追加し手動更新(API連携はV3) | 新規 |
| ⑨ | About導線 | 既存AboutTeaser | 実装済み |
| ⑩ | Follow CTA(新規) | 「日々の記録は、InstagramとThreadsで。」+SNSボタン2つ。**NewsletterはV2**(11章ロードマップ通り)のため、V1はSNSフォローを唯一の登録系CTAとする。Newsletter UIの先行実装は行わない | 新規 |

- 各セクションは `.reveal`(ScrollReveal)対象。1画面に同時に出現させる要素は3つまで(stagger 80ms)

## 4. 商品ページ

V1構造(パンくず→ギャラリー+情報→Review→GoodPoints/ConcernPoints→SpecTable→文末CTA→登場記事→関連商品)を維持し、以下を追加:

### 4.1 追加要素

| 要素 | 仕様 |
|---|---|
| おすすめする人/しない人 | 本文の「こんな人におすすめ/合わないかも」を、check/minusアイコン付きの2カラムカード(--bg-secondary面)としてコンポーネント化 `RecommendFor.astro`。frontmatter化はせず本文Markdownの見出し規約で継続(AIパイプラインの生成単位と一致させるため) |
| 比較 | 同カテゴリ商品が2つ以上ある場合のみ「同カテゴリで比較」表(商品名/評価/使用期間/価格/リンク)を関連商品セクション上に自動生成。1商品しかない間は非表示 |
| Sticky CTA(モバイル) | 下記§4.2 |

### 4.2 Sticky CTA(<768pxのみ)

```
┌──────────────────────────┐
│ 商品名(1行省略)   [Yahoo!ショッピングで見る] │ 高さ64px+safe-area
└──────────────────────────┘
```

- 出現条件: 商品ヘッダー内の主CTAボタンがビューポート上方へ消えたら表示(IntersectionObserver)。文末CTAが見えたら非表示(重複CTAを見せない)
- 出現動作: translateY(100%)→0・350ms。`prefers-reduced-motion` では即時表示
- 背景: --color-bg + 上線 + --shadow-sm。`padding-bottom: env(safe-area-inset-bottom)`
- `role="complementary"` `aria-label="購入リンク"`。PR表記はバー内に小サイズで含める(景表法上、リンク近接表示を維持)
- 「CTAは主1+文末1まで」の原則(00章§6)に対し、Sticky CTAは主ボタンの**代替表示**(同時に見えない)であり追加とは数えない — この解釈を明文化する

## 5. 記事ページ

読みやすさ最優先。V1構造に以下を追加:

| 要素 | 仕様 |
|---|---|
| 目次(TOC) | h2/h3から自動生成。≥1024px: 本文右に sticky(top: ヘッダー+32px)・現在地をIntersectionObserverでハイライト(accent色・線1本)。<1024px: 本文冒頭に `<details>` 折りたたみ「目次」 |
| 読了プログレス | ビューポート最上部に高さ2pxのバー(accent色)。記事本文要素の読了率で伸長。`position: fixed`・JSはrAFでthrottle。reduced-motionでも表示可(動きではなく情報のため)だがtransitionは無効 |
| 画像 | `<figure>`+`<figcaption>`(キャプションはxs/tertiary/中央揃え)。本文幅超えの見せ場画像は `--container-wide` まで拡幅可(1記事2枚まで) |
| 引用 | 左線2px(--color-accent)+イタリックにしない(和文)+出典行(xs/tertiary) |
| SNSシェア | 記事末尾に1行: 「X」「LINE」「リンクをコピー」。モバイルは `navigator.share` があればネイティブ共有を優先。追跡パラメータは付けない |
| 記事末CTA | 「次に読む」1本(実装済み)の直前に、登場商品がある場合のみ商品カード横スクロール(実装済み)。CTAは1方向のみ(13章§7.4) |
| Back to Top | 2画面分スクロール後に右下へ出現(circle 44px・chevron-up)。フッター到達で非表示。<768pxではSticky CTAと重なるため記事ページのみ表示 |

## 6. SEOに関わるUI規定(12章・10章の実装を継承)

- h1は全テンプレートで1つ(実装済み)。見出し階層スキップ禁止(visually-hidden h2で担保済み)
- パンくず+BreadcrumbList JSON-LD全下層(実装済み)
- 目次アンカーは `id` を見出しテキストからslug化(日本語のままURLエンコード可。手動id指定があれば優先)
- シェアURLは常にcanonical(末尾スラッシュ付き)を使用
- Instagramセクションの画像はサイト内アセット(外部埋め込みスクリプト禁止=CLS/LCP保護)

## 7. アクセシビリティ規定(全画面共通)

- フォーカス順はDOM順。sticky要素(ヘッダー/CTA/TOC)がフォーカスを奪わない
- `:focus-visible` で --color-focus 2pxリング統一(マウス時は非表示)
- テーマ切替・メニュー・ギャラリーサムネ等の状態は `aria-pressed` / `aria-expanded` / `aria-current` で表現(一部実装済み)
- タップターゲット最小44×44px
- 目次・シェア行はnav/list構造でスクリーンリーダーに提示
- コントラスト: 両テーマでWCAG AA(4.5:1)実測必須。装飾テキスト(透かし等)はaria-hidden+コントラスト対象外の色を使わない(404での既知の教訓)
