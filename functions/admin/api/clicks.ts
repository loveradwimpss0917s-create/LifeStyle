/// <reference types="@cloudflare/workers-types" />
/**
 * /admin/api/clicks — アフィリエイトクリック集計の読み取り専用API。
 * functions/go/[[route]].ts が書き込んでいるAnalytics Engineデータセット
 * (hibistack_clicks)を、Cloudflare Analytics Engine SQL API経由で集計して返す。
 * 認証は functions/admin/_middleware.ts が担当済み(このファイルには到達した
 * 時点で認証済み)。
 *
 * SQL APIの読み取りにはWorkersバインディングではなくアカウントAPIトークン
 * (Account Analytics: Read権限)が必要(書き込み用のCLICKSバインディングとは
 * 別物)。CF_API_TOKEN/CF_ACCOUNT_ID未設定でも他機能を壊さないよう503を返す
 * (0章§0前提)。
 */

interface Env {
  CF_API_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
}

interface AnalyticsEngineSqlResponse {
  data?: Array<Record<string, unknown>>;
  error?: string;
}

async function runQuery(
  accountId: string,
  token: string,
  sql: string
): Promise<{ rows: Array<Record<string, unknown>> } | { error: string }> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body: sql,
    }
  );

  const bodyText = await res.text();

  if (!res.ok) {
    return { error: `Analytics Engine API error (${res.status}): ${bodyText.slice(0, 500)}` };
  }

  try {
    const parsed = JSON.parse(bodyText) as AnalyticsEngineSqlResponse;
    if (parsed.error) return { error: parsed.error };
    return { rows: parsed.data ?? [] };
  } catch {
    return { error: `Analytics Engine APIのレスポンスをJSONとして解析できませんでした: ${bodyText.slice(0, 500)}` };
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    return Response.json(
      { error: 'CF_API_TOKEN または CF_ACCOUNT_ID が未設定です(Cloudflare Pagesの環境変数を確認してください)。' },
      { status: 503 }
    );
  }

  const totalsSql = `
    SELECT blob1 AS product_id, blob2 AS mall, count() AS clicks
    FROM hibistack_clicks
    GROUP BY blob1, blob2
    ORDER BY clicks DESC
    LIMIT 200
  `;

  const byDaySql = `
    SELECT toStartOfDay(timestamp) AS day, count() AS clicks
    FROM hibistack_clicks
    WHERE timestamp > NOW() - INTERVAL '30' DAY
    GROUP BY day
    ORDER BY day ASC
  `;

  const [totals, byDay] = await Promise.all([
    runQuery(env.CF_ACCOUNT_ID, env.CF_API_TOKEN, totalsSql),
    runQuery(env.CF_ACCOUNT_ID, env.CF_API_TOKEN, byDaySql),
  ]);

  return Response.json({
    totals: 'rows' in totals ? totals.rows : [],
    totalsError: 'error' in totals ? totals.error : null,
    byDay: 'rows' in byDay ? byDay.rows : [],
    byDayError: 'error' in byDay ? byDay.error : null,
  });
};
