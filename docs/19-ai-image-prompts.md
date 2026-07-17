# 19. AI画像生成プロンプト集 — HIBISTACK

> 対象は**写真的アセットのみ**。ロゴ・favicon・アイコン・OGPはSVG/コードで作る(14章・15章)ため
> AI生成しない(ベクター精度と再現性のため)。ここでのAI画像は実写真が用意できるまでのプレースホルダー、
> または背景・イラスト素材として使う。商品ページの画像は必ず実写真(13章§8)— AI生成画像を実体験の証拠として使うことは禁止。

## 1. 共通スタイル定義(全プロンプト先頭に付与)

```
Japanese minimal lifestyle editorial photography, japandi interior,
soft natural window light, warm neutral palette (warm white #F7F6F4,
oak wood, beige, muted greige), calm and quiet mood, generous negative space,
shot on 35mm lens, shallow depth of field, high-end magazine quality
(Kinfolk / Cereal magazine style), no people or only hands partially visible,
no text, no logos, no watermarks
```

ネガティブ(対応モデルのみ): `saturated colors, clutter, flash photography, HDR look, fisheye, text, watermark, people faces`

## 2. アセット別プロンプト

### 2.1 Hero(トップ)1920×1080(16:9)
```
[共通] + A serene dining space in morning light, oak dining table by a large
window, paper cord chair, steam rising from a ceramic coffee cup, long soft
shadows, composition with wide empty space on the upper third for breathing room
```
差し替え運用(季節ごと): 「morning light」を夏=「bright early summer light, linen curtain」/ 冬=「low warm winter light, wool blanket on chair」等に置換。

### 2.2 カテゴリ画像 各1440×480(3:1)+カード用480×320(3:2)

| カテゴリ | 固有部分(共通スタイルに追記) |
|---|---|
| travel 旅行 | packed leather weekender bag on hotel bed linen, passport and film camera beside, window light of a ryokan |
| parenting 子育て | small wooden toys and a tiny stainless bottle on oak floor, soft blanket, gentle pastel-neutral tones |
| living 暮らし | corner of a calm living room, linen sofa, stacked books and a ceramic vase on oak side table |
| daily-goods 日用品 | neatly folded white towels and amber glass soap bottles on open wooden shelf |
| appliances 家電 | minimal matte-white kettle and toaster on oak kitchen counter, morning light |
| coffee コーヒー | pour-over coffee brewing, gooseneck kettle, glass server, coffee beans scattered on wooden board |
| photography 写真 | vintage film camera and printed photographs spread on linen cloth, window light |

### 2.3 背景・テクスチャ(セクション背景の代替が必要になった場合のみ)
```
[共通] + abstract close-up of warm white plaster wall texture with soft
diagonal daylight gradient, almost monochrome, extremely subtle
```
※原則、背景は単色トークンで表現する。テクスチャ背景の常用は禁止(視認性・軽量性)。

### 2.4 イラスト(404・空状態など・任意)
```
minimal single-weight line illustration, 1.5px stroke, warm dark ink color
#1A1A18 on transparent background, rounded line caps, japanese stationery
aesthetic, subject: [an empty open notebook / a paper airplane / a coffee cup],
no fill, no shading, matches geometric icon system
```
アイコンシステム(15章)と同じ線言語に揃えること。

### 2.5 SNSヘッダー
- X/YouTube 1500×500・2560×1440(セーフゾーン中央1546×423):
```
[共通] + wide panoramic composition of a quiet japandi living room in morning
light, main subject on the right third, left two-thirds kept as calm empty
wall space for overlaying the wordmark later
```
※ワードマークは生成後にデザインツールで重ねる(AIに文字を描かせない)。

### 2.6 About・プロフィール(人物を出さない方針の場合)
```
[共通] + over-the-shoulder view of hands holding a film camera by a window,
face not visible, warm knit sleeve, homely atmosphere
```

## 3. 生成・採用ワークフロー

1. 生成サイズは必要サイズの2倍以上で出力し、sharpで実寸へ縮小(q80 / webp化はAstroに任せる)
2. 採用基準: ①色域が --color-bg / bg-secondary と調和 ②被写体がHIBISTACKで実際に扱うジャンル ③AI特有の破綻(歪んだ手・文字・非現実的な物体)がない
3. ファイル配置は実写真と同じ規約(`src/assets/{site,categories,articles}/`)。ファイル名に `ai-` プレフィックスを付け、実写真と区別できるようにする
4. alt属性に「イメージ写真」と明記し、実体験写真と誤認させない(信頼はブランドの生命線)
5. 実写真が用意でき次第、同名置き換えで退役させる
