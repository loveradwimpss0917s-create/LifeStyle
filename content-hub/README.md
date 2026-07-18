# content-hub/

AIパイプライン(26章c23 derive-sns)が生成するSNS派生文面の保存先。
`astro.config.mjs` はこのディレクトリを一切参照しない(Astroのビルド対象は
`src/pages/` 配下のルーティングと `public/` の静的パススルーのみ)ため、
ここに置かれたファイルはサイトの公開ページには一切出力されない
(サイト非公開データ)。

## 構成

```
content-hub/
└── sns/
    └── {productId}/
        ├── ig-feed.md      # Instagramフィード(キャプション+ハッシュタグ15個)
        ├── ig-reel.md      # Instagramリール台本(6〜9シーン)
        ├── ig-story.md     # Instagramストーリー構成案(3枚)
        ├── threads.md      # Threads投稿文(250字以内)
        ├── tiktok.md       # TikTok台本
        └── yt-shorts.md    # YouTube Shorts(タイトル・説明欄・タグ・台本)
```

各商品のPR(`content/{issue番号}-{slug}`)に商品Markdown・画像とあわせて
コミットされる(`pipeline/scripts/open-pr.mjs`)。オーナーはPRマージ後、
生成された文面/台本をコピーして各SNSへ手動投稿する(V3時点では自動投稿は
行わない。24章の自動化レベル表でL2=AI生成・人間が最終判断)。
