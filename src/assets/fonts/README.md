# zen-kaku-gothic-new-cjk-400.ttf / zen-kaku-gothic-new-cjk-400.woff2

このディレクトリの `.ttf` は2つの用途で使われる、全CJKグリフ統合済みのソースフォント。
`.woff2` はそこから実際に配信する文字だけを切り出した、サイト本体のCSS用フォント。

## .ttf: なぜ必要か(OG画像生成用ソース)

OG画像生成(`src/pages/og/[...slug].png.ts`)は satori を使うが、satori は TTF/OTF/WOFF
のみ対応(WOFF2非対応)。また `@fontsource/zen-kaku-gothic-new` はブラウザの
`unicode-range` 分割配信を前提に120以上のサブセットWOFFファイルに分割されており、
satoriはunicode-rangeを解釈しないため、そのままではどのサブセットも「使われている
文字を含まないフォント」として扱われ、日本語が描画されない(空のpathになる)ことを
確認済み。

そこで、全サブセット(400ウェイト・非latin)を [fonttools](https://github.com/fonttools/fonttools)
の `merge` 機能で1つのTTFに統合し、satoriが単一フォントとして日本語グリフを解決できるようにした。

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

## .woff2: なぜ必要か(サイト本体CSS用、実際に配信されるフォント)

`src/styles/fonts.css` の `@font-face` はこの `.woff2` を参照し、全ページで配信される。
以前は上記 `.ttf` をそのままWOFF2圧縮しただけ(4.5MB→1.1MB、日本語グリフをほぼ全網羅)
だったが、モバイル実測(2026年8月監査)でこの1.1MBがFCP/LCPの支配的要因になっている
ことが判明した(`docs/32-full-audit-2026-08.md` C-2参照)。

サイトの実コンテンツで実際に使われている文字は数百字程度に過ぎないため、
[pyftsubset](https://github.com/fonttools/fonttools) で「ビルド済みdist内で実際に
使われている文字 + ひらがな/カタカナ/半角記号/全角記号(常に必要なUI文字のバッファ)」
だけを切り出す方式に変更した。1.1MB→約131KB(-89%)。

フォールバックは `--font-ja: 'Zen Kaku Gothic New', system-ui, sans-serif`
(`src/styles/tokens.css`)のため、サブセットに含まれない文字(将来の新規記事で
使う未収録の漢字など)があってもtofu(□)にはならず、システムフォントに
グレースフルにフォールバックする。

### 再生成手順(新しい漢字を含む記事を追加した後など)

```bash
npm run build   # dist/ に実際のページ内容を反映させる
pip install fonttools
python3 -c "
import glob, re
from html.parser import HTMLParser
from fontTools.subset import main as subset_main

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.chars = set()
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip += 1
        d = dict(attrs)
        for key in ('alt', 'title', 'aria-label', 'placeholder', 'value', 'content'):
            if d.get(key):
                self.chars.update(d[key])
    def handle_endtag(self, tag):
        if tag in ('script', 'style') and self.skip > 0:
            self.skip -= 1
    def handle_data(self, data):
        if self.skip == 0:
            self.chars.update(data)

ex = TextExtractor()
for f in glob.glob('dist/**/*.html', recursive=True):
    ex.feed(open(f, encoding='utf-8').read())

chars = ex.chars
chars.update(chr(c) for c in range(0x20, 0x7F))       # 半角英数記号
chars.update(chr(c) for c in range(0x3040, 0x30FF+1))  # ひらがな・カタカナ
chars.update(chr(c) for c in range(0x3000, 0x303F+1))  # 全角記号(句読点等)
chars.update(chr(c) for c in range(0xFF00, 0xFFEF+1))  # 全角英数・半角カナ
chars.discard('\n'); chars.discard('\t')

open('/tmp/subset_chars.txt', 'w', encoding='utf-8').write(''.join(sorted(chars)))

subset_main([
    'src/assets/fonts/zen-kaku-gothic-new-cjk-400.ttf',
    '--text-file=/tmp/subset_chars.txt',
    '--flavor=woff2',
    '--output-file=src/assets/fonts/zen-kaku-gothic-new-cjk-400.woff2',
    \"--layout-features=*\",
    '--no-hinting',
    '--desubroutinize',
])
"
```

再生成後は必ずビルド+主要ページのスクリーンショット確認(tofu文字がないか)を行うこと。
