/**
 * アフィリエイトリンク解決ユーティリティ
 * 出典: docs/06-component-design.md §6.2(AffiliateButton)/ docs/12-implementation-spec.md §3
 *
 * URLが未設定のモールは null を返す(呼び出し側で非描画にする)。
 * URLにはクエリを付与しない(Yahoo規約リスク回避。内部計測はV3の /go/ で実施)。
 *
 * 26章c12: 実際にCTAボタンのhrefに使うのは resolveAffiliateLink().url
 * (実URL、存在チェック・ラベル取得用)ではなく buildGoUrl() が返す
 * /go/{productId}/{mall} 形式のURL。実URLはfunctions/go/[[route]].tsが
 * src/pages/api/affiliate-map.json.ts経由で解決する(26章c11)。
 */
import type { CollectionEntry } from 'astro:content';

export type Mall = 'yahooShopping' | 'yahooTravel' | 'amazon' | 'rakuten';

const MALL_LABEL: Record<Mall, string> = {
  yahooShopping: 'Yahoo!ショッピングで見る',
  yahooTravel: 'Yahoo!トラベルで見る',
  amazon: 'Amazonで見る',
  rakuten: '楽天市場で見る',
};

export type ResolvedAffiliateLink = { url: string; label: string };

/** /go/リダイレクト経由のURLを構築する(26章c12: 全クリックを計測面に乗せる) */
export function buildGoUrl(productId: string, mall: Mall, position: string): string {
  const params = new URLSearchParams({ pos: position });
  return `/go/${productId}/${mall}?${params.toString()}`;
}

export function resolveAffiliateLink(
  product: CollectionEntry<'products'>,
  mall: Mall
): ResolvedAffiliateLink | null {
  const entry = product.data.affiliate[mall];
  if (!entry) return null;
  return { url: entry.url, label: MALL_LABEL[mall] };
}

/** 商品ページ・ProductEmbedで最初に表示するモール(Yahoo!系優先)を1件返す */
export function resolvePrimaryAffiliateLink(
  product: CollectionEntry<'products'>
): (ResolvedAffiliateLink & { mall: Mall }) | null {
  const priority: Mall[] = ['yahooShopping', 'yahooTravel', 'amazon', 'rakuten'];
  for (const mall of priority) {
    const resolved = resolveAffiliateLink(product, mall);
    if (resolved) return { ...resolved, mall };
  }
  return null;
}
