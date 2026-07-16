/**
 * 関連コンテンツ解決ユーティリティ
 * 出典: docs/06-component-design.md §6.4(RelatedArticles/RelatedProducts)/ docs/12-implementation-spec.md §3
 */
import type { CollectionEntry } from 'astro:content';
import { getPublished } from './content';

function byPublishedAtDesc(a: CollectionEntry<'products' | 'articles'>, b: CollectionEntry<'products' | 'articles'>) {
  return (b.data.publishedAt?.getTime() ?? 0) - (a.data.publishedAt?.getTime() ?? 0);
}

/**
 * 商品の関連商品(04章§4.3「同じカテゴリの商品」)。
 * productsコレクションに手動related fieldは無いため、同カテゴリの新着順のみで構成する。
 */
export async function getRelatedProducts(
  current: CollectionEntry<'products'>,
  limit = 4
): Promise<CollectionEntry<'products'>[]> {
  const products = await getPublished('products');
  return products
    .filter((p) => p.id !== current.id && p.data.category.id === current.data.category.id)
    .sort(byPublishedAtDesc)
    .slice(0, limit);
}

/**
 * 記事の関連記事(12章§3): ①frontmatter related → ②同カテゴリ新着 → ③同タグ新着 の順で不足分補完。
 */
export async function getRelatedArticles(
  current: CollectionEntry<'articles'>,
  limit = 3
): Promise<CollectionEntry<'articles'>[]> {
  const articles = await getPublished('articles');
  const pool = articles.filter((a) => a.id !== current.id);
  const result: CollectionEntry<'articles'>[] = [];
  const seen = new Set<string>();

  for (const ref of current.data.related) {
    const match = pool.find((a) => a.id === ref.id);
    if (match && !seen.has(match.id)) {
      result.push(match);
      seen.add(match.id);
    }
    if (result.length >= limit) return result;
  }

  const sameCategory = pool
    .filter((a) => a.data.category.id === current.data.category.id && !seen.has(a.id))
    .sort(byPublishedAtDesc);
  for (const article of sameCategory) {
    result.push(article);
    seen.add(article.id);
    if (result.length >= limit) return result;
  }

  const currentTagIds = new Set(current.data.tags.map((t) => t.id));
  const sameTag = pool
    .filter((a) => !seen.has(a.id) && a.data.tags.some((t) => currentTagIds.has(t.id)))
    .sort(byPublishedAtDesc);
  for (const article of sameTag) {
    result.push(article);
    seen.add(article.id);
    if (result.length >= limit) return result;
  }

  return result;
}
