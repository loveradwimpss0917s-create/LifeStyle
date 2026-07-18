/**
 * プロンプトテンプレート変数展開 — 26章c17基盤/c19で共有libへ切り出し
 * analyze.mjs(c18)・compose-product.mjs(c19)など複数ステージで使うため
 * pipeline/lib/ に配置する(単一消費者だった時点ではanalyze.mjs内に
 * 閉じていたが、2ステージ目の追加で重複が生じるため切り出した)。
 */

/**
 * テンプレート先頭等のHTMLコメント(`<!-- -->`)は開発者向けドキュメントであり、
 * APIに送る実際のプロンプトには含めない。コメント内にたまたま `{{memo}}` の
 * ような記法が書かれていた場合でも変数展開の対象にしないための必須処理
 * (実際にこの順序を守らずコメント内の{{memo}}まで展開してしまい、
 * <intake_memo>デリミタより前でメモ本文が展開される=プロンプト
 * インジェクション対策が無効化されるバグが analyze.mjs実装時に発覚したため、
 * 変数展開より必ず先にコメントを除去する)。
 */
export function stripHtmlComments(template) {
  return template.replace(/<!--[\s\S]*?-->/g, '');
}

export function renderTemplate(template, vars) {
  const withoutComments = stripHtmlComments(template);
  return withoutComments.replace(/\{\{(\w+)\}\}/g, (_, key) => (key in vars ? String(vars[key]) : ''));
}
