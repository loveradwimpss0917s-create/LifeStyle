/**
 * Intake Issue本文パーサ — 26章c17(09章§3)
 * iPhoneショートカット「HIBISTACKに送る」が作成するIssue本文
 * (メモ+撮影日+画像)を { memo, imageUrls, date } に正規化する。
 *
 * 想定フォーマット(09章§3):
 *   {ひとことメモ、複数行可}
 *
 *   撮影日: 2026-07-15
 *
 *   ![alt](https://.../photo1.jpg)
 *   ![alt](data:image/jpeg;base64,...)
 *
 * 画像は標準的なMarkdown画像記法(`![alt](url)`)であればホスティングURL・
 * data URIのどちらでも抽出できる。撮影日の行・画像行を取り除いた残りを
 * メモ本文とする。
 */

const IMAGE_PATTERN = /!\[[^\]]*\]\(([^)]+)\)/g;
const DATE_LINE_PATTERN = /^\s*撮影日\s*[:：]\s*(\d{4}-\d{2}-\d{2})\s*$/m;

/**
 * @param {string} issueBody
 * @returns {{ memo: string, imageUrls: string[], date: string | null }}
 */
export function parseIntake(issueBody) {
  const body = issueBody ?? '';

  const imageUrls = Array.from(body.matchAll(IMAGE_PATTERN)).map((m) => m[1].trim());

  const dateMatch = body.match(DATE_LINE_PATTERN);
  const date = dateMatch ? dateMatch[1] : null;

  const memo = body
    .replace(IMAGE_PATTERN, '')
    .replace(DATE_LINE_PATTERN, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { memo, imageUrls, date };
}
