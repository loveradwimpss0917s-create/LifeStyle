/**
 * アフィリエイトリンク対応表API — 26章c11/c12
 * published商品の{id: {mall: 実URL}}をビルド時にJSON出力する。
 * functions/go/[[route]].ts がこれをfetchし、/go/{productId}/{mall} を
 * 実URLへ302リダイレクトする際の参照元として使う。
 *
 * 実装順序の補足: 26章の元計画ではこのファイルはc12(アフィリエイトリンクの
 * /go/経由化)の変更ファイルとして割り当てられていたが、c11(/go/リダイレクト
 * 本体)がこのJSONを参照する前提のためc11時点で先に実装する(c11だけでは
 * 参照先が無くリダイレクト自体を検証できないため)。c12ではAffiliateButton/
 * StickyCtaのhrefを実際に/go/形式へ切り替える。
 */
import type { APIRoute } from 'astro';
import { getPublished } from '@/lib/content';
import type { Mall } from '@/lib/affiliate';

export const GET: APIRoute = async () => {
  const products = await getPublished('products');
  const map: Record<string, Partial<Record<Mall, string>>> = {};

  for (const product of products) {
    const entries: Partial<Record<Mall, string>> = {};
    for (const [mall, entry] of Object.entries(product.data.affiliate)) {
      if (entry?.url) {
        entries[mall as Mall] = entry.url;
      }
    }
    if (Object.keys(entries).length > 0) {
      map[product.id] = entries;
    }
  }

  return new Response(JSON.stringify(map), {
    headers: { 'Content-Type': 'application/json' },
  });
};
