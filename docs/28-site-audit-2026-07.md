# 28. サイト監査・改善設計書(2026-07)

> 監査実施日: 2026-07-28 / 監査対象: 本番相当ビルド(`npm run build` 済みの `dist/`)
> 調査方法: 全41ページの静的HTML実測 + Playwright(iPhone相当 390×844)での実機描画確認。
> 本書は実装担当が「追加の判断なしに」着手できることを目的とした仕様書。
> 抽象的な指示は置かず、対象ファイル・変更内容・受け入れ基準を明記する。

---

## 3-1. サマリー

### 総合点: 63 / 100

| # | 評価軸 | 点 | 根拠(実測) |
|---|---|---|---|
| 1 | 初見の印象・ビジュアル | 8 | 明朝ロゴ・余白・写真の扱いが一貫。モバイルで横スクロール崩れゼロ(全9ページ実測) |
| 2 | ナビゲーション・情報設計 | 5 | 空カテゴリ(子育て)がヘッダーナビにあり、コンテンツのあるコーヒーがナビに無い。空カテゴリページは見出し直後がフッター |
| 3 | 記事コンテンツ品質 | 4 | 6記事中4記事が264〜1523字。H3ゼロ・`seo.description`なし |
| 4 | SEO技術面 | 6 | 構造化データ・canonical・sitemap・RSSは整備済み。一方トップtitleが9字でキーワード無し、Aboutにh1が無い |
| 5 | モバイル体験 | 7 | 崩れなし・本文17px。ランキングのみ本文幅152pxで3〜4行折返し |
| 6 | 収益導線・CVR設計 | 6 | 商品ページはStickyCTAあり。記事ページには無い。旧4記事に締めのCTAが無い |
| 7 | ランキング/診断の機能性 | 6 | 診断4問→商品3件提示まで動作確認済み。記事への導線が無い |
| 8 | コンバージョンファネル | 6 | 記事→商品→購入は成立。トップ→診断の導線が存在しない |
| 9 | 信頼性・透明性 | 7 | PR表記の自動表示・disclosure・privacyは十分。Aboutが510字と薄い |
| 10 | パフォーマンス・技術的健全性 | 8 | WebP+densities、Pagefind、内部リンク切れゼロ。ビルド0エラー |

### 最優先で直すべき上位5項目

1. **課題1**: 空カテゴリ「子育て」がヘッダーナビを占有し、記事のある「コーヒー」がナビから漏れている(回遊の入口が壊れている)
2. **課題3**: 記事4本が最低文字数2500字を大きく下回る(264字/380字/833字/1523字)— 検索評価・滞在時間の根幹
3. **課題2**: 空カテゴリページに代替導線が無く、訪問者が行き止まりになる
4. **課題5**: Aboutページに`<h1>`が存在せず、見出し階層がh2から始まる(SEO・アクセシビリティ)
5. **課題6**: トップページの`<title>`が「HIBISTACK」9文字のみで、検索語を一切含まない

### 現状維持でよい強み(壊さないこと)

- **写真の自然表示レイアウト**(Gallery/商品ページ)— オーナー承認済みの「最も高い写真に高さを固定し自然に中央寄せ」仕様。余白が広く見えるのは意図通りであり、詰めてはいけない。
- **PR表記の自動挿入**(`ProductEmbed`使用時に`PrLabel`が自動表示)— 手動での二重挿入を追加しないこと。
- **構造化データ一式**(WebSite/Organization/Person/Article/BreadcrumbList)— 実測で全ページ出力済み。
- **モバイルの無崩れ**(9ページで`scrollWidth === innerWidth`)— レイアウト変更時は必ず再確認。
- **落ち着いた配色・明朝ロゴ・押し売りしないCTA文言** — 本書の提案はいずれもこのトーンを変更しない。

### 記事別の品質実測(評価軸3の内訳)

| 記事 | 本文字数 | H2 | H3 | seo.desc | 判定 |
|---|---|---|---|---|---|
| iwatani-aburiya-2-review | 2685 | 6 | 15 | あり | 基準達成 |
| aeropress-go-review | 2521 | 6 | 15 | あり | 基準達成 |
| fufu-kyoto-family-trip | 1523 | 4 | 0 | なし | 要改稿 |
| nordic-paper-cord-dining-chair-review | 833 | 3 | 0 | なし | 要改稿 |
| nahe-shopper-m-first-look | 380 | 3 | 0 | なし | 要改稿 |
| eufy-solocam-s340-review | 264 | 3 | 0 | なし | 要改稿 |

---

## 3-2. 課題ごとの設計シート

---

## 課題 1: 空カテゴリがヘッダーナビを占有し、記事のあるカテゴリが漏れている

- 対象ページ/コンポーネント: `src/lib/nav.ts` / `src/components/layout/Header.astro`(影響は全ページ共通ヘッダー)
- 優先度: 高
- 影響する評価軸: 2(ナビゲーション・情報設計)、8(ファネル)

### 現状

`src/lib/nav.ts` の `getPrimaryCategoryNav()` は、カテゴリを `order` 昇順に並べ **無条件で上位5件** を返す実装(`all.slice(0, 5)`)。
その結果、デスクトップのヘッダーナビは以下になっている(実測):

| order | slug | 表示名 | 記事数 | 商品数 | ヘッダー |
|---|---|---|---|---|---|
| 1 | travel | 旅行 | 1 | 1 | 表示 |
| 2 | parenting | 子育て | **0** | **0** | **表示** |
| 3 | living | 暮らし | 2 | 2 | 表示 |
| 4 | daily-goods | 日用品 | 1 | 1 | 表示 |
| 5 | appliances | 家電 | 1 | 1 | 表示 |
| 6 | coffee | コーヒー | **1** | **1** | **非表示** |
| 7 | photography | 写真 | 0 | 0 | 非表示 |

つまりナビは「中身が0件の子育て」を載せ、「記事も商品もあるコーヒー」を載せていない。

### 問題点

- 訪問者がヘッダーの「子育て」を押すと、記事0件の空ページに着地して回遊が止まる(課題2と連鎖)。
- 逆に、AeroPress Goのレビューがあるコーヒーカテゴリへは、ヘッダーから到達できない。フッターとモバイルメニューにしか導線がない。
- 「上位5件」という固定ロジックのため、今後コーヒーの記事を増やしても自動では表示されない。

### 改善案(実装レベル)

`src/lib/nav.ts` を次のとおり変更する。

1. `getOrderedCategoryNav()` を、記事数・商品数を数えられるよう `articles` / `products` コレクションも読むように拡張する。
2. `getPrimaryCategoryNav()` の実装を「`order`昇順のうち、**公開済みの記事または商品が1件以上あるカテゴリ**だけを対象にして先頭5件」に変更する。件数の判定には既存の `getPublished()`(`src/lib/content.ts`)を使い、下書きを数に含めないこと。
3. `getAllCategoryNav()`(フッター・モバイルメニュー用)は**現状のまま全件返す**。仕様変更しない。

```ts
// src/lib/nav.ts — getPrimaryCategoryNav の置き換え後の挙動
// ・公開記事 or 公開商品が1件以上あるカテゴリのみを候補にする
// ・その候補を order 昇順に並べ、先頭5件を返す
// ・候補が5件未満ならその件数だけ返す(空要素で埋めない)
```

この変更により、現時点のヘッダーは `旅行 / 暮らし / 日用品 / 家電 / コーヒー` の5件になる(子育て・写真は0件のため除外される)。

### 受け入れ基準(Done の定義)

- [ ] `npm run build` 後、`dist/index.html` の `<header>` 内リンクに `/categories/coffee/` が含まれる
- [ ] 同じく `<header>` 内リンクに `/categories/parenting/` と `/categories/photography/` が含まれない
- [ ] `dist/index.html` の `<footer>` 内リンクには従来どおり7カテゴリすべてが含まれる(フッターは変更しない)
- [ ] モバイルメニュー(`MobileMenu.astro`)にも従来どおり7カテゴリすべてが含まれる
- [ ] `npx astro check` が0エラー

### 優先度の根拠

修正は1ファイル・数十行で完結する一方、ヘッダーは全41ページに表示されるため影響範囲が最大。かつ「空ページへ誘導している」という体験上の実害が現に発生している。工数小・効果大のため最優先。

---

## 課題 2: 空カテゴリページに代替導線が無く行き止まりになる

- 対象ページ/コンポーネント: `src/pages/categories/[slug].astro`(現象は `/categories/parenting/` と `/categories/photography/`)
- 優先度: 高
- 影響する評価軸: 2(情報設計)、8(ファネル)

### 現状

`src/pages/categories/[slug].astro` は、記事セクション・商品セクションをいずれも `{ 配列.length > 0 && (...) }` で条件描画している。0件時のフォールバックが実装されていない。

`/categories/photography/` をモバイル390px幅で実際に描画した結果:
カテゴリ画像 → 「Photography」→「写真」→ リード文「日常を切り取るための、少しの道具と考え方。」まで表示された直後、**次に現れるのはサイトフッター**。本文領域に一切のリンクもテキストも無い。

### 問題点

- 訪問者は「準備中なのか、壊れているのか」を判断できず、離脱する以外の選択肢が無い。
- 検索エンジンから見て中身の無いページであり、インデックスされると全体の品質評価を下げる。
- 課題1を修正してもフッター・モバイルメニュー・`/categories/` 一覧からは依然として到達できるため、課題1とは別に対処が必要。

### 改善案(実装レベル)

`src/pages/categories/[slug].astro` に、記事0件かつ商品0件のときだけ描画する空状態セクションを追加する。挿入位置は、`categoryProducts` の条件ブロックの直後・関連タグセクションの前。

```astro
{categoryArticles.length === 0 && categoryProducts.length === 0 && (
  <section class="container category-section category-empty">
    <p class="category-empty__text">
      このカテゴリの記事は、いま準備しています。公開までもう少しお待ちください。
    </p>
    <p class="category-empty__links">
      <a href="/articles/">記事一覧を見る</a>
      <a href="/ranking/">実際に使って良かったものランキング</a>
    </p>
  </section>
)}
```

スタイルは同ファイルの `<style>` 末尾に追加する。既存トークンのみを使い、新色は追加しない。

```css
.category-empty__text {
  font-size: var(--text-base);
  color: var(--color-ink-secondary);
}
.category-empty__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-top: var(--space-5);
}
```

あわせて、空カテゴリを検索インデックスから外す。`BaseLayout` は既に `noindex` プロパティを受け取れるため、`<BaseLayout>` 呼び出しに次を追加する。

```astro
noindex={categoryArticles.length === 0 && categoryProducts.length === 0}
```

### 受け入れ基準(Done の定義)

- [ ] `dist/categories/photography/index.html` に文字列「このカテゴリの記事は、いま準備しています。」が含まれる
- [ ] 同ファイルに `/articles/` と `/ranking/` へのリンクが `<main>` 内に存在する
- [ ] 同ファイルに `<meta name="robots" content="noindex` が出力される
- [ ] `dist/categories/living/index.html`(記事2件)には空状態のテキストが**含まれない**、かつ `noindex` が**出力されない**
- [ ] `npm run build` が成功する

### 優先度の根拠

行き止まりページの解消はユーザー体験上の実害を直接取り除く。実装は1ファイル20行程度で、既存の描画ロジックに触れずに追記できるためリスクが低い。

---

## 課題 3: 記事4本が最低文字数2500字を大きく下回る

- 対象ページ/コンポーネント: `src/content/articles/eufy-solocam-s340-review.mdx` / `nahe-shopper-m-first-look.mdx` / `nordic-paper-cord-dining-chair-review.mdx` / `fufu-kyoto-family-trip.mdx`
- 優先度: 高
- 影響する評価軸: 3(記事品質)、4(SEO)、6(購買意欲)、8(ファネル)

### 現状

本文(frontmatter・見出し・MDXコンポーネントを除いた地の文)の実測字数:

- `eufy-solocam-s340-review`: **264字** / H2=3 / H3=0
- `nahe-shopper-m-first-look`: **380字** / H2=3 / H3=0
- `nordic-paper-cord-dining-chair-review`: **833字** / H2=3 / H3=0
- `fufu-kyoto-family-trip`: **1523字** / H2=4 / H3=0

たとえば `eufy-solocam-s340-review` は「使い始めたきっかけ」「使ってみて感じたこと」「気になっている点」の3見出しに各1〜2段落があるのみで、H3による小見出しは1つも無い。
一方、編集長基準で改稿済みの2本は 2685字 / 2521字、H2=6・H3=15 で構成されている。

### 問題点

- `docs/27-editorial-workflow.md` の編集長基準は「700〜1000文字の短文記事は禁止。最低2500文字」と定めており、4本がこの基準に違反している。
- H3が無いため記事内の目次(`Toc.astro`)が機能せず、長文化しても読者が構造を掴めない。
- 使用レビューの必須フェーズ(開封→第一印象→1日→1週間→1か月→継続理由)がどの記事にも存在せず、E-E-A-Tの根拠になる一次情報が不足している。

### 改善案(実装レベル)

**この課題は実装担当が単独で完結できない。** 本文の増量には、オーナー(きのこ)への追加ヒアリングで得た一次情報が必須であり、体験を創作してはならない。

そのため次の手順を守る。

1. 記事1本につき、`docs/27-editorial-workflow.md` の**ライタープロンプト §3「書く前に必要な情報」**の7項目をオーナーに質問する。質問はまとめて1回で行い、回答を得るまで本文を書き始めない。
2. 回答を得たら、同ドキュメントの①ライター→②編集長の二段階で改稿する。
3. 改稿後の構成は、既に基準を満たしている `iwatani-aburiya-2-review.mdx` を参照実装とする(H2=6、各H2にH3を2〜3個)。
4. 各記事に `seo.description`(120字以内)を追加する — 詳細は課題4。
5. 各記事の末尾に、商品ページ・カテゴリ・ランキングへの内部リンクを置く — 詳細は課題9。
6. `updatedAt` を改稿日に更新する。`publishedAt` は変更しない。

改稿の着手順は、字数が少なく伸びしろの大きい順とする:
`eufy-solocam-s340-review` → `nahe-shopper-m-first-look` → `nordic-paper-cord-dining-chair-review` → `fufu-kyoto-family-trip`

### 受け入れ基準(Done の定義)

記事1本ごとに、以下すべてを満たすこと。

- [ ] 本文の地の文が2500字以上(見出し・frontmatter・MDXコンポーネントを除いて計測)
- [ ] H2が4〜6個、各H2の直下にH3が2〜4個
- [ ] 1文が60字以内(全文機械チェック)
- [ ] 1段落が4文以内(全文機械チェック)
- [ ] `voice.md` の `bannedWords` / `avoidWords` に該当する語が0件
- [ ] frontmatterに `seo.description` があり120字以内
- [ ] 記事末尾に `/products/{slug}/`・実在カテゴリ・`/ranking/` への内部リンクがある
- [ ] `npx astro check` と `npm run build` が0エラー
- [ ] 11項目×10点の自己採点を実施し、全項目8点以上であることを報告してからcommitする

### 優先度の根拠

サイトの資産は記事そのものであり、6本中4本が基準未達という状態は他のどの改善よりも検索評価・滞在時間への影響が大きい。ただしオーナーのヒアリング待ちが発生するため、着手は課題1・2(即日完了可能)の後に置く。

---

## 課題 4: 4記事に `seo.description` が無く、リード文が流用されている

- 対象ページ/コンポーネント: 課題3と同じ4記事のfrontmatter
- 優先度: 高
- 影響する評価軸: 4(SEO技術面)

### 現状

`src/content.config.ts` の `articles` スキーマは `seo.description`(120字以内)を任意項目として持つ。
改稿済み2記事は設定済みだが、残り4記事は未設定で、`lead` がそのまま `<meta name="description">` に使われている。

実測値:

- `nahe-shopper-m-first-look`: description = 「軽くてたくさん入って、見た目も可愛い。使い始めたばかりの実感をまとめました。」(38字)
- `nordic-paper-cord-dining-chair-review`: 43字
- `eufy-solocam-s340-review`: 46字
- `fufu-kyoto-family-trip`: 51字

### 問題点

- 38〜51字は検索結果のスニペット枠(全角60〜80字相当)を使い切れておらず、表示領域を空けたまま機会損失している。
- `lead` は「記事内で読者を引き込む文」であり、「検索結果で選ばれる文」とは目的が異なる。商品名・比較対象・判断軸といった検索語が入っていない。

### 改善案(実装レベル)

4記事のfrontmatterに `seo.description` を追加する。文字数は**全角60〜120字**に収め、次の3要素を必ず含める。

1. 商品名(検索される表記)
2. 使用期間または使用状況
3. 記事で分かること(良い点だけでなく気になる点にも触れる)

課題3の改稿と同時に行う場合は、改稿後の内容に合わせて書く。改稿前に先行して入れる場合は、既存本文の範囲で書ける以下を初期値として使ってよい(創作した事実を含めないこと)。

```yaml
# eufy-solocam-s340-review.mdx
seo:
  description: "eufy SoloCam S340を1年半使った本音のレビュー。ソーラー充電で電池切れしない使い勝手と、気になった点までまとめました。"

# nahe-shopper-m-first-look.mdx
seo:
  description: "HIGHTIDEのエコバッグ「naheショッパーM」を使ってみた記録。軽さと収納力、メッシュ外ポケットの使い勝手を正直にまとめました。"

# nordic-paper-cord-dining-chair-review.mdx
seo:
  description: "北欧ペーパーコードダイニングチェアを1ヶ月使ったレビュー。軽さと座り心地、掃除ロボットとの相性、気になった点までまとめました。"

# fufu-kyoto-family-trip.mdx
seo:
  description: "赤ちゃん連れでふふ京都に一泊した記録。南禅寺そばの宿で子連れに助かった点と、気をつけたい点を正直にまとめました。"
```

### 受け入れ基準(Done の定義)

- [ ] 4記事すべてのfrontmatterに `seo.description` がある
- [ ] いずれも全角120字以内(スキーマ違反があれば `astro check` が落ちるため必ず確認)
- [ ] `dist/articles/{slug}/index.html` の `<meta name="description">` が新しい文言に変わっている
- [ ] 6記事の `<meta name="description">` に重複が無い
- [ ] `npm run build` が0エラー

### 優先度の根拠

frontmatterへの追記のみで完了し、オーナーの追加情報を必要としない(既存本文の事実の範囲で書ける)。課題3の改稿を待たずに単独で先行実施でき、検索結果の見え方に直接効く。

---

## 課題 5: Aboutページに `<h1>` が存在しない

- 対象ページ/コンポーネント: `src/pages/about.astro`(`/about/`)
- 優先度: 高
- 影響する評価軸: 4(SEO技術面)、9(信頼性)

### 現状

`/about/` の生成HTMLを解析した結果、`<h1>` の抽出結果が **0件**。
ページはパンくず → ヒーロー画像 → `<p class="about-hero__tagline">日々の暮らしを、少しだけ豊かにする。</p>` と続き、最初の見出しが `<h2>わたしについて` になっている。
他の主要ページ(`/ranking/`「Best Picks」、`/quiz/`「おすすめ診断」、`/search/`「検索」など)にはすべて `<h1>` がある。Aboutだけが欠落している。

### 問題点

- 見出し階層がh2から始まっており、HTMLの見出し構造として不正。スクリーンリーダー利用者がページの主題を取得できない。
- Aboutは運営者の実在性を担保するE-E-A-Tの中心ページでありながら、そのページ自身が「何のページか」を示す最上位見出しを持っていない。
- タグラインが `<p>` で置かれているため、視覚的には見出しに見えるが機械的には本文として扱われている。

### 改善案(実装レベル)

`src/pages/about.astro` のヒーローセクションに `<h1>` を追加する。既存のタグライン `<p>` は残し、その**上**に配置する。

変更前:

```astro
<section class="about-hero container-wide">
  <div class="about-hero__media">
    <Image src={site.data.heroImage} alt={site.data.heroAlt} width={1440} priority />
  </div>
  <p class="about-hero__tagline">{site.data.tagline}</p>
</section>
```

変更後:

```astro
<section class="about-hero container-wide">
  <div class="about-hero__media">
    <Image src={site.data.heroImage} alt={site.data.heroAlt} width={1440} priority />
  </div>
  <h1 class="about-hero__heading">HIBISTACKについて</h1>
  <p class="about-hero__tagline">{site.data.tagline}</p>
</section>
```

スタイルは同ファイルの `<style>` に追加する。既存の `.about-hero__tagline` より一段大きくし、他ページの `.page-heading` と視覚的な重さを揃える。

```css
.about-hero__heading {
  margin-top: var(--space-5);
  font-size: var(--text-2xl);
  color: var(--color-ink);
}
```

あわせて `<BaseLayout title="About">` を `title="HIBISTACKについて"` に変更する(`<title>` は `HIBISTACKについて | HIBISTACK` になる)。

### 受け入れ基準(Done の定義)

- [ ] `dist/about/index.html` に `<h1` が1個だけ存在し、内容が「HIBISTACKについて」である
- [ ] `<h1>` が最初の `<h2>`(わたしについて)よりHTML上で前に出現する
- [ ] `dist/about/index.html` の `<title>` が `HIBISTACKについて | HIBISTACK` である
- [ ] 390px幅でAboutを表示し、横スクロールが発生しない(`scrollWidth === innerWidth`)
- [ ] `npm run build` が0エラー

### 優先度の根拠

1ファイル4行の追加で、SEO・アクセシビリティ両面の明確な欠陥が解消する。工数最小・効果明確。

---

## 課題 6: トップページの `<title>` が「HIBISTACK」のみで検索語を含まない

- 対象ページ/コンポーネント: `src/pages/index.astro` / `src/layouts/BaseLayout.astro`
- 優先度: 高
- 影響する評価軸: 4(SEO技術面)

### 現状

`dist/index.html` の `<title>` は **`HIBISTACK`(9文字)**。
`BaseLayout.astro` 30行目に `const pageTitle = title === siteName ? title : \`${title} | ${siteName}\`;` があり、トップだけは意図的にサイト名単独になる実装。
`<meta name="description">` は「旅・子育て・暮らしの記録から生まれた、小さなライフスタイルマガジン。」(34字)。

### 問題点

- ブランド名を既に知っている人しか検索で到達できない。「暮らし レビュー」「買ってよかった」等の一般検索語がtitleに1つも含まれていない。
- descriptionも34字と短く、スニペット枠を使い切れていない。
- 現状サイトには被リンクも指名検索も乏しいため、ブランド名単独titleの利点(ブランド想起)が働かない。

### 改善案(実装レベル)

`src/pages/index.astro` の `<BaseLayout>` 呼び出しを次のように変更する。`BaseLayout.astro` 側のロジックは変更しない(トップ以外への副作用を避けるため)。

変更前:

```astro
<BaseLayout
  title="HIBISTACK"
  description={homeDescription}
  jsonLd={jsonLd}
>
```

変更後:

```astro
<BaseLayout
  title="HIBISTACK | 実際に使って良かったものだけを、正直に"
  description="実際に購入して使ったものだけを、良い点も気になる点も正直にレビューしています。旅行・子育て・暮らし・日用品・家電・コーヒーの記録。"
  jsonLd={jsonLd}
>
```

`title` に既に `| HIBISTACK` 相当が含まれるため、`BaseLayout` の三項演算子の条件(`title === siteName`)には一致せず `HIBISTACK | 実際に使って良かったものだけを、正直に | HIBISTACK` と二重になる。これを避けるため、`BaseLayout.astro` 30行目を次に置き換える。

```ts
const pageTitle = title.startsWith(siteName) ? title : `${title} | ${siteName}`;
```

この変更後、トップは `HIBISTACK | 実際に使って良かったものだけを、正直に`、他ページは従来どおり `{title} | HIBISTACK` になる。

### 受け入れ基準(Done の定義)

- [ ] `dist/index.html` の `<title>` が `HIBISTACK | 実際に使って良かったものだけを、正直に` である(末尾に `| HIBISTACK` が重複しない)
- [ ] `dist/about/index.html` の `<title>` が従来形式(`〜 | HIBISTACK`)のままである
- [ ] `dist/ranking/index.html` の `<title>` が `ランキング | HIBISTACK` のままである
- [ ] `dist/index.html` の `<meta name="description">` が新しい文言(60字以上)になっている
- [ ] `<meta property="og:title">` もトップで新しいtitleを反映している
- [ ] `npm run build` が0エラー

### 優先度の根拠

トップページは全ページ中もっとも被リンク・クロール頻度が高く、titleは検索結果の第一要素。変更は2ファイル・3行で完結する。

---

## 課題 7: Aboutのmeta descriptionがトップページと完全重複している

- 対象ページ/コンポーネント: `src/pages/about.astro`
- 優先度: 中
- 影響する評価軸: 4(SEO技術面)

### 現状

`/` と `/about/` の `<meta name="description">` がいずれも
**「旅・子育て・暮らしの記録から生まれた、小さなライフスタイルマガジン。」(34字)** で完全一致している。
`about.astro` 18行目が `description={site?.data.description ?? 'HIBISTACKについて'}` となっており、site.jsonの共通説明文をそのまま流用しているため。

### 問題点

- 検索エンジンに対して2ページが同じ説明を提示しており、どちらを表示すべきか判断材料を与えられていない。
- Aboutは「誰が書いているか」を伝えるべきページなのに、説明文に運営者の情報が一切含まれていない。

### 改善案(実装レベル)

`src/pages/about.astro` 18行目の `description` を、site.json参照からAbout固有の固定文言に変更する。

変更前:

```astro
<BaseLayout title="About" description={site?.data.description ?? 'HIBISTACKについて'} jsonLd={jsonLd}>
```

変更後(課題5のtitle変更も反映した最終形):

```astro
<BaseLayout
  title="HIBISTACKについて"
  description="HIBISTACKを運営しているきのこのプロフィールと、実際に買って使ったものだけを正直に書くというレビューポリシーについてまとめています。"
  jsonLd={jsonLd}
>
```

### 受け入れ基準(Done の定義)

- [ ] `dist/about/index.html` の `<meta name="description">` が新しい文言である
- [ ] `dist/index.html` の description と一致しない
- [ ] 全41ページの `<meta name="description">` を抽出し、完全一致する組み合わせが0件である
- [ ] `npm run build` が0エラー

### 優先度の根拠

1行の変更で重複が解消する。ただしトップのtitle(課題6)ほど検索流入への影響は大きくないため中優先度。課題5と同じファイルを触るので同時実施が効率的。

---

## 課題 8: トップページに診断(/quiz/)への導線が存在しない

- 対象ページ/コンポーネント: `src/pages/index.astro`
- 優先度: 中
- 影響する評価軸: 6(収益導線)、7(診断の機能性)、8(ファネル)

### 現状

トップページの `<main>` 内リンクを実測したところ、`/ranking/` と `/products/` は存在するが **`/quiz/` は0件**。
`/quiz/` への導線はヘッダーナビとフッターにしか無い。

一方、`/quiz/` 自体は正常に動作する。Playwrightで4問すべてに回答した結果、AeroPress Go・北欧ペーパーコードダイニングチェア・イワタニ炙りや2の3商品が評価付きで提示され、各商品ページへのリンクが出力されることを確認済み。

### 問題点

- 診断はサイト内でもっとも商品ページへ直結する機能でありながら、トップページの本文動線から呼び出せない。
- ヘッダーのテキストリンクだけでは「何が体験できるか」が伝わらず、クリック理由が生まれない。

### 改善案(実装レベル)

`src/pages/index.astro` の **ランキングセクション(`Best Picks`)の直後、AboutTeaserの前** に、診断への誘導セクションを追加する。

```astro
{rankingItems.length > 0 && (
  <section class="container home-section reveal">
    <SectionHeader labelEn="Best Picks" labelJa="ランキング" href="/ranking/" />
    <RankingList items={rankingItems} compact />
  </section>
)}

{/* ↓ ここに追加 */}
<section class="container home-section reveal home-quiz">
  <p class="home-quiz__heading">どれが合うか迷ったら</p>
  <p class="home-quiz__lead">4つの質問に答えると、暮らしに合いそうなものをご紹介します。</p>
  <a class="home-quiz__link" href="/quiz/">おすすめ診断をはじめる</a>
</section>

<div class="home-section reveal">
  <AboutTeaser />
</div>
```

スタイルは `src/pages/index.astro` の `<style>` に追加する。既存トークンのみを使い、背景色やボタン色を新規に定義しない(押し売り感を出さないため、塗りボタンではなくテキストリンクにする)。

```css
.home-quiz {
  text-align: center;
}
.home-quiz__heading {
  font-size: var(--text-lg);
  color: var(--color-ink);
}
.home-quiz__lead {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-ink-secondary);
}
.home-quiz__link {
  display: inline-block;
  margin-top: var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-ink);
  border-bottom: var(--border-thin);
  padding-bottom: var(--space-1);
}
```

`--space-1` が未定義の場合は `--space-2` を使うこと(`src/styles/tokens.css` を確認してから実装する)。

### 受け入れ基準(Done の定義)

- [ ] `dist/index.html` の `<main>` 内に `href="/quiz/"` が1件以上存在する
- [ ] 文言「おすすめ診断をはじめる」が `dist/index.html` に含まれる
- [ ] 390px幅のトップページで横スクロールが発生しない
- [ ] 新規のカラー変数・塗りボタンを追加していない(既存トークンのみ使用)
- [ ] `npm run build` が0エラー

### 優先度の根拠

既存の動作する機能への導線追加のみで、新規機能開発が不要。商品ページへの到達経路が1本増えるためCVRへの寄与が見込める。ただし記事品質(課題3)ほど根本的ではないため中優先度。

---

## 課題 9: 旧4記事に締めのCTA・内部リンクが無い

- 対象ページ/コンポーネント: 課題3と同じ4記事の本文末尾
- 優先度: 中
- 影響する評価軸: 6(収益導線)、8(ファネル)、11相当(CTAの自然さ)

### 現状

改稿済み2記事(`iwatani-aburiya-2-review` / `aeropress-go-review`)は、まとめの後に
「気になった方は[商品ページ](/products/{slug}/)もチェックしてみてください」+ カテゴリ・ランキングへのリンク
という締めを持つ。

旧4記事の本文末尾には、この締めが無い。本文は最後のH2の段落で終わっている。
なお、記事レイアウト側が生成する「この記事に登場した商品」「次に読む」「{カテゴリ}の記事」の各セクションは**全記事に共通で出力されている**(実測確認済み)ため、回遊導線が完全にゼロというわけではない。

### 問題点

- レイアウトが自動生成するセクションは定型の見出しであり、記事の文脈に沿った「この商品が気になったなら」という自然な動機づけが無い。
- 本文の最後が唐突に終わるため、読了直後のもっとも関心が高い瞬間に次の行動を示せていない。

### 改善案(実装レベル)

課題3の改稿と**同時に**、4記事の本文末尾へ次の構成のブロックを追加する。単独で先行実施してもよい。

構成は以下の順で、いずれも実在URLのみを使う:

1. 商品ページへの1文(記事の内容に合わせて動機を書く)
2. カテゴリ + ランキングへの1文
3. 同カテゴリの実在記事があれば、その1本への言及

記事ごとの具体的な文言(そのまま貼り付け可能):

```md
<!-- eufy-solocam-s340-review.mdx 末尾 -->
玄関まわりの防犯を考えている方は、[商品ページ](/products/eufy-solocam-s340/)もチェックしてみてください。
[家電カテゴリの記事](/categories/appliances/)や、実際に使って良かったものだけをまとめた[ランキング](/ranking/)も参考になると思います。

<!-- nahe-shopper-m-first-look.mdx 末尾 -->
毎日使うエコバッグを探している方は、[商品ページ](/products/nahe-shopper-m/)もチェックしてみてください。
[日用品カテゴリの記事](/categories/daily-goods/)や、実際に使って良かったものだけをまとめた[ランキング](/ranking/)もあわせてご覧ください。

<!-- nordic-paper-cord-dining-chair-review.mdx 末尾 -->
ダイニングチェアを探している方は、[商品ページ](/products/nordic-paper-cord-dining-chair/)もチェックしてみてください。
[暮らしカテゴリの記事](/categories/living/)や[ランキング](/ranking/)も参考になると思います。同じ「暮らし」カテゴリでは、[イワタニ炙りや2のレビュー](/articles/iwatani-aburiya-2-review/)も書いています。

<!-- fufu-kyoto-family-trip.mdx 末尾 -->
子連れでの宿泊を検討している方は、[宿の詳細ページ](/products/fufu-kyoto/)もあわせてご覧ください。
[旅行カテゴリの記事](/categories/travel/)や、実際に使って良かったものだけをまとめた[ランキング](/ranking/)も参考になると思います。
```

`/disclosure/` への言及は、`ProductEmbed` 使用時に `PrLabel` が記事冒頭へ自動挿入されるため、**本文末尾に手動で追加しない**。

### 受け入れ基準(Done の定義)

- [ ] 4記事すべての本文末尾に、対応する `/products/{slug}/` へのリンクがある
- [ ] 4記事すべてにカテゴリリンクと `/ranking/` へのリンクがある
- [ ] 追加したリンク先がすべて `dist/` 配下に実在する(`dist/products/{slug}/index.html` 等の存在を確認)
- [ ] 追加文の1文が60字以内、1段落が4文以内
- [ ] 本文末尾に `/disclosure/` へのリンクを手動追加していない
- [ ] `npm run build` が0エラー

### 優先度の根拠

文言は本書に確定済みで、オーナーへの確認が不要。4ファイルへの追記のみで完了する。課題3の改稿と同時に行えば追加工数はほぼゼロ。

---

## 課題 10: ランキングのモバイル表示で本文幅が152pxしかなく折返しが多発する

- 対象ページ/コンポーネント: `src/components/content/RankingItem.astro`(`/ranking/`)
- 優先度: 中
- 影響する評価軸: 5(モバイル体験)、7(ランキングの機能性)

### 現状

`.ranking-item` は `display: flex` の横並びで、非compact時の内訳は次のとおり(実測・390px幅):

- `.ranking-item__rank`: `width: 2.2em` × `font-size: var(--text-2xl)`(2rem = 32px)= **70.4px**
- `gap`: `var(--space-4)` = 24px
- `.ranking-item__image`: `width: 80px`
- `gap`: 24px

コンテンツ幅は `390 - (--outer-margin-mobile 20px × 2) = 350px`。
残る本文幅は `350 - 70.4 - 24 - 80 - 24 = 151.6px`。

この結果、実機スクリーンショットでは商品名「イワタニ 炙りや2(ポータブルガス炉端焼き器)」が3行、コメント「焼肉屋のようにガス火でしっかり焼ける、串焼き・網焼き両対応の卓上コンロ。」が4行に折り返している。

なお `/ranking/` は非compact、トップページのランキングは `compact` 指定のため、この問題は `/ranking/` でのみ発生する。

### 問題点

- ランキングは「順位と商品名を素早く見比べる」ためのページなのに、商品名が3行に割れて一覧性が失われている。
- 順位番号が70px(コンテンツ幅の20%)を占めており、情報量に対して面積配分が不均衡。

### 改善案(実装レベル)

`src/components/content/RankingItem.astro` の `<style>` 末尾に、767px以下のみを対象とした上書きを追加する。既存のデスクトップ表示は変更しない。

```css
@media (max-width: 767px) {
  .ranking-item {
    gap: var(--space-3);
  }

  .ranking-item__rank {
    width: 1.6em;
    font-size: var(--text-xl);
  }

  .ranking-item__image {
    width: 64px;
  }
}
```

変更後の内訳: `1.6em × 1.5rem(24px) = 38.4px` + `16px` + `64px` + `16px` = 134.4px。
本文幅は `350 - 134.4 = 215.6px` となり、現状の151.6pxから約1.4倍に広がる。

`--text-xl` は `1.5rem`、`--space-3` は `16px`(`src/styles/tokens.css` で定義済み)。新規トークンは追加しない。

### 受け入れ基準(Done の定義)

- [ ] 390px幅の `/ranking/` で、1位の商品名「イワタニ 炙りや2(ポータブルガス炉端焼き器)」が2行以内に収まる
- [ ] 同幅で `.ranking-item__body` の実測幅が200px以上ある
- [ ] 1024px幅の `/ranking/` の見た目が変更前と同一(デスクトップに影響しない)
- [ ] トップページのランキング(compact)の見た目が変更前と同一
- [ ] `/ranking/` で横スクロールが発生しない
- [ ] `npm run build` が0エラー

### 優先度の根拠

CSS7行の追加で完結し、影響範囲が `RankingItem` に閉じている。ランキングは収益に近いページのため一覧性の改善価値は高いが、機能不全ではなく可読性の問題のため中優先度。

---

## 課題 11: 診断結果から記事への導線が無い

- 対象ページ/コンポーネント: `src/pages/quiz.astro`(`/quiz/`)
- 優先度: 中
- 影響する評価軸: 7(診断の機能性)、8(ファネル)

### 現状

Playwrightで診断を最後まで実行した結果、結果画面には商品名・要約・評価が表示され、リンクは `/products/{slug}/` のみが出力される(実測: aeropress-go、nordic-paper-cord-dining-chair、iwatani-aburiya-2 の3商品、各2リンク)。
末尾に `/articles/` と `/products/` の一覧リンクがあるのみで、**提示された商品に対応するレビュー記事へのリンクは無い**。

### 問題点

- 診断で商品を知った直後は「実際どうなの?」という検証欲求がもっとも高い瞬間だが、その答えであるレビュー記事へ直接行けない。
- 商品ページからレビュー記事へは到達できるが、1クリック余分にかかる。
- 記事という最大の資産が、診断の出口で活用されていない。

### 改善案(実装レベル)

診断結果の各商品カードに、その商品を扱っている公開記事があれば、記事へのテキストリンクを1本追加する。

1. `quiz.astro` のfrontmatterで、`getPublished('articles')` を取得し、**商品ID → 記事slug** の対応表を作る。対応の判定は、記事本文の `<ProductEmbed id="..." />` ではなくメタ情報で行うため、`articles` と `products` が同じ `category` かつ記事slugが商品slugを含むかで機械的に紐づけるのは避け、**明示的な対応表を `quiz.astro` 内に定数として定義する**。現状6商品すべてに1対1の記事があるため、次の定数で足りる。

```ts
// 商品ID → レビュー記事のURL(実在するもののみ記載する)
const PRODUCT_ARTICLE: Record<string, string> = {
  'aeropress-go': '/articles/aeropress-go-review/',
  'eufy-solocam-s340': '/articles/eufy-solocam-s340-review/',
  'fufu-kyoto': '/articles/fufu-kyoto-family-trip/',
  'iwatani-aburiya-2': '/articles/iwatani-aburiya-2-review/',
  'nahe-shopper-m': '/articles/nahe-shopper-m-first-look/',
  'nordic-paper-cord-dining-chair': '/articles/nordic-paper-cord-dining-chair-review/',
};
```

2. 結果カードを描画している箇所で、対応表にキーがある場合のみリンクを出力する。キーが無い商品では何も出力しない(存在しないURLを作らないため)。

```astro
{PRODUCT_ARTICLE[product.id] && (
  <a class="quiz-result__article-link" href={PRODUCT_ARTICLE[product.id]}>
    使ってみた感想を読む
  </a>
)}
```

3. スタイルは既存トークンのみで、商品ページリンクより弱い見た目にする。

```css
.quiz-result__article-link {
  display: inline-block;
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-ink-secondary);
  border-bottom: var(--border-thin);
}
```

結果がクライアントサイドJSで描画されている場合は、上記の対応表をJS側の定数として持たせ、同じ条件分岐で `<a>` を生成すること。実装前に `quiz.astro` の描画方式(サーバー描画かJS描画か)を必ず確認する。

### 受け入れ基準(Done の定義)

- [ ] 診断を最後まで回答すると、提示された各商品の下に「使ってみた感想を読む」リンクが表示される
- [ ] そのリンク先が `dist/articles/{slug}/index.html` として実在する
- [ ] 対応表に無い商品IDが提示された場合、リンクが出力されずエラーにもならない
- [ ] 390px幅で結果画面に横スクロールが発生しない
- [ ] `npm run build` が0エラー

### 優先度の根拠

診断→記事→商品という回遊が1本増える。ただし現状は診断→商品が既に成立しており機能不全ではないため中優先度。実装時に描画方式の確認が必要なぶん、課題8より工数がやや大きい。

---

## 課題 12: Aboutページの情報量が510字でE-E-A-Tの裏づけとして薄い

- 対象ページ/コンポーネント: `src/pages/about.astro` / `src/content/site.json`(`author.bio`)
- 優先度: 中
- 影響する評価軸: 9(信頼性・透明性)、4(SEO)

### 現状

`/about/` の `<main>` 内テキストは全部で **510字**(パンくず・構造化データJSONを含む生の抽出値)。
構成は「わたしについて」(bio 1段落)/「レビューポリシー」(箇条書き3項目)/「SNS」/「お問い合わせ」の4セクション。
`Person` 構造化データは出力済みで、プロフィール画像・連絡先メールも設置済み。

### 問題点

- レビューサイトの信頼性は「誰が、どういう基準で、どれだけの期間使って書いているか」で判断されるが、bioが1段落のみで判断材料が足りない。
- 「実際に購入して、使ったものだけを紹介します」という約束はあるが、**購入費用を自分で負担しているのか**、**メーカー提供品を受け取ることがあるのか**が明示されていない。ここは信頼性の核心。
- 使用期間の目安(どれくらい使ってからレビューするか)が書かれていない。実際の記事は1週間〜1年半とばらつきがあり、方針の説明があると納得感が増す。

### 改善案(実装レベル)

`src/pages/about.astro` の「レビューポリシー」セクションを拡張する。既存の3項目の箇条書きは残し、その下に補足段落を追加する。

```astro
<section class="about-section container-text">
  <h2>レビューポリシー</h2>
  <p>HIBISTACKは、次の3つを約束してコンテンツをつくっています。</p>
  <ul role="list" class="about-promises">
    <li>実際に購入して、使ったものだけを紹介します。</li>
    <li>良かった点だけでなく、気になった点も正直に書きます。</li>
    <li>広告・アフィリエイトの表記は、常に分かりやすく明示します。</li>
  </ul>

  {/* ↓ ここから追加 */}
  <p class="about-policy-note">
    掲載している商品は、原則としてすべて自分で購入したものです。
    メーカーから提供を受けた場合は、その旨を記事内に明記します。
  </p>
  <p class="about-policy-note">
    レビューは、実際に使った期間を記事ごとに記載しています。
    使い始めたばかりのものは「使い始めて1週間」のように期間を明示し、
    その時点で分かっていないことは分かっていないと書きます。
  </p>
  <p class="about-policy-note">
    広告表記の詳しい方針は<a href="/disclosure/">アフィリエイト・PR表記について</a>にまとめています。
  </p>
</section>
```

スタイル:

```css
.about-policy-note {
  margin-top: var(--space-4);
  font-size: var(--text-base);
  color: var(--color-ink-secondary);
}
```

**注意**: 上記の文言は現行の運用実態(全商品が自費購入・記事に使用期間を明記)に基づく。オーナーの運用方針と異なる場合は3-4の確認事項として扱い、勝手に確定しないこと。

### 受け入れ基準(Done の定義)

- [ ] `/about/` の `<main>` 内テキストが800字以上になる
- [ ] 「原則としてすべて自分で購入したものです」を含む段落がある
- [ ] `/disclosure/` へのリンクがAboutページ本文内に存在する
- [ ] 1文が60字以内、1段落が4文以内
- [ ] 390px幅で横スクロールが発生しない
- [ ] `npm run build` が0エラー

### 優先度の根拠

アフィリエイトサイトにとって透明性の明示は信頼の土台であり、実装は1ファイルへの追記で完結する。ただし文言がオーナーの運用実態に依存するため、確認待ちが発生しうる点で中優先度。

---

## 課題 13: お気に入りボタンのタップ領域が36pxで推奨44pxを下回る

- 対象ページ/コンポーネント: `src/components/island/FavoriteButton.astro`(トップページの商品カード、商品一覧など `--sm` 指定箇所)
- 優先度: 低
- 影響する評価軸: 5(モバイル体験)

### 現状

`FavoriteButton.astro` にはサイズ違いの2クラスがある。

```css
.favorite-button--sm { width: 36px; height: 36px; }
.favorite-button--md { width: 44px; height: 44px; }
```

Playwrightでトップページを390px幅で走査したところ、`--sm` が適用された「北欧ペーパーコードダイニングチェアをお気に入りに」ボタンが **36×36px** で描画されていることを確認した。商品ページ側は44×44pxで問題ない。

### 問題点

- モバイルのタップ対象として一般に推奨される44×44pxを下回っており、隣接要素との誤タップが起きやすい。
- お気に入りは再訪問を促す機能であり、押しにくさが直接その機会を減らす。

### 改善案(実装レベル)

見た目の大きさ(アイコンの視覚サイズ36px)は変えず、**タップ領域だけを44pxに広げる**。`FavoriteButton.astro` の `<style>` の `.favorite-button--sm` を次に置き換える。

```css
.favorite-button--sm {
  width: 36px;
  height: 36px;
  position: relative;
}

/* 見た目は36pxのまま、タップ領域のみ44px相当に拡張する */
.favorite-button--sm::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
}
```

`.favorite-button--sm` に既に `position` が指定されている場合は重複指定しないこと。また `::after` を既に使っている場合は `::before` に読み替えるか、既存の擬似要素と競合しないよう実装前にファイル全体を確認する。

### 受け入れ基準(Done の定義)

- [ ] 390px幅のトップページで、お気に入りボタンのタップ判定領域(擬似要素を含む)が44×44px以上になる
- [ ] ボタンのアイコン自体の見た目の大きさが変更前と同一(36px)
- [ ] 拡張した領域が隣接するリンク(商品名リンク等)の上に重なってクリックを奪っていない
- [ ] お気に入りの登録・解除が従来どおり動作する(クリックして状態が切り替わることを確認)
- [ ] `npm run build` が0エラー

### 優先度の根拠

体験の細部の改善であり、機能自体は動作している。CSS10行で完結するが、他の課題に比べ影響が限定的なため低優先度。

---

## 3-3. 実装順のロードマップ

### すぐ着手(工数小・効果大)— オーナー確認不要、上から順に実施可

- [ ] **課題1**: `src/lib/nav.ts` — 記事/商品0件のカテゴリをヘッダーナビから除外
- [ ] **課題2**: `src/pages/categories/[slug].astro` — 空カテゴリの代替導線 + `noindex`
- [ ] **課題5**: `src/pages/about.astro` — `<h1>HIBISTACKについて</h1>` を追加
- [ ] **課題7**: `src/pages/about.astro` — About固有のmeta descriptionに変更(課題5と同時実施)
- [ ] **課題6**: `src/pages/index.astro` + `src/layouts/BaseLayout.astro` — トップのtitle/descriptionを検索語入りに
- [ ] **課題4**: 記事4本のfrontmatterに `seo.description` を追加
- [ ] **課題10**: `RankingItem.astro` — モバイル767px以下の幅配分を調整

上記7件はいずれも既存の事実の範囲で完結し、新規の一次情報を必要としない。
`npm run build` と `npx astro check` を通し、モバイル390pxで横スクロールが出ないことを確認してからcommitする。

### 次のスプリント — オーナーへの確認・ヒアリングを伴う

- [ ] **課題3-a**: `eufy-solocam-s340-review`(264字)をヒアリング→二段階改稿
- [ ] **課題9-a**: 同記事の末尾CTAを追加(課題3-aと同時)
- [ ] **課題3-b**: `nahe-shopper-m-first-look`(380字)をヒアリング→二段階改稿
- [ ] **課題9-b**: 同記事の末尾CTAを追加
- [ ] **課題3-c**: `nordic-paper-cord-dining-chair-review`(833字)をヒアリング→二段階改稿
- [ ] **課題9-c**: 同記事の末尾CTAを追加
- [ ] **課題3-d**: `fufu-kyoto-family-trip`(1523字)をヒアリング→二段階改稿
- [ ] **課題9-d**: 同記事の末尾CTAを追加
- [ ] **課題12**: Aboutのレビューポリシー拡張(3-4の確認事項1の回答後)

記事は**1本ずつ完結させてからcommit**する。4本まとめてヒアリングし、まとめて改稿しないこと(採点と差し戻しが混ざるため)。

### 中長期

- [ ] **課題8**: トップページに診断への導線セクションを追加
- [ ] **課題11**: 診断結果から対応レビュー記事へのリンクを追加
- [ ] **課題13**: `FavoriteButton --sm` のタップ領域を44pxに拡張
- [ ] 子育て・写真カテゴリのコンテンツ拡充(3-4の確認事項2の回答後に方針決定)

---

## 3-4. 判断が必要な確認事項(オーナーの意思決定が必要)

以下は本設計書では確定させず、オーナー(きのこ)の判断を仰ぐ。

1. **レビューポリシーの記載内容(課題12に直結)**
   Aboutに「掲載商品は原則としてすべて自費購入」「提供品の場合は記事内に明記」と書いてよいか。
   現在の全6商品は自費購入という理解で正しいか。今後メーカー提供を受ける可能性がある場合、文言を変える必要がある。

2. **空カテゴリ「子育て」「写真」の扱い**
   次のどれを選ぶか。
   - (a) カテゴリとして残し、記事ができるまで空状態の案内を出す(課題2の実装。既定案)
   - (b) 記事ができるまでカテゴリ自体を非公開にする(`/categories/` 一覧・フッターからも消す)
   - (c) 近日中に記事を追加する予定があるので、そのまま待つ
   なお「子育て」はヘッダーナビ上位5件に入る `order: 2` に設定されており、コンテンツが揃えば自動的にナビへ戻る(課題1の実装後)。

3. **トップページのtitle文言(課題6)**
   本書の提案は `HIBISTACK | 実際に使って良かったものだけを、正直に`。
   タグライン「日々の暮らしを、少しだけ豊かにする。」を使う案もあるが、検索語(「使って良かった」)を含む前者を推奨している。どちらを採用するか。

4. **記事4本の改稿の優先順位**
   本書は字数の少ない順(eufy → nahe → nordic → fufu)を提案しているが、
   季節性やアフィリエイト成果の見込みで順序を変えたい場合は指示がほしい。

5. **診断結果に表示する記事リンクの文言(課題11)**
   本書の提案は「使ってみた感想を読む」。
   「レビューを読む」「詳しいレビューを見る」など、他の表現を希望する場合は指定がほしい。
