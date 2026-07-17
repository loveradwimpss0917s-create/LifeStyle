# 18. モーションデザイン — HIBISTACK

> 原則: **動きは意味の説明であって装飾ではない**(Apple HIGの思想)。
> 1画面で同時に動くものは3つまで。移動距離は16px以内。ユーザー操作への応答は200ms以内に開始。
> `prefers-reduced-motion: reduce` で全モーションが即時状態遷移になることを全項目の受け入れ条件とする。

## 1. トークン(16章§9で定義済み)

| 用途 | duration | easing |
|---|---|---|
| hover / 押下 / 下線 / 色 | 200ms | --ease-out |
| 出現(fade/slide)/ テーマ切替 | 350ms | --ease-out |
| Hero初回演出 | 600ms | --ease-out |
| 退場系 | 200ms(出現より速く) | --ease-in-out |

## 2. カタログ

### 2.1 Scroll Reveal(実装済み・維持)
`.reveal` 要素: opacity 0→1 + translateY(16px)→0・350ms。IntersectionObserver 1回のみ。stagger 80ms(兄弟要素はCSS `transition-delay` で最大3つまで階段状に)。

### 2.2 Hero(トップのみ・初回ロード)
1. 写真: opacity 0→1 + scale(1.03)→1・600ms
2. 英字ラベル: 100ms遅延で fade-up
3. タグライン: 180ms遅延で fade-up

View Transitions経由の再訪では再生しない(初回ハードロードのみ。`document.visibilityState` 等での複雑な判定はせず、`data-astro-rerun` を付けない初回専用インラインscriptで実現)。

### 2.3 Card Hover(実装済み・維持)
画像 scale(1.02)・200ms。カード自体は動かさない(レイアウトシフト感を出さない)。タイトル色は変えない(画像の動きだけで十分)。

### 2.4 リンク下線
テキストリンクhover: 下線色が ink→accent へ200ms。セクション末尾リンクの矢印は2px右移動。

### 2.5 ボタン
- hover: Primary=不透明度92% / Secondary=面反転200ms
- active: scale(0.98)・100ms(タップの手応え)

### 2.6 ヘッダー(実装済み・維持+追加)
退場 translateY(-100%)/再表示・350ms。8px閾値で下線+blurが200msでフェードイン。

### 2.7 Page Transition(View Transitions API)
- 既定: クロスフェード200ms(ClientRouterのデフォルトを尊重。凝ったslide遷移は静的メディアには過剰)
- 商品カード→商品ページ: メイン画像に `transition:name="product-image-{slug}"` を付与し、カード画像から商品ギャラリーへの連続morphを実現(対応ブラウザのみ。非対応はフェードに自然フォールバック)
- 実装上の鉄則(V1で実証済みの教訓): 遷移後に動くスクリプトは `is:inline data-astro-rerun` + IIFE + プレーンJS + 再バインドガード

### 2.8 Reading Progress(記事)
スクロールに完全同期(easingを掛けない=指の動きと1:1)。rAFでthrottle。

### 2.9 Sticky CTA(商品・モバイル)
出現 translateY(100%)→0・350ms / 退場200ms。出現は1スクロールセッションで1回だけアニメーションし、以後は即時切替(何度も滑り出て気を散らさない)。

### 2.10 Back to Top
出現/退場 opacity+8px・200ms。クリック時のスクロールは `scroll-behavior: smooth`(reduced-motionでは `auto`)。

### 2.11 テーマ切替
`html { transition: background .35s var(--ease-out), color .35s var(--ease-out); }` を切替の瞬間だけ有効化(常時付けるとページ遷移で色がにじむため、切替時にクラス付与→transitionend後に除去)。アイコンはsun⇄moonをopacityクロスフェード200ms。

### 2.12 Skeleton / Loading
静的サイトのため原則不要。唯一の非同期UIである検索(Pagefind)結果待ちのみ、bg-secondaryの矩形プレースホルダー(シマーなし・点滅なし)を許可。スピナーは全サイトで禁止。

## 3. 禁止事項

- パララックス、無限ループアニメーション、自動再生カルーセル
- 16pxを超える移動、rotate/skewによる出現
- スクロールジャック(スクロール量の乗っ取り)
- ホバーでの情報の出し分け(タッチデバイスで到達不能になる)

## 4. 品質基準

- すべてのアニメーションは `transform` / `opacity` のみで実装(layout/paintを発生させない)
- `will-change` は使用箇所を3つまで(ヘッダー・Sticky CTA・プログレスバー)に限定
- CLS: アニメーション起因のレイアウトシフト0(出現前から領域を確保)
- 4x CPUスロットルのLighthouseでTBT悪化がないことを実測(V1のフォント教訓: 実測が正)
