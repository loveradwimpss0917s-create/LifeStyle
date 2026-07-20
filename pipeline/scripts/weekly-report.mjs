/**
 * weekly-report(週次レポート) — 26章c26(24章L3: 分析の自動化)
 *
 * Cloudflare GraphQL Analytics API(Web Analyticsのページビュー)と
 * Analytics Engine SQL API(/go/クリック・26章c11のCLICKSデータセット)を
 * 集計し、直近7日分のサマリーをGitHub Issueへ投稿する
 * (.github/workflows/weekly-report.yml・週次cron+手動dispatch)。
 *
 * 必要な環境変数(いずれもオーナー作業・GitHub Secrets):
 *   - CF_API_TOKEN: Account Analytics:Read権限を持つCloudflare APIトークン
 *   - CF_ACCOUNT_ID: CloudflareアカウントID
 *   - CF_WEB_ANALYTICS_SITE_TAG: Web AnalyticsのSite Tag(RUM GraphQLクエリに必須。
 *     PUBLIC_CF_BEACON_TOKENとは別物 — ダッシュボードのWeb Analytics > Manage site
 *     で確認できる値)
 *   - CF_ANALYTICS_ENGINE_DATASET: Analytics Engineのデータセット名(省略時は
 *     functions/go/[[route]].tsのバインディング名に合わせて既定値 "CLICKS")
 *
 * 0章§0の前提どおり、これらが未設定でもスクリプト自体は失敗させない
 * (該当セクションを「未設定」と明記してIssueへ出す)。CF_WEB_ANALYTICS_SITE_TAGの
 * みが未設定でクリック計測だけ有効、といった部分的な設定にも対応する。
 */
import { createIssue } from '../lib/github.mjs';

const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_WEB_ANALYTICS_SITE_TAG = process.env.CF_WEB_ANALYTICS_SITE_TAG;
const CF_ANALYTICS_ENGINE_DATASET = process.env.CF_ANALYTICS_ENGINE_DATASET || 'CLICKS';

const REPORT_LABEL = 'weekly-report';
const LOOKBACK_DAYS = 7;

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function fetchWebAnalytics() {
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID || !CF_WEB_ANALYTICS_SITE_TAG) {
    return { configured: false };
  }

  const since = isoDaysAgo(LOOKBACK_DAYS);
  const until = new Date().toISOString();
  const query = `
    query WeeklyWebAnalytics($accountTag: string!, $siteTag: string!, $since: Time!, $until: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          totals: rumPageloadEventsAdaptiveGroups(
            limit: 1
            filter: { siteTag: $siteTag, datetime_geq: $since, datetime_leq: $until }
          ) {
            count
            sum { visits }
          }
          topPages: rumPageloadEventsAdaptiveGroups(
            limit: 10
            orderBy: [count_DESC]
            filter: { siteTag: $siteTag, datetime_geq: $since, datetime_leq: $until }
          ) {
            count
            dimensions { requestPath }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { accountTag: CF_ACCOUNT_ID, siteTag: CF_WEB_ANALYTICS_SITE_TAG, since, until },
      }),
    });
    const json = await res.json();
    if (!res.ok || json.errors) {
      return { configured: true, error: json.errors?.[0]?.message ?? `status ${res.status}` };
    }
    const account = json.data?.viewer?.accounts?.[0];
    const totals = account?.totals?.[0];
    const topPages = account?.topPages ?? [];
    return {
      configured: true,
      pageviews: totals?.count ?? 0,
      visits: totals?.sum?.visits ?? 0,
      topPages: topPages.map((p) => ({
        path: p.dimensions?.requestPath ?? '(不明)',
        count: p.count,
      })),
    };
  } catch (err) {
    return { configured: true, error: String(err) };
  }
}

async function fetchClicks() {
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
    return { configured: false };
  }

  const sql =
    `SELECT blob1 AS productId, blob2 AS mall, blob3 AS position, SUM(double1) AS clicks ` +
    `FROM ${CF_ANALYTICS_ENGINE_DATASET} ` +
    `WHERE timestamp > NOW() - INTERVAL '${LOOKBACK_DAYS}' DAY ` +
    `GROUP BY blob1, blob2, blob3 ORDER BY clicks DESC LIMIT 20`;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'text/plain',
        },
        body: sql,
      }
    );
    const json = await res.json();
    if (!res.ok) {
      return { configured: true, error: json.error ?? json.errors?.[0]?.message ?? `status ${res.status}` };
    }
    const rows = Array.isArray(json.data) ? json.data : [];
    return {
      configured: true,
      rows: rows.map((r) => ({
        productId: r.productId ?? '(不明)',
        mall: r.mall ?? '(不明)',
        position: r.position ?? '',
        clicks: Number(r.clicks ?? 0),
      })),
    };
  } catch (err) {
    return { configured: true, error: String(err) };
  }
}

function formatWebAnalyticsSection(webAnalytics) {
  if (!webAnalytics.configured) {
    return [
      '### Web Analytics(ページビュー)',
      '',
      '未設定(`CF_API_TOKEN` / `CF_ACCOUNT_ID` / `CF_WEB_ANALYTICS_SITE_TAG` のいずれかが未設定のためスキップ)',
    ].join('\n');
  }
  if (webAnalytics.error) {
    return ['### Web Analytics(ページビュー)', '', `⚠️ 取得エラー: ${webAnalytics.error}`].join('\n');
  }

  const rows = webAnalytics.topPages.map((p, i) => `| ${i + 1} | ${p.path} | ${p.count} |`);
  return [
    `### Web Analytics(ページビュー・直近${LOOKBACK_DAYS}日)`,
    '',
    `- 総ページビュー: ${webAnalytics.pageviews}`,
    `- 総訪問数: ${webAnalytics.visits}`,
    '',
    '**上位ページ**',
    '',
    '| # | パス | ページビュー |',
    '|---|---|---|',
    ...(rows.length > 0 ? rows : ['| - | データなし | - |']),
  ].join('\n');
}

function formatClicksSection(clicks) {
  if (!clicks.configured) {
    return [
      '### アフィリエイトクリック(/go/経由)',
      '',
      '未設定(`CF_API_TOKEN` / `CF_ACCOUNT_ID` が未設定のためスキップ)',
    ].join('\n');
  }
  if (clicks.error) {
    return ['### アフィリエイトクリック(/go/経由)', '', `⚠️ 取得エラー: ${clicks.error}`].join('\n');
  }

  const rows = clicks.rows.map(
    (r, i) => `| ${i + 1} | ${r.productId} | ${r.mall} | ${r.position || '-'} | ${r.clicks} |`
  );
  return [
    `### アフィリエイトクリック(/go/経由・直近${LOOKBACK_DAYS}日)`,
    '',
    '| # | 商品 | モール | 位置 | クリック数 |',
    '|---|---|---|---|---|',
    ...(rows.length > 0 ? rows : ['| - | データなし | - | - | - |']),
  ].join('\n');
}

function buildReportBody({ webAnalytics, clicks }) {
  return [
    `週次レポート(${new Date().toISOString().slice(0, 10)})`,
    '',
    formatWebAnalyticsSection(webAnalytics),
    '',
    formatClicksSection(clicks),
  ].join('\n');
}

const [webAnalytics, clicks] = await Promise.all([fetchWebAnalytics(), fetchClicks()]);
const body = buildReportBody({ webAnalytics, clicks });

console.log(body);

const created = await createIssue({
  title: `[週次レポート] ${new Date().toISOString().slice(0, 10)}`,
  body,
  labels: [REPORT_LABEL],
});
console.log(`[weekly-report] Issue #${created.number} を作成しました`);
