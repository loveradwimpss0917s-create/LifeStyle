# 06. コンポーネント設計

実装は Astro コンポーネント(`.astro`)。JSが必要なものだけ島(island)としてクライアントJSを持つ(明記)。
命名は PascalCase。配置は `src/components/{layer}/`(layer: base / content / section / island)。

## 6.1 レイヤー構造

| レイヤー | 役割 | JS |
|---|---|---|
| base | 最小単位(Button, Tag, Icon…) | なし |
| content | コンテンツ表示単位(ProductCard, ArticleCard…) | なし |
| section | ページセクション(Hero, RankingList…) | なし |
| island | インタラクティブ(Search, FavoriteButton, MobileMenu, Gallery) | あり(最小) |
| layout | ページ骨格(BaseLayout, Header, Footer) | なし |

## 6.2 base コンポーネント

### Button
```
Props:
  variant: 'primary' | 'secondary' | 'text'   // primary=墨色塗り, secondary=1px罫線, text=下線リンク風
  size: 'md' | 'lg'                            // md=44px, lg=52px height
  href?: string                                // あれば<a>、なければ<button>
  external?: boolean                           // true→ target=_blank + rel付与
  fullWidth?: boolean
Slots: default(ラベル), icon(任意・後置)
状態: hover(背景 --accent-strong or 罫線濃), focus-visible(2pxリング), disabled(opacity .4)
```

### AffiliateButton(Buttonの特化ラッパー)
```
Props:
  product: Product              // 商品エンティティ
  mall: 'yahoo-shopping' | 'yahoo-travel' | 'amazon' | 'rakuten'  // V1はyahoo系のみ
  position: string              // 計測用 'product_header' | 'product_footer' | 'article_embed'
挙動:
  - product.affiliate[mall].url が無ければ何も描画しない(ビルド時に警告ログ)
  - rel="nofollow sponsored noopener" target="_blank"
  - ラベル自動: 'Yahoo!ショッピングで見る' 等(mall→ラベルのmap)
  - 直下に <PrLabel /> を必ず描画
```

### PrLabel
`Props: なし`。「※本サイトはアフィリエイト広告を利用しています」小テキスト+ `/disclosure/` リンク。

### TagChip
```
Props: tag: Tag, size?: 'sm'|'md'
描画: <a href="/tags/{slug}/"> #表示名。背景 --bg-tertiary, radius-sm
```

### RatingStars
```
Props: rating: 1|2|3|4|5, showNumber?: boolean
描画: ★をSVGで(--color-star)。aria-label="おすすめ度 4/5"
```

### Badge
`Props: label: string`。使用期間(「使用6ヶ月」)・記事タイプ(「Ranking」)表示用。1px罫線・小文字。

### SectionHeader
```
Props: labelEn: string(例 'Journal'), labelJa?: string(例 '最新の記事'), href?: string(「すべて見る」)
描画: 英字(Cormorant・tracking-wide)+和名+右端に→リンク
```

### Icon
`Props: name: 'search'|'menu'|'close'|'heart'|'heart-filled'|'arrow-right'|'external'|'star'|'instagram'|'youtube'|'tiktok'|'threads'|'check'|'minus', size?: number`
実装: 単一SVGスプライト。ストローク1.5px・currentColor。

### Breadcrumb
`Props: items: {label, href?}[]`。JSON-LD BreadcrumbList も同時出力。

### Pagination
`Props: current, total, basePath`。前へ/次へ+ページ番号。1ページなら非描画。

### Callout
`Props: なし(slot)`。記事内メモ。左罫線 2px アクセント色+背景 --bg-secondary。

### Prose
`Props: なし(slot)`。Markdown本文のタイポグラフィスコープ(h2/h3/p/ul/figure/blockquote のスタイル一式・行長 --container-text)。

## 6.3 content コンポーネント

### ProductCard
```
Props: product: Product, showRating?: boolean = true, showPrice?: boolean = false
描画: 写真(4:5)/ ブランド名(小)/ 商品名 / RatingStars / (右上に FavoriteButton ※V2)
リンク: カード全体 → /products/{slug}/(stretched-link)
hover: 画像 scale(1.02)
```

### ArticleCard
```
Props: article: Article, variant: 'default' | 'large' | 'compact'
  default: 縦積み(写真3:2/カテゴリラベル/タイトル/日付)
  large:   横組み大判(トップの特集用。D:写真55%+テキスト45%)
  compact: サムネ小+タイトルのみ(「次に読む」リスト用)
```

### CategoryCard
`Props: category: Category`。写真+英字名(Cormorant)+和名。hover: scale。

### FeaturedArticle
`Props: article: Article`。トップ③・カテゴリ③の大判。ArticleCard variant='large' のセクション用ラッパー(背景色帯オプション)。

### ProductEmbed(MDX内で使用)
```
Props: id: string(productId), note?: string(編集ひとこと)
描画: 罫線ボックス内に 写真(小)/商品名/RatingStars/note/AffiliateButton(position='article_embed')
解決: ビルド時に getEntry('products', id)。存在しないIDはビルドエラー(リンク切れ防止)
```

### GoodPoints / ConcernPoints
```
Props: points: string[]
描画: Good→ Icon(check)+項目 / Concern→ Icon(minus)+項目。見出し「良かった点」「気になった点」
```

### SpecTable
`Props: product: Product`。ブランド/カテゴリ/参考価格/購入日/使用期間 の定義リスト(dl)。

### ComparisonTable(MDX内で使用)
```
Props: ids: string[](productId 2〜3), rows: {label: string, values: string[]}[]
描画: 商品写真+名前をヘッダ行に、行ごとの比較値。M: 横スクロール(スクロールヒント影)
```

### RankingItem / RankingList
```
RankingItem Props: rank: number, product: Product, comment?: string
  順位数字(Cormorant・--text-hero)+写真+商品名+RatingStars+講評+テキストリンク
RankingList Props: items: {rank, productId, comment}[], compact?: boolean
```

### ReviewBlock
`Props: product: Product`。商品ページ本文の定型構成(なぜ買ったか/使ってみて/Good/Concern/シーン)をfrontmatterデータから組み立てるアセンブリ。

### SocialLinks
`Props: variant: 'footer' | 'about'`。site.json の SNS URL 配列から描画。

## 6.4 section コンポーネント

### Hero
```
Props: image: ImageMetadata, alt: string, labelEn: string, tagline: string
描画: --container-wide の写真(16:9, priority load)+下部にラベル・タグライン
LCP対策: <Image priority /> + preload
```

### CategoryBand
`Props: category: Category, articles: Article[], products: Product[]`。トップ⑤⑥の特集帯。

### ProductGrid / ArticleGrid
`Props: items[], columns?: 2|3|4`。レスポンシブグリッドのラッパー(gap統一)。

### RelatedArticles / RelatedProducts
`Props: current: entry, limit: number`。関連ロジック(手動related→同カテゴリ→同タグの優先順)はユーティリティ `src/lib/related.ts` に分離。

### AboutTeaser
トップ⑧。site.json から紹介文・写真を取得。

### NewsletterForm(V2)
`Props: なし`。外部サービス(Buttondown)のフォームPOST。JSなし(素のform)。

## 6.5 island コンポーネント(クライアントJSあり)

### SearchPage(`/search/` 専用)
```
実装: Pagefind UI を動的import(client:only)。トークンでスタイル上書き
状態: idle(人気タグ表示)/ searching / results / empty(候補提示)
URLに ?q= を同期(共有可能な検索結果)
```

### MobileMenu
```
client:media="(max-width: 767px)"
ハンバーガー → フルスクリーンオーバーレイ(カテゴリ・主要リンク・SNS)
a11y: dialogパターン(focus trap, Esc close, aria-expanded)
```

### Gallery(商品ページ)
```
client:visible
メイン画像+サムネ列。サムネクリックでメイン切替(フェード200ms)
JS不可時: 全画像縦積み表示にフォールバック(noscript不要のprogressive enhancement)
```

### FavoriteButton(V2)
```
client:load(軽量 vanilla TS・1KB以下)
localStorage 'lifestack:favorites' に productId をtoggle
aria-pressed 管理。ハートは Icon(heart/heart-filled)
```

### FavoritesPage(V2)
`/favorites/` 専用。localStorage → `/api/products-index.json`(ビルド時出力の静的JSON)照合 → ProductCard描画。

### ScrollReveal(演出・任意)
`IntersectionObserver で .reveal に is-visible 付与(1回)。prefers-reduced-motion で無効。全体で3KB以下`

## 6.6 layout

### BaseLayout
```
Props: title, description, ogImage?, jsonLd?, noindex?
含む: <head>一式(メタ/OGP/canonical/フォントpreload/tokens.css)、Header、Footer、スキップリンク、View Transitions
```

### Header / Footer
04章の仕様どおり。Headerのスクロール隠し(下スクロールで隠す)は CSS `animation-timeline: scroll()` が使えない環境向けに軽量JS(1KB)で実装、`prefers-reduced-motion` では固定表示。

## 6.7 コンポーネント使用マトリクス

| コンポーネント | Top | Category | Product | Article | About | Search | Ranking | Favorites |
|---|---|---|---|---|---|---|---|---|
| Hero | ● | | | | ● | | | |
| ProductCard | ● | ● | ●(関連) | ●(登場商品) | | ●(結果) | | ● |
| ArticleCard | ● | ● | ●(逆引き) | ●(関連) | | ●(結果) | | |
| AffiliateButton | | | ● | ●(Embed内) | | | ●(Item内) | |
| RankingList | ● | | | ●(ranking型) | | | ● | |
| Gallery | | | ● | | | | | |
| GoodPoints/Concern | | | ● | | | | | |
| SearchPage | | | | | | ● | | |
| PrLabel | | | ● | ●(条件) | | | ● | |
