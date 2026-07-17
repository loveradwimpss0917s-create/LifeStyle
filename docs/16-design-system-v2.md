# 16. デザインシステム v2 — HIBISTACK(ダークモード対応)

> 03章のデザインシステムを継承・拡張する。**V1の視覚言語(温かい白・墨・ブロンズ・セリフ英字)は
> HIBISTACKの参照ブランド群(Apple/無印/Aesop/NOT A HOTEL)と完全に整合しており、変更しない。**
> v2の追加は ①ダークテーマ ②セマンティックトークン整理 ③シャドウ/ボタン/フォーム規定 ④モーショントークン。
> `src/styles/tokens.css` が唯一の正である原則は不変。

## 1. カラー

### 1.1 ライトテーマ(現行値を正とする。変更なし)

commit9でWCAG AA実測済みの現行値(tokens.css)をそのまま維持する。
`--color-ink-tertiary: #6f6c65` `--color-accent: #7c6243` は実測コントラスト検証済みのため、03章の旧値に戻さないこと。

### 1.2 ダークテーマ(新規)

純黒は使わない。墨の世界観を反転した「温かい闇」。すべてブラウンを一滴含む暖色系グレー。

```css
html[data-theme='dark'] {
  --color-bg: #161513;            /* ページ背景(温かい近黒) */
  --color-bg-secondary: #1e1d1a;  /* セクション背景 */
  --color-bg-tertiary: #262420;   /* タグ・控えめな面 */

  --color-ink: #f2f0ec;           /* 見出し(純白は使わない) */
  --color-ink-secondary: #c9c6bf; /* 本文 */
  --color-ink-tertiary: #98948b;  /* メタ情報(bg上6.2:1 / bg-tertiary上5.1:1) */

  --color-accent: #c9a86e;        /* ブロンズ明色(bg上約8:1) */
  --color-accent-strong: #d8bc8a; /* hover(ダークでは明るくする方向) */

  --color-line: #35332e;
  --color-cta: #f2f0ec;           /* CTAは生成り面+墨文字に反転 */
  --color-cta-text: #161513;
  --color-focus: #6f9dff;         /* ダーク背景で視認できる明度に調整 */
  --color-star: #d8b23a;
}
```

- 実装後、両テーマ×全ページでLighthouseのコントラスト検査を必ず実測すること(上記は計算値。実測が正)
- 写真はダークで発光して見えるため `html[data-theme='dark'] img { filter: brightness(.92); }` を既定とし、ギャラリー内など意図的に除外したい箇所はクラスで解除

### 1.3 テーマ切替の仕組み

| 項目 | 仕様 |
|---|---|
| 属性 | `<html data-theme="light|dark">`。未指定時はライト |
| 初期化 | `<head>` 最上部の `is:inline` スクリプトで localStorage(`hibistack:theme`)→ なければ `prefers-color-scheme` を読み、**CSS読込前に**属性を設定(FOUC防止) |
| 切替UI | ヘッダーの sun/moon アイコンボタン(15章)。`aria-label="ダークモードに切り替え"` を状態で切替 |
| 永続化 | localStorage。システム設定変更のライブ追従は保存値がない場合のみ |
| View Transitions | `<html>` 属性は遷移で保持される。切替ボタンのリスナーは既存パターン(`data-astro-rerun` + IIFE + プレーンJS)で再取得 |
| theme-color | `<meta name="theme-color">` を2枚(`media="(prefers-color-scheme: ...)"`)+ JS切替時にJSで更新 |

## 2. タイポグラフィ

03章の書体・サイズ体系を維持。v2で明文化する追加規定:

| 規定 | 値 |
|---|---|
| h1モバイル | `--text-3xl-mobile: 2rem`(実装済み。768px未満の全h1に適用) |
| 見出しの折返し | `text-wrap: balance`(実装済み)+ `overflow-wrap: break-word` |
| カードタイトル | 2行line-clamp+2行分のmin-height(実装済み。グリッドの行揃え担保) |
| 本文最大行長 | `--measure: 680px`。日本語本文の行間 `--leading-body: 1.9` |
| 数字 | `font-feature-settings: 'tnum'`(価格・日付・順位) |
| 英字ラベル | Cormorant Garamond / uppercase / `--tracking-wide` — セクション見出しの誌面的アクセントに限定。本文への使用禁止 |

## 3. スペーシング / レイアウト

03章の8pxベース(--space-1〜9)・コンテナ(1200/1440/680)・ブレークポイント(640/768/1024/1280)を変更なしで継承。

## 4. 角丸・ボーダー・シャドウ

| トークン | 値 | 用途 |
|---|---|---|
| --radius-none / sm / full | 0 / 2px / 999px | 誌面的シャープさを維持。カード画像は0、ボタン2px、タグchipはfull |
| --border-thin | 1px solid var(--color-line) | 唯一の罫線。太線・二重線禁止 |
| --shadow-sm(新規) | 0 1px 2px rgb(26 26 24 / .06) | sticky要素の浮き(ヘッダー・Sticky CTA) |
| --shadow-md(新規) | 0 8px 32px rgb(26 26 24 / .10) | オーバーレイ(モバイルメニュー等)のみ |

シャドウは上記2種のみ。カードに常時影は付けない(hover時も付けない。動きはscaleで表現)。
ダークテーマでは影はほぼ視認されないため、代わりに `--color-line` の境界線で面を分離する。

## 5. ボタン

| 種別 | 仕様 | 用途 |
|---|---|---|
| Primary(CTA) | 面: --color-cta / 文字: --color-cta-text / radius 2px / 高さ52px(lg)・full width可 / hover: 不透明度92% + 文字下アイコン矢印2px右移動 | アフィリエイトボタンのみ |
| Secondary | 1px線(--color-ink)+透明面 / 高さ44px / hover: 面が--color-ink・文字反転(200ms) | 「すべての記事へ」等の回遊 |
| Text | 下線リンク+arrow-right / hover: 下線がaccent色 | セクション末尾リンク |
| アイコンボタン | 44×44px透明面 / hover: bg-secondary円形 / aria-label必須 | 検索・メニュー・テーマ切替 |

彩色ボタン禁止(03章踏襲)。押下時 `transform: scale(.98)` 100ms(18章)。

## 6. フォーム(検索・将来のNewsletter)

| 項目 | 値 |
|---|---|
| 入力欄 | 高さ48px / --border-thin / radius 2px / bg: --color-bg / focus: --color-focus 2pxリング(outline-offset 2px) |
| プレースホルダ | --color-ink-tertiary |
| エラー | 彩色は使わず、線をinkに+テキストで明示(静かなエラー) |

## 7. カード

| 種別 | 構成(実装済みを正とする) |
|---|---|
| ProductCard | 4:5画像 → ブランド名(xs/tertiary)→ 商品名(base/2行clamp)→ 星。hover: 画像scale(1.02) |
| ArticleCard | 3:2画像 → カテゴリ英字(xs/accent)→ タイトル(lg/2行clamp)→ 日付 |
| CategoryCard | 3:2画像 + 英字大 + 和名小 |
| 共通 | stretched-linkでカード全域リンク。影なし。境界線なし(画像と余白で区切る) |

## 8. グリッド

| コンテンツ | Mobile | ≥768px | ≥1024px |
|---|---|---|---|
| ProductGrid | 2列 | 3列 | 4列 |
| ArticleGrid | 1列 | 3列 | 3列 |
| CategoryGrid | 2列 | 3列 | 3列 |
| gutter | --space-5(32px)固定 | | |

## 9. アニメーショントークン(18章の基盤)

```css
:root {
  --duration-fast: 200ms;   /* hover・押下・下線 */
  --duration-base: 350ms;   /* 出現フェード・テーマ切替 */
  --duration-slow: 600ms;   /* Heroの初回演出のみ */
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --motion-distance: 16px;  /* 出現時の移動量上限 */
}
```

`prefers-reduced-motion: reduce` では全transition/animationを無効化(既存ScrollRevealの方針を全体に拡張)。

## 10. トークン変更の運用ルール

1. 値の変更は必ず `tokens.css` から(コンポーネント内に生値を書かない)
2. 色を追加する場合、ライト/ダーク両方の値と、主要背景に対する実測コントラストをコミットメッセージに記す
3. Lighthouse(両テーマ)で a11y 100 を維持できない変更はマージしない
