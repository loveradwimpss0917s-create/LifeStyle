/// <reference types="@cloudflare/workers-types" />
/**
 * /go/{productId}/{mall}?pos={position} リダイレクト — 26章c11(23章§1)
 * クリック計測の起点。dist/api/affiliate-map.json(src/pages/api/affiliate-map.json.ts、
 * ビルド時生成)を同一オリジンからfetchして実URLを解決し、302リダイレクトする。
 * Analytics Engineバインディング(CLICKS)が設定されていれば1クリック1レコードを
 * 書き込むが、未設定でもリダイレクト自体は問題なく動作する(0章§0前提: 環境変数/
 * バインディング未設定でも壊れない)。
 *
 * 未知のproductId・mall・URL未設定の組み合わせは、実際に存在しないリンクとして
 * クローラにも404として伝えつつ、人間には/products/への導線を残す(02章§6)。
 */

interface Env {
  CLICKS?: AnalyticsEngineDataset;
}

type AffiliateMap = Record<string, Record<string, string>>;

// Workerのisolateが複数リクエストで再利用される間はメモリ上にキャッシュする
// (毎リクエストごとに同一オリジンへfetchし直すのは無駄なため)。
let cachedMap: AffiliateMap | null = null;

async function loadAffiliateMap(requestUrl: string): Promise<AffiliateMap> {
  if (cachedMap) return cachedMap;
  const mapUrl = new URL('/api/affiliate-map.json', requestUrl);
  const res = await fetch(mapUrl.toString());
  if (!res.ok) return {};
  cachedMap = (await res.json()) as AffiliateMap;
  return cachedMap;
}

function notFoundResponse(): Response {
  const html =
    '<!doctype html><html lang="ja"><head><meta charset="utf-8">' +
    '<title>リンクが見つかりません | HIBISTACK</title>' +
    '<meta http-equiv="refresh" content="0; url=/products/"></head>' +
    '<body><p>お探しのリンクが見つかりませんでした。' +
    '<a href="/products/">商品一覧へ</a></p></body></html>';
  return new Response(html, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;
  const routeParam = params.route;
  const segments = Array.isArray(routeParam) ? routeParam : routeParam ? [routeParam] : [];
  const [productId, mall] = segments;

  if (!productId || !mall) {
    return notFoundResponse();
  }

  const map = await loadAffiliateMap(request.url);
  const targetUrl = map[productId]?.[mall];

  if (!targetUrl) {
    return notFoundResponse();
  }

  const position = new URL(request.url).searchParams.get('pos') ?? '';

  if (env.CLICKS) {
    try {
      env.CLICKS.writeDataPoint({
        blobs: [productId, mall, position],
        doubles: [1],
        indexes: [productId],
      });
    } catch {
      // Analytics Engine書き込み失敗はリダイレクト自体をブロックしない
    }
  }

  return new Response(null, {
    status: 302,
    headers: { Location: targetUrl },
  });
};
