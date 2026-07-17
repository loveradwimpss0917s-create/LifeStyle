# 14. ロゴデザイン — HIBISTACK

> ロゴは写真ではなくコードで作る。全ロゴアセットはSVGとして `src/assets/brand/` にコミットし、
> AI画像生成は使用しない(ベクター精度・再現性・軽量性のため)。19章の画像生成プロンプトはロゴ以外の写真素材専用。

## 1. ロゴコンセプト

**シンボルは「日」。**

HIBISTACKの「日々(HIBI)」の一字である漢字「日」は、角丸の縦長矩形+中央の横線という、
極めてミニマルな幾何学で構成できる。これは同時に:

- **積層(STACK)**: 上下2段に分かれた面 = 日々が積み重なるレイヤー
- **記録**: ノート・カードのフレームにも見える
- **国際性**: 漢字を知らない読者には「Hのモノグラム」「窓」「本」として成立する

言葉の意味とブランド名と造形が一致した、説明可能で所有可能なシンボル。
装飾は一切加えない。線の太さと角丸だけで上質さを出す(Aesop的な抑制)。

## 2. シンボルロゴ仕様(SVG)

```
viewBox: 0 0 64 64
外形: x=16, y=8, width=32, height=48, rx=7 の角丸矩形(塗りなし・線のみ)
中線: (16,32) → (48,32) の水平線
線幅: 5 / linecap: round
色: currentColor(単色。グラデーション・多色は禁止)
```

参考実装(favicon兼用):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g fill="none" stroke="#1A1A18" stroke-width="5" stroke-linecap="round">
    <rect x="16" y="8" width="32" height="48" rx="7"/>
    <path d="M16 32h32"/>
  </g>
</svg>
```

- 最小使用サイズ: 16×16px(この構造は16pxでも判読できることを意図した設計)
- 単独使用: favicon / アバター / OGPのアクセント / フッターの透かし
- 禁止: 回転・変形・影・グラデーション・輪郭の二重化・他要素との合成

## 3. ワードマーク仕様

```
書体: Cormorant Garamond SemiBold(600)
組み: 全大文字 HIBISTACK
字間: 0.14em(ロゴ専用。本文ラベルの--tracking-wide=0.08emより広い)
色: currentColor 単色
```

- ヘッダー・フッターはCSSテキストとして実装する(現行実装を踏襲。画像化しない。フォント読込前はセリフ系フォールバックで表示されてよい)
- 印刷・外部提供用にはアウトライン化SVG `wordmark.svg` を用意(V2で必要になった時点で生成)

## 4. ロックアップ(組み合わせ)

| 名称 | 構成 | 用途 |
|---|---|---|
| Wordmark | HIBISTACK 単独 | ヘッダー / フッター / OGP下部 |
| Horizontal | シンボル + 24px相当の間隔 + ワードマーク(シンボル高さ=大文字の1.25倍) | About / ドキュメント / 名刺類 |
| Stacked | シンボルの下にワードマーク(中央揃え) | SNSプロフィール画像まわり / スプラッシュ |
| Symbol | シンボル単独 | favicon / apple-touch-icon / アバター |

**クリアスペース**: すべてのロックアップで、シンボルの線幅×4(=シンボル高さの約1/3)を最小余白とし、内側に他要素を置かない。

## 5. カラー運用

| 背景 | ロゴ色 |
|---|---|
| ライト背景(--color-bg / bg-secondary) | --color-ink(#1A1A18) |
| ダーク背景(16章のダークテーマ) | --color-ink(ダーク値 #F2F0EC) |
| 写真の上 | 原則置かない。置く場合は白100% + 写真側を暗く(スクリム)して4.5:1確保 |
| アクセント色ロゴ | 使用しない(ブロンズはUIのアクセント専用。ロゴは常に墨/生成り) |

## 6. favicon

`public/favicon.svg` を §2 のSVGで置き換える。ダークモードのブラウザUIに追従させる:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <style>
    g { stroke: #1A1A18; }
    @media (prefers-color-scheme: dark) { g { stroke: #F2F0EC; } }
  </style>
  <g fill="none" stroke-width="5" stroke-linecap="round">
    <rect x="16" y="8" width="32" height="48" rx="7"/>
    <path d="M16 32h32"/>
  </g>
</svg>
```

補助として `public/icons/favicon-48.png`(48×48・ライト固定色)を生成し、
`<link rel="icon" type="image/png" sizes="48x48">` でSVG非対応環境にフォールバックする(任意・Low優先)。

## 7. Apple Touch Icon / PWAアイコン

| ファイル | 仕様 |
|---|---|
| `public/icons/apple-touch-icon.png` | 180×180。背景 #F7F6F4 全面(透過禁止・角丸不要=iOSが付与)。シンボルを墨色・高さ96pxで中央配置 |
| `public/icons/icon-192.png` / `icon-512.png` | 同構成。シンボル高さは辺の54% |
| `public/icons/icon-512-maskable.png` | 背景 #F7F6F4、シンボル高さは辺の40%(セーフゾーン80%内に収める) |

生成方法: §2のSVGをsharpでPNG化するNodeスクリプト `scripts/generate-brand-icons.mjs` を追加し、手動生成物のコミットではなく再現可能な生成にする(実行はローカル、生成物はコミット)。

## 8. OGP画像テンプレート(satori)

現行の文字のみ構成(og-image.ts)を、シンボル入りの定型に更新する:

```
1200×630 / 背景 #FFFFFF / padding 80
┌─────────────────────────────┐
│ [シンボル32px] カテゴリ英字ラベル(ブロンズ)     │ ← 上段: 横並び・gap16
│                                                   │
│ タイトル(Zen Kaku Gothic New 400 / 56px /       │ ← 中段: 最大3行
│  行間1.4 / #1A1A18)                              │
│                                                   │
│ HIBISTACK(Cormorant 700 / 32px / 字間6)         │ ← 下段
└─────────────────────────────┘
```

- シンボルはsatori内で `<div>`(border 3px + 角丸 + 内部に中線div)として描画可能。外部SVG読込は不要
- 背景写真の合成はV2以降(12章の判断を踏襲)

## 9. レスポンシブ仕様

| コンテキスト | 表示 |
|---|---|
| ヘッダー ≥768px | ワードマーク(font-size: --text-xl 相当) |
| ヘッダー <768px | ワードマーク(--text-lg 相当。9文字は320px幅でも収まるためシンボル切替は不要) |
| ブラウザタブ | favicon(シンボル) |
| SNSアバター | Symbol(Stackedはプロフィール画像には小さすぎるため不可) |
| OGP | §8テンプレート |

ワードマークはどのブレークポイントでも改行させない(`white-space: nowrap`)。
