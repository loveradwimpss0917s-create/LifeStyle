# 12. 実装指示書(Sonet向け)— V1 MVP

この文書は実装エージェントへの直接指示である。**この文書と参照先(03/04/06/07/08章)だけで質問なしに実装を開始できる**。判断に迷ったら「デザイン原則(03章§1)」と「優先順位の原則(11章)」に従い、独断で進めてよい。ただし下記の【不変条件】は破らないこと。

## 0. 不変条件(絶対に守る)

1. published コンテンツのビルド出力に draft/review を混ぜない
2. アフィリエイトリンクには常に `rel="nofollow sponsored noopener"` と PrLabel を付ける
3. 全画像に alt(Zodで強制)。コントラスト・フォーカスリング等 03章§5 のa11y基準
4. クライアントJSは island 指定コンポーネント(06章§6.5)以外に追加しない
5. 影・グラデ・彩色ボタン・ポップアップ・無限スクロールは実装しない(03章)
6. コンテンツ(content/配下)とコード(それ以外)の分離を崩さない

## 1. セットアップ手順

```bash
npm create astro@latest lifestack -- --template minimal --typescript strict
cd lifestack
npx astro add mdx sitemap
npm i pagefind @fontsource-variable/... satori sharp   # フォントは03章指定のもの
```

- `astro.config.mjs`: `site` は `src/content/site.json` と同値のURL(仮: `https://lifestack.pages.dev`)。`trailingSlash: 'always'`。sitemap/mdx統合。
- `package.json` scripts: `"build": "astro build && pagefind --site dist"`。
- tsconfig: strict。パスエイリアス `@/*` → `src/*`。

## 2. 実装順序(コミット単位)

1. **foundation**: `styles/tokens.css`(03章§2の値をそのまま)+ `global.css`(reset+base)+ `prose.css` / フォントセルフホスト+サブセット / BaseLayout+Header+Footer+スキップリンク+MobileMenu
2. **content-schema**: `content/config.ts`(07章§4のZodを忠実に)/ categories 7件(02章§3の表)/ tags 10件 / brands 3件 / site.json / `lib/content.ts`(getPublished)
3. **sample-content**: 商品3件+記事2本(review 1・log 1)のリアルなサンプル(プレースホルダ「Lorem」禁止。暮らし系の現実的なダミー: 例「ステンレスキッズボトル」「ドリップケトル」「バスタオル」。写真はUnsplash等のライセンスフリー画像を `src/assets/` に配置し、後で実写真に差し替える前提のファイル名規約: 07章§3)
4. **product-page**: ProductLayout+Gallery(island)+RatingStars+Badge+GoodPoints/ConcernPoints+SpecTable+AffiliateButton+PrLabel+関連セクション(lib/related.ts, lib/product-index.ts)
5. **article-page**: ArticleLayout+Prose+ProductEmbed+Callout+ComparisonTable+RankingItem+「次に読む」/登場商品自動集計
6. **hub-pages**: index(トップ 04章§4.1の8セクション)/ categories/ tags/ ranking(lib/ranking.ts: `rating*10+rankingWeight` 降順)/ products一覧 / articles一覧 / about / 404
7. **search**: `/search/`+Pagefind UI(トークンでスタイル上書き)/ ヘッダー検索アイコン
8. **seo-legal**: `lib/seo.ts`(JSON-LD: Product+Review/Article/BreadcrumbList/ItemList)/ rss.xml / OG画像生成(`og/[...slug].png.ts`: satori、白背景+写真+タイトル+サイト名の定型)/ privacy / disclosure(文面ドラフトも生成してよい。景表法PR表記を含む)
9. **pwa-perf**: manifest.webmanifest+アイコン / Lighthouse CI設定 / 画像priority・preload調整 / ScrollReveal(reduced-motion対応)
10. **ci-deploy**: `.github/workflows/ci.yml`(build+整合性チェック07章§7を実装したスクリプト)/ Cloudflare Pages設定手順をREADMEに記載

各コミット後に `astro build` が通ること。コミットメッセージは `feat(scope): 内容` 形式。

## 3. 主要実装ディテール(判断済み事項)

- **Header**: 高さ64px(M)/72px(D)。`position: sticky`+下スクロールで `transform: translateY(-100%)`(JS 1KB、reduced-motionで無効)。ナビ項目は site.json ではなく categories の order 上位5+Ranking+About 固定ロジック。
- **カード全体リンク**: `.card { position: relative }` + `a.stretched::after { position:absolute; inset:0 }` パターン。カード内の副リンク(タグ等)は `position: relative; z-index: 1`。
- **AffiliateButton の URL 解決**(`lib/affiliate.ts`): `resolve(product, mall)` → URL があれば `{url, label}`、なければ null(呼び出し側で非描画)。URLにはクエリを**付与しない**(Yahoo規約リスク回避。内部計測はV3の /go/ で実施)。`position` は `data-pos` 属性として出力しておく(将来の計測フック)。
- **ランキングページ**: published商品を `rating*10 + rankingWeight` 降順、同点は publishedAt 新しい順。Top10+カテゴリ別Top3。
- **逆引きインデックス**: 全記事の raw MDX を `getCollection` 後に `/<ProductEmbed\s+id="([^"]+)"/g` で走査し `Map<productId, articleSlug[]>` を生成(ビルド時1回・`lib/product-index.ts`)。未知IDは throw(ビルド失敗)。
- **関連ロジック**(`lib/related.ts`): ①frontmatter `related` → ②同カテゴリ新着 → ③同タグ新着 の順で不足分補完、自身は除外、上限まで。
- **OG画像**: 1200×630。左: 記事/商品写真(50%)、右: 白地にタイトル(Zen Kaku Gothic太字・最大3行)+下部にサイト名英字(Cormorant)。フォントはsatoriにサブセットTTFを渡す。
- **Pagefind**: 商品・記事本文のみインデックス(`data-pagefind-body` を Layout に付与、Header/Footer は除外)。タイプバッジは `data-pagefind-meta="type"`。
- **draft プレビュー**: `getPublished()` は `import.meta.env.PUBLIC_PREVIEW === 'true'` のとき draft/review も返す。Cloudflare Pages の preview 環境変数に設定。
- **404**: 静かなトーン+SearchへのリンクとCategoryCard 6枚。

## 4. サンプルデータ要件

- 商品frontmatterは07章スキーマの全必須フィールドを埋める(concernPoints必ず1つ以上)。
- 記事は1本に必ず `<ProductEmbed>` を1つ以上含め、逆引き・登場商品集計・PR表記の動作確認ができること。
- site.json の editorsPicks・pinned にサンプルIDを設定しトップページ全セクションが埋まること。

## 5. Definition of Done(V1全体)

- [ ] 01章 §4.3 の受け入れ基準5項目をすべて満たす
- [ ] `npm run build` 成功・型エラーゼロ・整合性チェック(07章§7)警告の説明が可能
- [ ] Lighthouse(モバイル): Perf/A11y/BP/SEO ≥ 95(サンプル商品ページ・記事ページ・トップで計測)
- [ ] 375px/768px/1280px の3幅でレイアウト崩れなし
- [ ] キーボードのみで全ページ操作可能・フォーカス可視
- [ ] JSオフでも全コンテンツ閲覧可能(検索・ギャラリー切替・お気に入りを除く)
- [ ] README.md にローカル起動・コンテンツ追加手順・Cloudflare Pages接続手順を記載

## 6. 実装しないこと(再掲・V1)

AIパイプライン一式 / お気に入り / ニュースレター / 比較・月齢ページ / ダークモード / コメント / 会員 / 自前計測。これらのための「先回り実装」も行わない(受け口は設計に織り込み済みのため不要)。

## 7. 人間(オーナー)への引き継ぎ事項

実装完了時、以下を README に TODO として明記すること:
1. サイト名確定 → `site.json` の1箇所変更
2. 独自ドメイン取得・Pages接続(`astro.config.mjs` の site も変更)
3. Yahoo!アフィリエイト登録・各商品のURL貼り付け(frontmatter `affiliate.yahooShopping.url`)
4. サンプル写真→実写真への差し替え
5. About・privacy・disclosure の文面確認(法的文面は最終的に本人確認)
