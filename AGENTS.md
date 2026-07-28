## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## 記事作成・再編集ワークフロー

オーナーから記事の作成・再編集を依頼されたら、必ず [docs/27-editorial-workflow.md](docs/27-editorial-workflow.md) の
三段階プロンプト(①ライター→②編集長→③公開前チェック(検閲))に従うこと。いずれの段階も省略しない。
編集長段階の11項目×10点セルフチェック(90点未満なら該当セクションのみ書き直して再採点)を実施したうえで、
③検閲段階のA〜Iチェック項目を判定し、最終判定(🟢公開可/🟡修正後公開可/🔴公開不可)が🟢になってから
結果を報告してcommit / pushする。🟡🔴の場合は指摘を修正し検閲を再実施する。

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
