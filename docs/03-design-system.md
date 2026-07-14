# 03. デザインシステム・ブランドガイドライン

参考世界観: Apple(余白と階層)/ 無印良品(生活の思想)/ Notion(静かなUI)/ Aesop(タイポグラフィと落ち着き)。
キーワード: **ミニマル・余白・写真が主役・白ベース・高級感・静か・長く使える**。

## 1. デザイン原則(実装判断の基準)

1. **写真が主役、UIは黒子**: 装飾のためのUI要素(影・グラデ・枠線)は原則禁止。区切りは余白で作る。
2. **1画面1メッセージ**: 各セクションは「1つの見出し+1つの主役ビジュアル+最小限のテキスト」。
3. **静けさ**: アニメーションはフェード/わずかな移動のみ、200〜400ms、`ease-out`。`prefers-reduced-motion` で全停止。
4. **紙のように**: Webマガジン=誌面。グリッドを守り、テキストは組版として美しく(行長・行間・約物)。
5. **10年もつ**: 流行の演出(グラスモーフィズム、過剰なパララックス等)は採用しない。

## 2. デザイントークン

実装は CSS Custom Properties(`src/styles/tokens.css`)。Tailwindを使う場合はこのトークンをtheme拡張として登録する(トークンが正、Tailwindは写像)。

### 2.1 カラー

白ベース+墨色テキスト+真鍮色アクセント(Aesop的な抑制されたウォームアクセント)。

```css
:root {
  /* Base */
  --color-bg:            #FFFFFF;  /* ページ背景 */
  --color-bg-secondary:  #F7F6F4;  /* セクション背景(わずかに温かい白) */
  --color-bg-tertiary:   #EFEDE9;  /* タグ・控えめな面 */

  /* Ink(テキスト) */
  --color-ink:           #1A1A18;  /* 見出し・本文強調(純黒は使わない) */
  --color-ink-secondary: #55534E;  /* 本文 */
  --color-ink-tertiary:  #8B887F;  /* キャプション・メタ情報 */

  /* Accent */
  --color-accent:        #8A6D4B;  /* 真鍮/ブロンズ。リンク下線・小さな強調のみ */
  --color-accent-strong: #6E5539;  /* hover */

  /* Functional */
  --color-line:          #E5E2DC;  /* 罫線(1pxのみ許可) */
  --color-cta:           #1A1A18;  /* CTAボタンは墨色。彩色ボタン禁止 */
  --color-cta-text:      #FFFFFF;
  --color-focus:         #2F6FED;  /* フォーカスリングのみ許可される鮮色 */
  --color-star:          #C9A227;  /* おすすめ度の星 */
}
```

- 使用禁止: 純黒 `#000`、彩度の高い背景色、グラデーション、シャドウ(唯一の例外: 固定ヘッダーの `box-shadow: 0 1px 0 var(--color-line)`)。
- ダークモード: **V1では実装しない**(写真主役の誌面は白が正)。トークン設計上は対応可能な構造を保つ。

### 2.2 タイポグラフィ

| 用途 | フォント | 理由 |
|---|---|---|
| 英字見出し・ロゴ・誌面ラベル | `"Cormorant Garamond", serif`(セルフホスト・サブセット) | Aesop的な静かな高級感。"Travel" "Journal" 等の英字ラベルに使用 |
| 日本語見出し・本文 | `"Zen Kaku Gothic New", system-ui, sans-serif`(セルフホスト・サブセット) | 無印/Notion的な静かなゴシック。可読性と品位の両立 |
| 数値・メタ | 同上 + `font-feature-settings: "tnum"` | 価格・日付の桁揃え |

Google Fonts CDNは使わない(速度・プライバシー)。`@fontsource` 等でセルフホストし、`font-display: swap`、日本語はサブセット化(subset-font)して初期表示を守る。

タイプスケール(1.25倍・Perfect Fourth寄り):

```css
--text-xs:   0.75rem;   /* 12px メタ・キャプション */
--text-sm:   0.875rem;  /* 14px UIラベル・タグ */
--text-base: 1.0625rem; /* 17px 本文(Apple基準) */
--text-lg:   1.25rem;   /* 20px リード文 */
--text-xl:   1.5rem;    /* 24px h3 */
--text-2xl:  2rem;      /* 32px h2 */
--text-3xl:  2.75rem;   /* 44px h1(モバイル 2rem) */
--text-hero: 3.5rem;    /* 56px Hero(モバイル 2.25rem) */

--leading-tight: 1.3;   /* 見出し */
--leading-body:  1.9;   /* 日本語本文 */
--tracking-wide: 0.08em;/* 英字ラベル(uppercase時) */
```

本文の行長は全角38〜42字(`max-width: 42em` 相当、実装は `--measure: 680px`)。

### 2.3 スペーシング

8pxベース。**余白は大胆に**(セクション間はモバイル80px/デスクトップ128px)。

```css
--space-1: 4px;  --space-2: 8px;   --space-3: 16px;  --space-4: 24px;
--space-5: 32px; --space-6: 48px;  --space-7: 64px;  --space-8: 96px;
--space-9: 128px;
--section-gap: clamp(80px, 12vw, 128px);
--container-max: 1200px;   /* 通常コンテナ */
--container-wide: 1440px;  /* ギャラリー・Hero */
--container-text: 680px;   /* 記事本文 */
```

### 2.4 レイアウトグリッド

- デスクトップ: 12カラム、gutter 24px、外側余白 max(24px, 4vw)
- タブレット: 8カラム
- モバイル: 4カラム、外側余白 20px
- ブレークポイント: `sm: 640px / md: 768px / lg: 1024px / xl: 1280px`

### 2.5 角丸・線・影

```css
--radius-none: 0;      /* 写真・カードは原則角丸なし(誌面的) */
--radius-sm: 2px;      /* タグ・入力欄のみ */
--radius-full: 999px;  /* お気に入りボタン等の円形アイコンのみ */
--border-thin: 1px solid var(--color-line);
```

影は禁止(前述の例外のみ)。カードの区切りは余白と1px罫線で表現。

### 2.6 モーション

```css
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
--duration-fast: 200ms;   /* hover */
--duration-base: 350ms;   /* 出現フェード */
```

許可される動き: (1) hover時の画像 `opacity 0.92` または `scale(1.02)`(どちらか一方をサイト全体で統一。→ scale採用)、(2) スクロール出現時の `opacity 0→1 + translateY(12px→0)`(IntersectionObserver・1回のみ)、(3) ページ遷移のView Transitions(Astro標準・フェードのみ)。それ以外の動きは実装しない。

## 3. 写真ガイドライン(ブランドの生命線)

| 項目 | 規定 |
|---|---|
| アスペクト比 | Hero 16:9 または 3:2 / 商品サムネ 4:5(Instagram感) / ギャラリー 3:2 |
| トーン | 自然光・余白のある構図・生活感のある背景。白飛び/過彩度の加工は不可 |
| 物撮り | 純白背景の切り抜き画像は使わない(ECサイトに見えるため)。生活シーンの中の商品を使う |
| alt | 全画像必須。「何が写っているか+文脈」を1文で(AI生成→人間確認) |
| フォーマット | 原本はJPEG/HEIC→ビルド時にAVIF/WebP自動変換(Astro `<Image>`) |
| 最大表示幅 | 2x解像度で書き出し。Heroは1920px、カードは800px |

## 4. ボイス&トーン(AI生成の文体規定)

- 一人称は「わたし」または「うち」。です・ます調。
- 誇張語禁止:「神」「最強」「絶対」「爆売れ」等は使用しない。
- 正直さ: 良かった点と同じ重みで「気になった点」を必ず書く(信頼=ブランド)。
- 文は短く。1段落3文まで。体験→事実→気持ちの順。
- 絵文字: サイト上では使わない。SNS派生(Threads/ストーリー)では1投稿2個まで。
- このボイス&トーン定義はAIプロンプトの共通システム指示として `content/brand/voice.md` に置き、全生成で参照する(→ [09-ai-pipeline.md](09-ai-pipeline.md))。

## 5. アクセシビリティ実装基準

- ランドマーク: `header/nav/main/footer` を全ページで使用。スキップリンク設置。
- フォーカス: `:focus-visible` に2pxリング(`--color-focus`)。フォーカス順はDOM順。
- コントラスト: `--color-ink-tertiary`(#8B887F)は白背景で4.6:1を確認済み。これ未満の薄灰は文字に使わない。
- タッチターゲット: 最小44×44px。
- 画像リンクのアクセシブルネーム: カード全体リンクは記事タイトルをアクセシブルネームとする(擬似要素stretched-linkパターン)。
- 動き: `prefers-reduced-motion: reduce` で全transition/animation無効。
- 検索・メニュー等のインタラクティブUIはWAI-ARIA APGのパターンに準拠(dialog, disclosure)。
