#!/usr/bin/env node
/**
 * リンク死活チェック — 26章c14
 *
 * check-content-integrity.mjs(07章§7)がビルド前のコンテンツ整合性を
 * 静的にチェックするのに対し、本スクリプトはデプロイ後の**実際に公開
 * されているサイト**を対象に、実URLへHEAD/GETリクエストを送って生死を
 * 確認する(週次cron・.github/workflows/link-check.yml)。
 *
 * チェック対象:
 *   1. published商品のアフィリエイトURL(src/content/products/*.mdの
 *      frontmatterを直接パース。astro:contentは素のNodeスクリプトから
 *      読み込めないため、check-content-integrity.mjsと同じ手法を使う)
 *   2. 内部リンク(公開サイトのsitemap-index.xmlから全URLを収集)
 *
 * 問題を検出した場合のみGitHub Issueを起票(既存のopen issueがあれば
 * コメント追記)する。GITHUB_TOKEN/GITHUB_REPOSITORY未設定時はコンソール
 * 出力のみ(ローカル実行や権限のない環境でも落ちない)。
 * このスクリプト自体は問題を検出してもexit codeは常に0(CIをブロックしない)。
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';

const SITE_URL = process.env.LINK_CHECK_SITE_URL || 'https://lifestyle-ako.pages.dev';
const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 500;
const TIMEOUT_MS = 10000;
const ISSUE_LABEL = 'link-check';

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, 'src/content');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseFrontmatter(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {} };
  return { data: parseYaml(match[1]) ?? {} };
}

function loadPublishedProducts() {
  const dir = path.join(CONTENT_DIR, 'products');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const id = f.replace(/\.md$/, '');
      const { data } = parseFrontmatter(path.join(dir, f));
      return { id, data };
    })
    .filter((p) => p.data.status === 'published');
}

function collectAffiliateTargets() {
  const targets = [];
  for (const product of loadPublishedProducts()) {
    for (const [mall, entry] of Object.entries(product.data.affiliate ?? {})) {
      if (entry?.url) {
        targets.push({ type: 'affiliate', label: `商品「${product.id}」の${mall}リンク`, url: entry.url });
      }
    }
  }
  return targets;
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function collectInternalTargets() {
  try {
    const indexRes = await fetchWithTimeout(new URL('/sitemap-index.xml', SITE_URL).toString(), {});
    if (!indexRes.ok) return [];
    const indexXml = await indexRes.text();
    const sitemapUrls = Array.from(indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);

    const urls = new Set();
    for (const sitemapUrl of sitemapUrls) {
      const res = await fetchWithTimeout(sitemapUrl, {});
      if (!res.ok) continue;
      const xml = await res.text();
      for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        urls.add(m[1]);
      }
    }
    return Array.from(urls).map((url) => ({ type: 'internal', label: url, url }));
  } catch (err) {
    console.warn(`[check-links] sitemap取得に失敗したため内部リンクチェックをスキップします: ${err}`);
    return [];
  }
}

async function checkUrl(url) {
  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      let res = await fetchWithTimeout(url, { method: 'HEAD', redirect: 'follow' });
      if (res.status === 405 || res.status === 501) {
        // HEAD未対応のサーバーはGETにフォールバック
        res = await fetchWithTimeout(url, { method: 'GET', redirect: 'follow' });
      }
      if (res.ok) return { ok: true };
      if (attempt === RETRY_COUNT) return { ok: false, status: res.status };
    } catch (err) {
      if (attempt === RETRY_COUNT) return { ok: false, error: String(err) };
    }
    await sleep(RETRY_DELAY_MS);
  }
  return { ok: false, error: 'unreachable' };
}

async function reportToGitHub(failures) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.log('[check-links] GITHUB_TOKEN/GITHUB_REPOSITORY未設定のためIssue起票をスキップします(ローカル実行など)');
    return;
  }

  const apiBase = `https://api.github.com/repos/${repo}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  const body = [
    `週次リンク死活チェックで ${failures.length} 件の問題を検出しました(${new Date().toISOString().slice(0, 10)})。`,
    '',
    ...failures.map((f) => {
      const detail = f.status ? `status ${f.status}` : f.error ?? 'unknown error';
      const kind = f.type === 'affiliate' ? 'アフィリエイト' : '内部リンク';
      return `- [${kind}] ${f.label}: ${f.url} (${detail})`;
    }),
  ].join('\n');

  const searchRes = await fetch(
    `${apiBase}/issues?state=open&labels=${encodeURIComponent(ISSUE_LABEL)}&per_page=1`,
    { headers }
  );
  const existing = searchRes.ok ? await searchRes.json() : [];

  if (Array.isArray(existing) && existing.length > 0) {
    const issueNumber = existing[0].number;
    await fetch(`${apiBase}/issues/${issueNumber}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body }),
    });
    console.log(`[check-links] 既存Issue #${issueNumber} にコメントを追加しました`);
  } else {
    const createRes = await fetch(`${apiBase}/issues`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: `[自動検出] リンク死活チェックで問題を検出(${failures.length}件)`,
        body,
        labels: [ISSUE_LABEL],
      }),
    });
    const created = await createRes.json();
    console.log(`[check-links] 新規Issue #${created.number ?? '?'} を作成しました`);
  }
}

const affiliateTargets = collectAffiliateTargets();
const internalTargets = await collectInternalTargets();
const allTargets = [...affiliateTargets, ...internalTargets];

console.log(
  `[check-links] ${allTargets.length}件のURLをチェックします(affiliate: ${affiliateTargets.length}件, internal: ${internalTargets.length}件, site: ${SITE_URL})`
);

const failures = [];
for (const target of allTargets) {
  const result = await checkUrl(target.url);
  if (!result.ok) {
    failures.push({ ...target, ...result });
  }
}

if (failures.length === 0) {
  console.log('[check-links] 問題は検出されませんでした。');
} else {
  console.log(`[check-links] ${failures.length}件の問題を検出しました:`);
  for (const f of failures) {
    console.log(`  - [${f.type}] ${f.label}: ${f.url} (${f.status ?? f.error})`);
  }
  await reportToGitHub(failures);
}

// 死活チェックの結果でCIをブロックしない(07章§7と同じ方針)
process.exit(0);
