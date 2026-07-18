# pipeline/

AIコンテンツ生成パイプライン(09章・26章ブロックD)の実装。GitHub Actions
`generate.yml`(26章c22で追加予定)から `pipeline/scripts/` 配下の各ステージ
スクリプトが呼ばれる想定。

## 構成

- `config.json` — モデル・温度・リトライ設定の一元管理(モデル更新はここ1箇所)。
  ステージ別に `stages.{stageName}` で上書き可能(未指定項目はトップレベルの値を継承)
- `lib/claude.mjs` — Claude Messages API呼び出しラッパー。`config.json` の設定を適用し、
  429/5xxは指数バックオフでリトライ。`ANTHROPIC_API_KEY` 未設定時は明確なエラーで停止
- `lib/github.mjs` — GitHub REST APIヘルパー(Issue取得・コメント・Issue/PR作成)。
  `GITHUB_TOKEN`/`GITHUB_REPOSITORY` はGitHub Actions実行時に環境変数から取得
- `lib/parse-intake.mjs` — Intake Issue本文(09章§3: メモ+撮影日+画像)を
  `{ memo, imageUrls, date }` に正規化するパーサ
- `prompts/` — 各ステージのプロンプトテンプレート(26章c18以降で追加)
- `scripts/` — 各ステージの実行スクリプト(26章c18以降で追加)

## 必要な環境変数(GitHub Secrets)

| 変数名 | 用途 | 設定タイミング |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API呼び出し(`lib/claude.mjs`) | 26章c17以降(実際に呼び出すのはc18から) |
| `GITHUB_TOKEN` | Issue/PR操作(`lib/github.mjs`) | Actions実行時は自動付与(追加設定不要) |

ローカル実行時は `ANTHROPIC_API_KEY` 等が未設定のため、`lib/claude.mjs` は
実際にAPIを呼ぶ前に明確なエラーメッセージで停止する(壊れたまま無言で
失敗しない)。
