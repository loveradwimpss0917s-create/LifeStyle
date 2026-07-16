/**
 * ランキング算出ユーティリティ
 * 出典: docs/12-implementation-spec.md §3
 * published商品を rating*10 + rankingWeight 降順、同点は publishedAt 新しい順。
 */
import type { CollectionEntry } from 'astro:content';
import { getPublished } from './content';

function rankingScore(product: CollectionEntry<'products'>): number {
  return product.data.rating * 10 + product.data.rankingWeight;
}

function compareProducts(a: CollectionEntry<'products'>, b: CollectionEntry<'products'>): number {
  const scoreDiff = rankingScore(b) - rankingScore(a);
  if (scoreDiff !== 0) return scoreDiff;
  return (b.data.publishedAt?.getTime() ?? 0) - (a.data.publishedAt?.getTime() ?? 0);
}

export async function getOverallRanking(limit = 10): Promise<CollectionEntry<'products'>[]> {
  const products = await getPublished('products');
  return [...products].sort(compareProducts).slice(0, limit);
}

export async function getCategoryRanking(
  categoryId: string,
  limit = 3
): Promise<CollectionEntry<'products'>[]> {
  const products = await getPublished('products');
  return products
    .filter((p) => p.data.category.id === categoryId)
    .sort(compareProducts)
    .slice(0, limit);
}
