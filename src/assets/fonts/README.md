# zen-kaku-gothic-new-cjk-400.ttf

OG画像生成(`src/pages/og/[...slug].png.ts`)専用のフォントファイル。
サイト本体のCSS(`@fontsource/zen-kaku-gothic-new`)には使わない。

## なぜこのファイルが必要か

satori(OG画像のSVG生成に使用)は TTF/OTF/WOFF のみ対応し、WOFF2は非対応。
また `@fontsource/zen-kaku-gothic-new` はブラウザの `unicode-range` 分割配信を前提に
120以上のサブセットWOFFファイルに分割されており、satoriはunicode-rangeを解釈しないため
そのままではどのサブセットも「使われている文字を含まないフォント」として扱われ、
日本語が描画されない(空のpathになる)ことを確認済み。

そこで、全サブセット(400ウェイト・非latin)を [fonttools](https://github.com/fonttools/fonttools)
の `merge` 機能で1つのTTFに統合し、satoriが単一フォントとして日本語グリフを解決できるようにした。

## 再生成手順(フォント更新時)

```bash
pip install fonttools
python3 -c "
from fontTools.merge import Merger
import glob
files = sorted(glob.glob('node_modules/@fontsource/zen-kaku-gothic-new/files/zen-kaku-gothic-new-*-400-normal.woff'))
files = [f for f in files if 'latin' not in f]
merged = Merger().merge(files)
merged.flavor = None
merged.save('src/assets/fonts/zen-kaku-gothic-new-cjk-400.ttf')
"
```

サイズは約4.5MB(標準的な日本語グリフをほぼ全て含むため)。ビルド成果物には含まれず、
OGP画像生成時にNode.js側で読み込むだけなので配信サイズには影響しない。
