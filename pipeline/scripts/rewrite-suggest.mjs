/**
 * rewrite-suggest(リライト候補の週次Issue) — 26章c25(24章L2)
 *
 * publishedAt/updatedAtのうち新しい方(参照日)から90日超経過した
 * published商品・記事を抽出し、優先度順(経過日数の降順)でIssueに起票する
 * (.github/workflows/rewrite-suggest.yml・週次cron+手動dispatch)。
 *
 * TODO(拡張点): クリックデータ(Analytics Engine・26章c11)が蓄積された後は、
 * 単純な経過日数だけでなく直近のクリック数下降トレンドを優先度に加味する。
 * 現時点ではAnalytics Engineの集計手段が週次レポート(c26)側にしかないため、
 * 経過日数のみを優先度の代理指標として用いている。
 *
 * astro:contentはVite経由の仮想モジュールのため素のNodeスクリプトからは
 * 読み込めない(scripts/check-content-integrity.mjsと同じ制約)。そのため
 * src/content配下のMarkdown/MDXを直接パースする。
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { findOpenIssueByLabel, commentOnIssue, createIssue } from '../lib/github.mjs';

const STALE_DAYS = 90;
const ISSUE_LABEL = 'rewrite-suggest';
const DAY_MS = 24 * 60 * 60 * 1000;

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, 'src/content');

function parseFrontmatter(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return {};
  return parseYaml(match[1]) ?? {};
}

function loadPublishedEntries(dir, extension) {
  const dirPath = path.join(CONTENT_DIR, dir);
  return readdirSync(dirPath)
    .filter((f) => f.endsWith(extension))
    .map((f) => {
      const id = f.replace(new RegExp(`\\${extension}$`), '');
      const data = parseFrontmatter(path.join(dirPath, f));
      return { id, data };
    })
    .filter((entry) => entry.data.status === 'published');
}

function daysSince(date) {
  return Math.floor((Date.now() - date.getTime()) / DAY_MS);
}

function collectCandidates() {
  const products = loadPublishedEntries('products', '.md').map((p) => ({
    type: '商品',
    id: p.id,
    label: p.data.name ?? p.id,
    url: `/products/${p.id}/`,
    referenceDate: new Date(p.data.updatedAt ?? p.data.publishedAt),
  }));
  const articles = loadPublishedEntries('articles', '.mdx').map((a) => ({
    type: '記事',
    id: a.id,
    label: a.data.title ?? a.id,
    url: `/articles/${a.id}/`,
    referenceDate: new Date(a.data.updatedAt ?? a.data.publishedAt),
  }));

  return [...products, ...articles]
    .map((entry) => ({ ...entry, elapsedDays: daysSince(entry.referenceDate) }))
    .filter((entry) => entry.elapsedDays > STALE_DAYS)
    .sort((a, b) => b.elapsedDays - a.elapsedDays);
}

function buildIssueBody(candidates) {
  const rows = candidates.map(
    (c, i) => `| ${i + 1} | ${c.type} | [${c.label}](${c.url}) | ${c.elapsedDays}日 |`
  );
  return [
    `週次リライト候補チェックで、公開から${STALE_DAYS}日以上更新のない記事・商品を${candidates.length}件検出しました(${new Date().toISOString().slice(0, 10)})。`,
    '',
    '経過日数が長い順に並べています(現時点ではクリック数トレンドは未加味・拡張点は`pipeline/scripts/rewrite-suggest.mjs`のTODOコメント参照)。',
    '',
    '| # | 種類 | タイトル | 経過日数 |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
}

const candidates = collectCandidates();

if (candidates.length === 0) {
  console.log(`[rewrite-suggest] ${STALE_DAYS}日超のリライト候補はありませんでした。`);
  process.exit(0);
}

console.log(`[rewrite-suggest] ${candidates.length}件のリライト候補を検出しました:`);
for (const c of candidates) {
  console.log(`  - [${c.type}] ${c.label} (${c.elapsedDays}日経過)`);
}

const body = buildIssueBody(candidates);
const existing = await findOpenIssueByLabel(ISSUE_LABEL);

if (existing) {
  await commentOnIssue(existing.number, body);
  console.log(`[rewrite-suggest] 既存Issue #${existing.number} にコメントを追加しました`);
} else {
  const created = await createIssue({
    title: `[週次] リライト候補 ${candidates.length}件`,
    body,
    labels: [ISSUE_LABEL],
  });
  console.log(`[rewrite-suggest] 新規Issue #${created.number} を作成しました`);
}
