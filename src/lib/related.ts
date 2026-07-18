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
 * 関連記事スコアリング(26章c8): タグ一致数×3 + カテゴリ一致×2 + 公開90日以内ボーナス1。
 * 同点は新着順。手動related指定なしで残り枠を埋める際、タグ/カテゴリが1つも
 * 一致しない記事でも新着ボーナスにより最下位で候補に残るため、「全く関連しない
 * 記事すら見つからず枠が余る」旧実装の穴も自然に解消される。
 */
const RELATED_TAG_WEIGHT = 3;
const RELATED_CATEGORY_WEIGHT = 2;
const RELATED_RECENCY_BONUS = 1;
const RELATED_RECENCY_WINDOW_DAYS = 90;

function scoreRelatedArticle(
  candidate: CollectionEntry<'articles'>,
  current: CollectionEntry<'articles'>,
  currentTagIds: Set<string>
): number {
  const tagMatches = candidate.data.tags.filter((t) => currentTagIds.has(t.id)).length;
  const categoryMatch = candidate.data.category.id === current.data.category.id ? 1 : 0;
  const ageDays = candidate.data.publishedAt
    ? (Date.now() - candidate.data.publishedAt.getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;
  const isRecent = ageDays <= RELATED_RECENCY_WINDOW_DAYS;

  return (
    tagMatches * RELATED_TAG_WEIGHT +
    categoryMatch * RELATED_CATEGORY_WEIGHT +
    (isRecent ? RELATED_RECENCY_BONUS : 0)
  );
}

/**
 * 記事の関連記事(12章§3・26章c8): ①frontmatter related(常に最優先・既存挙動維持)
 * → ②残り枠をスコア降順(同点は新着順)で補完。
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

  const currentTagIds = new Set(current.data.tags.map((t) => t.id));
  const scored = pool
    .filter((a) => !seen.has(a.id))
    .map((article) => ({ article, score: scoreRelatedArticle(article, current, currentTagIds) }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : byPublishedAtDesc(a.article, b.article)));

  for (const { article } of scored) {
    result.push(article);
    seen.add(article.id);
    if (result.length >= limit) break;
  }

  return result;
}
