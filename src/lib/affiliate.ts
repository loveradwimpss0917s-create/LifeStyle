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

export type Mall = 'yahooShopping' | 'yahooTravel' | 'amazon' | 'rakuten' | 'ikyu';

/** 主従関係の優先順(23章§2.3): Yahoo!系を常に主とする */
const MALL_PRIORITY: Mall[] = ['yahooShopping', 'yahooTravel', 'ikyu', 'amazon', 'rakuten'];

const MALL_LABEL: Record<Mall, string> = {
  yahooShopping: 'Yahoo!ショッピングで見る',
  yahooTravel: 'Yahoo!トラベルで見る',
  amazon: 'Amazonで見る',
  rakuten: '楽天市場で見る',
  ikyu: '一休.comで見る',
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
  for (const mall of MALL_PRIORITY) {
    const resolved = resolveAffiliateLink(product, mall);
    if (resolved) return { ...resolved, mall };
  }
  return null;
}

/**
 * primaryMall以外で設定済みのモールをテキストリンク行用に返す(26章c13)。
 * Amazon/楽天導入(Phase3)の受け皿。1モールしか設定されていない商品では
 * 常に空配列を返すため、既存の見た目に一切影響しない。
 */
export function resolveSecondaryAffiliateLinks(
  product: CollectionEntry<'products'>,
  primaryMall: Mall,
  position: string
): (ResolvedAffiliateLink & { mall: Mall })[] {
  const result: (ResolvedAffiliateLink & { mall: Mall })[] = [];
  for (const mall of MALL_PRIORITY) {
    if (mall === primaryMall) continue;
    const resolved = resolveAffiliateLink(product, mall);
    if (resolved) {
      result.push({ ...resolved, mall, url: buildGoUrl(product.id, mall, position) });
    }
  }
  return result;
}
