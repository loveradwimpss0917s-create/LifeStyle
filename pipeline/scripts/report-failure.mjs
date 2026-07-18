/**
 * ワークフロー失敗時のIssueコメント投稿 — 26章c22
 * generate.ymlの `if: failure()` ステップから
 * `node pipeline/scripts/report-failure.mjs <issueNumber> <message>` で呼ぶ。
 * intakeのIssue自体は削除・クローズしない(09章§7「API障害・生成失敗」
 * ガードレール: intakeは失われない)。
 */
import { commentOnIssue } from '../lib/github.mjs';

const [issueNumber, ...messageParts] = process.argv.slice(2);
if (!issueNumber) {
  console.error('Usage: node pipeline/scripts/report-failure.mjs <issueNumber> <message>');
  process.exit(1);
}

const message = messageParts.join(' ') || '生成処理でエラーが発生しました。Actionsのログを確認してください。';

await commentOnIssue(
  issueNumber,
  `⚠️ 自動生成でエラーが発生しました。\n\n${message}\n\n` +
    'このIssue(intake)自体は削除されていません。原因を修正のうえ、' +
    '`intake` ラベルを一度外して再度付け直すか、Actionsから手動で再実行してください。'
);
