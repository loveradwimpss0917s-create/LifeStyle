# 26. Sonnet Implementation Specification — HIBISTACK V3

> 21〜25章が戦略の正、本書が実装の正。V2(20章)完了状態の上に積む差分実装。
> 20章§5「Astro構成の遵守事項(落とし穴6項目)」と§12「実装結果の教訓」は本書でも全面適用。
> 各コミットで `astro check`+`npm run build`+`npm run check:content` を通し、UI変更はPlaywright実機確認してからコミット(V2の運用を踏襲)。

## 0. 実装上の新しい前提

- **Pages Functionsの導入**(コミット11〜13): `functions/` ディレクトリを追加する。静的`dist/`配信は不変で、`/go/*`のみ関数実行。アダプタ不要・wrangler.toml不要はほぼ維持されるが、**Analytics Engineバインディング設定はCloudflareダッシュボードでのオーナー作業**(READMEに手順を書く)
- **GitHub Actions + Claude API**(コミット16〜24): `ANTHROPIC_API_KEY` はGitHub Secretsに設定(オーナー作業)。モデル・温度は`pipeline/config.json`に集約
- 環境変数を要する機能(Analytics beacon等)は**未設定なら黙って無効化**され、ビルドは常に成功すること(フォークやローカルで壊れない)

## 1. 優先度

### High(Phase1相当・計測と土台)
コミット1〜10: アクセス解析 / robots・構造化データ / 検索改善 / お気に入り / 関連記事最適化 / sticky TOC

### Medium(Phase2相当・生産ラインと収益導線)
コミット11〜24: /goクリック計測 / マルチモール / リンク死活 / 診断 / AIパイプラインMVP / Newsletter

### Low(Phase3相当・運用自動化と磨き込み)
コミット25〜30: リライト提案 / 週次レポート / E-E-A-T / 品質ジョブ / ドキュメント

## 2. 次の30コミット

### ブロックA: 計測・SEO基盤(High)

**c1. Cloudflare Web Analyticsビーコン導入**
- 目的: 計測ゼロ状態の解消。privacy.astro記載との不整合解消(21章)
- 変更: `src/layouts/BaseLayout.astro` `README.md` `.env.example`(新規)
- 実装: `PUBLIC_CF_BEACON_TOKEN` があるときのみ `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=...>` を出力。未設定時は何も出さない
- 完了: トークン未設定でビルド成功+ビーコン非出力 / 設定時に出力されることをdist HTMLで確認。README「オーナー引き継ぎ」にトークン取得手順追記

**c2. robots.txt+サイトURL整合**
- 目的: クローラ制御の欠落解消とドメイン表記の一本化
- 変更: `public/robots.txt`(新規) `astro.config.mjs` `src/content/site.json`
- 実装: robots.txt(全許可+`Sitemap:`行)。siteのURLを実デプロイ先(`https://lifestyle-ako.pages.dev`。独自ドメイン取得時に1箇所変更)へ統一
- 完了: `dist/robots.txt`のSitemap行がsitemap-index.xmlの実URLと一致。canonical/OGP/RSSのドメインが全ページで統一

**c3. WebSite/Organization構造化データ**
- 目的: サイト名の指名検索・ナレッジ表示の下地(E-E-A-T)
- 変更: `src/lib/seo.ts` `src/layouts/BaseLayout.astro`
- 実装: `buildSiteJsonLd()`(WebSite+SearchAction(/search/?q={query})+Organization logo)。トップページのみ出力
- 完了: dist/index.htmlのJSON-LDが構文検証を通る(スキーマテスト用スクリプトかリッチリザルトテストの手動確認をコミットメッセージに記録)

**c4. 検索改善(フィルタ+プレースホルダー)**
- 目的: 20章§12.4残課題の回収。目的型ユーザーの最短経路強化
- 変更: `src/pages/search.astro` `src/layouts/ProductLayout.astro` `src/layouts/ArticleLayout.astro`
- 実装: `data-pagefind-filter`(type=商品/記事、カテゴリ名)を各レイアウトに付与し、PagefindUIのフィルタUIを有効化。検索実行中はbg-secondaryの静的プレースホルダー(シマー禁止・18章§2.12)
- 完了: ビルド後の実検索でtype/カテゴリ絞り込みが動作(Playwright)

**c5. check:content強化(収益の見える化)**
- 目的: 「published商品なのにアフィリエイトリンクなし」を運用上見逃さない
- 変更: `scripts/check-content-integrity.mjs` `.github/workflows/ci.yml`
- 実装: published×リンク欠落を警告の先頭でカウント表示(`収益化率 1/4`形式)。CIのstep summaryへ出力(`GITHUB_STEP_SUMMARY`)
- 完了: CI実行結果のSummaryに収益化率が表示される

### ブロックB: 回遊・UX(High)

**c6. FavoriteButton(お気に入りボタン)**
- 目的: 再訪理由の創出(04章§4.8設計の実装)
- 変更: `src/components/island/FavoriteButton.astro`(新規) `src/components/content/ProductCard.astro` `src/layouts/ProductLayout.astro` `src/styles/global.css`
- 実装: localStorage `hibistack:favorites`(productId配列)。heart/heart-filled切替+aria-pressed。スクリプトは既定パターン(is:inline data-astro-rerun+IIFE+プレーンJS+多重バインドガード+readyStateガード)
- 完了: 追加/解除がVT遷移後・リロード後も保持(Playwright)。a11y: aria-label状態反映

**c7. /favorites/ページ+静的商品インデックスAPI**
- 目的: お気に入りの受け皿ページ
- 変更: `src/pages/favorites.astro`(新規) `src/pages/api/products-index.json.ts`(新規) `src/components/layout/Header.astro`(モバイルメニューへ導線)
- 実装: ビルド時に全published商品の{id,name,image,rating,category}をJSON出力。favoritesページはfetch→クライアント描画。空状態はハート説明+ランキング導線。`noindex`
- 完了: 商品をお気に入り→/favorites/で表示、解除で消える(Playwright)。JSONサイズが商品100件でも10KB程度に収まる形

**c8. 関連記事スコアリング改良**
- 目的: 回遊率の底上げ(現状: カテゴリ一致のみ)
- 変更: `src/lib/related.ts`
- 実装: スコア=タグ一致数×3+カテゴリ一致×2+公開90日以内ボーナス1。手動related指定は常に最優先(既存挙動維持)。同点は新着順
- 完了: 既存2記事でのユニットテスト的検証スクリプト(一時)で順位が意図通り。ビルド出力の関連記事が変化することを確認

**c9. 記事TOCのsticky sidebar化(≥1024px)**
- 目的: 20章§12.1残課題の回収(17章§5の本来仕様)
- 変更: `src/layouts/ArticleLayout.astro` `src/components/content/Toc.astro`
- 実装: 本文エリアを`grid-template-columns: 1fr 240px`(≥1024px)化し、Tocをaside配置でsticky(top=ヘッダー+32px)。<1024pxは現行details維持(1コンポーネントで両対応、CSSで出し分け)
- 完了: 1024px以上でスクロール追従+現在地ハイライト、レイアウトシフトなし(CLS 0)、モバイルは現状維持(Playwright両幅)

**c10. パンくず・タグ導線の商品↔記事相互強化**
- 目的: 行き止まり削減(02章§6「出口は必ず次がある」)
- 変更: `src/pages/tags/[slug].astro` `src/layouts/ProductLayout.astro`
- 実装: タグページに件数表示+カテゴリ横断の人気(editorsPicks)セクション追加。商品ページ末尾に「このカテゴリのタグ」チップ行
- 完了: 全タグページ・商品ページで追加セクションが描画され、リンク切れなし(内部リンクスキャン)

### ブロックC: 収益導線(Medium)

**c11. /go/リダイレクト(Pages Functions)**
- 目的: クリック計測の取得開始(23章§1)
- 変更: `functions/go/[[route]].ts`(新規) `README.md`
- 実装: `/go/{productId}/{mall}?pos={position}` → 302リダイレクト。対応表はビルド時生成の`dist/api/affiliate-map.json`(c12)を関数から読む。Analytics Engineバインディング(`CLICKS`)があればレコード書き込み、なければリダイレクトのみ(壊れない)
- 完了: ローカル`wrangler pages dev dist`で302動作確認。未知IDは404→/products/へ。READMEにバインディング設定手順

**c12. アフィリエイトリンクの/go/経由化**
- 目的: 全クリックを計測面に乗せる
- 変更: `src/lib/affiliate.ts` `src/pages/api/affiliate-map.json.ts`(新規) `src/components/content/AffiliateButton.astro` `src/components/content/StickyCta.astro`
- 実装: 表示URLを`/go/{id}/{mall}?pos={pos}`へ。rel="nofollow sponsored noopener"維持。affiliate-map.jsonに実URLを出力(関数の参照元)
- 完了: 全CTAボタンのhrefが/go/形式。リダイレクト先が元URLと完全一致(Playwrightで実クリック追跡)。構造化データ・PrLabelに影響なし

**c13. AffiliateButtonマルチモール表示**
- 目的: Amazon/楽天導入(Phase3)の受け皿。主従関係の維持(23章§2.3)
- 変更: `src/lib/affiliate.ts` `src/components/content/AffiliateButton.astro`
- 実装: primary(優先順: yahooShopping→yahooTravel→amazon→rakuten)は現行ボタン、他モールはボタン下に`--text-sm`のテキストリンク行(「Amazonで見る / 楽天で見る」)。1モールのみなら現状と完全同一表示
- 完了: テスト用に一時的に複数モールURLを持たせた商品で表示確認→復元。既存1モール商品の見た目が1pxも変わらない(スクリーンショット比較)

**c14. リンク死活チェック**
- 目的: 切れたアフィリエイトリンクによる機会損失・信頼毀損の防止
- 変更: `scripts/check-links.mjs`(新規) `.github/workflows/link-check.yml`(新規・週次cron)
- 実装: affiliate URL+内部リンクへHEAD/GET(3回リトライ・0.5s間隔)。NG時はIssue自動起票(既存openがあれば追記)。CIブロックはしない
- 完了: 手動dispatch実行でIssueが起票される(正常時は起票なし)

**c15. おすすめ診断 /quiz/**
- 目的: 回遊・CV両効きの名物機能(22章A評価)。「AI診断」の見せ方でブランド演出(実体は静的決定木=高速・コストゼロ)
- 変更: `src/content/quiz.json`(新規) `src/content.config.ts`(quizコレクション) `src/pages/quiz.astro`(新規) ヘッダー/フッター導線
- 実装: 質問3〜4問(誰に/シーン/重視点)→カテゴリ+タグの重みでpublished商品をスコアリングし上位3件提示。全ロジックはビルド時埋め込みデータ+クライアントJS(既定スクリプトパターン)。結果に「診断は編集部の選定基準に基づく」明記
- 完了: 全回答パスで結果が出る(網羅チェックスクリプト)。reduced-motion対応。noindexなし(SEOページとして育てる)

### ブロックD: AIパイプラインMVP(Medium)— 09章の実装

**c16. voice.md(文体の正)**
- 目的: 生成の一貫性担保。13章§7の機械可読化
- 変更: `src/content/brand/voice.md`(新規)
- 実装: 文体規則+禁止語リスト(YAMLフロントマターで機械可読)+良文/悪文の対比例10組
- 完了: 禁止語リストがc20の生成検証から参照できる構造

**c17. パイプライン基盤**
- 目的: 以後のステージの共通土台
- 変更: `pipeline/config.json` `pipeline/lib/github.mjs` `pipeline/lib/claude.mjs` `pipeline/lib/parse-intake.mjs`(すべて新規)
- 実装: モデル/温度/リトライ設定の一元化。Claude API呼び出し(Messages API+リトライ)、Issue本文→{メモ,画像URL群,日付}パーサ
- 完了: モックIssue本文でparse単体動作。APIキー未設定時は明確なエラーメッセージ

**c18. Stage1: analyze(解析)**
- 目的: 写真+メモ→商品データ候補JSON
- 変更: `pipeline/prompts/analyze.md` `pipeline/scripts/analyze.mjs`
- 実装: vision入力で{name候補,category,brand候補,price帯,tags候補,画像alt,確信度}を生成。低確信度は`TODO:`付き。インジェクション対策: メモはデリミタ内のデータとして注入
- 完了: 実在のintake形式サンプルでJSONが返り、Zod相当の形式検証を通る

**c19. Stage2: compose-product(下書き生成)**
- 目的: 商品md一式の自動起草
- 変更: `pipeline/prompts/compose-product.md` `pipeline/scripts/compose-product.mjs`
- 実装: analyze結果+メモ+voice.md+既存同カテゴリレビュー2本(few-shot)→frontmatter完全体+本文。concernPointsが作れない場合は生成せずCONFIRMマーカー。**メモにない体験談の記述は禁止**(プロンプトとバリデーション両方で担保)
- 完了: 生成mdが`astro check`+content schemaを通る。禁止語リストとの照合が走る

**c20. Stage5: seo-meta+内部リンク提案**
- 目的: SEOメタの自動化(L3)と内部リンク提案(L2)
- 変更: `pipeline/prompts/seo-meta.md` `pipeline/scripts/seo-meta.mjs`
- 実装: title32字/description120字生成+文字数検証。既存記事一覧から関連3件を提案してPR説明文に記載
- 完了: 文字数超過時に自動再生成(最大2回)し、それでも超過なら明示エラー

**c21. Stage6: open-pr(PR作成)**
- 目的: 承認フローの成立
- 変更: `pipeline/scripts/open-pr.mjs` `.github/PULL_REQUEST_TEMPLATE/content.md`(新規)
- 実装: ブランチ`content/{issue番号}-{slug}`作成→生成物コミット→PR作成。本文にプレビューURL枠+チェックリスト(名称/価格/気になった点は本心か/**アフィリエイトURLを貼ったか**)
- 完了: 手動実行でPRが作成され、チェックリストが表示される

**c22. generate.ymlワークフロー(結線)**
- 目的: Issue→PRの全自動結線
- 変更: `.github/workflows/generate.yml`(新規)
- 実装: `issues: labeled(intake)`トリガー→c17〜c21を順次実行。失敗時はIssueへエラーコメント(intakeは失われない)。同時実行1(concurrency)
- 完了: テストIssue(実写真+実メモ)で**エンドツーエンド**にPRが生成され、内容が捏造なし・スキーマ適合であることを人間が確認してからマージ可能

**c23. Stage4: derive-sns(SNS派生)**
- 目的: 6チャネル文面の自動生成(24章L2)
- 変更: `pipeline/prompts/derive-sns.md` `pipeline/scripts/derive-sns.mjs` `content-hub/sns/`(新規・サイト非公開データ)
- 実装: ig-feed/ig-reel/ig-story/threads/tiktok/yt-shortsの6ファイルをPRに同梱。絵文字は1投稿2個まで(13章)
- 完了: content-hub/はビルド対象外(サイトに出ない)ことを確認

**c24. Newsletter(Buttondown)**
- 目的: アルゴリズム非依存の自前リスト開始(00章P-12・V2からの繰り延べ)
- 変更: `src/components/section/NewsletterCta.astro`(新規) `src/pages/index.astro` `src/content/site.json`(newsletterUrl設定)
- 実装: Buttondownの静的フォーム埋め込み(外部JS不可・plain form POST)。newsletterUrl未設定時は非表示。FollowCta直上に配置
- 完了: URL未設定でセクション非表示・ビルド成功。設定時にフォーム表示+CSP的に外部スクリプトゼロ維持

### ブロックE: 運用自動化(Low)

**c25. rewrite-suggest(リライト候補の週次Issue)**
- 目的: 資産の複利運用(24章L2)
- 変更: `.github/workflows/rewrite-suggest.yml` `pipeline/scripts/rewrite-suggest.mjs`
- 実装: publishedAt/updatedAtから90日超の記事・商品を抽出し、優先度順の候補Issueを週次起票(月曜)。クリックデータ取得後は下降トレンドを加味(TODOコメントで拡張点明記)
- 完了: 手動dispatchで候補Issueが起票される

**c26. weekly-report(週次レポート)**
- 目的: 分析のL3化(24章)
- 変更: `.github/workflows/weekly-report.yml` `pipeline/scripts/weekly-report.mjs`
- 実装: CF GraphQL API(Web Analytics)+Analytics Engine(クリック)を集計しIssueに投稿。トークン未設定の項目は「未設定」と明記して他は出す
- 完了: 手動dispatchでレポートIssueが生成される

**c27. 著者情報のE-E-A-T強化**
- 目的: 検索評価の土台(22章Phase4の前倒し可能分)
- 変更: `src/lib/seo.ts` `src/pages/about.astro` `src/layouts/ArticleLayout.astro`
- 実装: Person構造化データ(sameAs=SNS実URL)、記事Articleのauthorを@id参照に。aboutに「レビューポリシー」節(実購入・実使用・PR明示)
- 完了: リッチリザルトテスト相当の構文検証通過

### ブロックF: 品質・締め(Low)

**c28. 画像規約チェック**
- 目的: 実写真運用開始後の性能劣化防止(20章§10)
- 変更: `scripts/check-images.mjs`(新規) `package.json` `.github/workflows/ci.yml`
- 実装: src/assets配下の長辺1600px超・1MB超・`ai-`プレフィックス画像のalt「イメージ写真」欠落を警告
- 完了: 意図的な違反ファイルで警告が出る→削除して green

**c29. Lighthouse計測対象の拡大**
- 目的: 新ページの品質担保
- 変更: `lighthouserc.json`
- 実装: quiz/favorites/rankingを計測対象へ追加(favoritesはJSページのため閾値を個別緩和しない=同じ0.95で挑戦し、無理なら実測値とともに個別設定を記録)
- 完了: CIがgreen。実測値をコミットメッセージに記録

**c30. ドキュメント同期+引き継ぎ更新**
- 目的: docs=実装の同期維持(本プロジェクトの規律)
- 変更: `README.md` `docs/26-sonnet-implementation-spec-v3.md`(§実装結果追記) 関連docs
- 実装: 新機能の運用手順(intakeの送り方・PRレビュー手順・各Secretsの設定)、オーナー引き継ぎ事項の全面更新、実装で生じた設計差異の記録
- 完了: READMEだけ読めば新規メンバー(未来のオーナー自身)が運用を再開できる状態

## 3. オーナー作業の依存関係(実装をブロックするもの)

| コミット | 必要なオーナー作業 |
|---|---|
| c1 | Cloudflare Web Analyticsトークン取得 |
| c11 | Analytics Engineバインディング設定(なくてもリダイレクトは動く) |
| c16〜c23 | `ANTHROPIC_API_KEY`のGitHub Secrets設定 / intakeショートカット用PAT発行 |
| c24 | Buttondownアカウント作成 |
| 常時 | 残3商品のアフィリエイトURL・実写真・SNS実URL(これが無いと計測しても数字が出ない) |

---
*Sonnet Implementation Specification V3 / 戦略: 21〜25章 / 30コミットは番号順に実装し、ブロック境界で戦略側(Fable)へ進捗報告すること。*
