/**
 * 商品 → 登場記事の逆引きインデックス
 * 出典: docs/12-implementation-spec.md §3
 *
 * 全記事の生MDXテキスト(entry.body)を <ProductEmbed id="..."/> パターンで走査し、
 * Map<productId, articleId[]> を1回だけ構築してキャッシュする。
 * 存在しない商品IDを参照している記事があれば、ビルドを失敗させる(リンク切れ防止)。
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { getPublished } from './content';

const PRODUCT_EMBED_PATTERN = /<ProductEmbed\s+id="([^"]+)"/g;

let cache: Map<string, string[]> | null = null;

async function buildIndex(): Promise<Map<string, string[]>> {
  const [articles, products] = await Promise.all([
    getCollection('articles'),
    getCollection('products'),
  ]);
  const productIds = new Set(products.map((p) => p.id));
  const index = new Map<string, string[]>();

  for (const article of articles) {
    const body = article.body ?? '';
    for (const match of body.matchAll(PRODUCT_EMBED_PATTERN)) {
      const productId = match[1];
      if (!productIds.has(productId)) {
        throw new Error(
          `[product-index] 記事 "${article.id}" が存在しない商品ID "${productId}" を ProductEmbed で参照しています`
        );
      }
      const list = index.get(productId) ?? [];
      if (!list.includes(article.id)) list.push(article.id);
      index.set(productId, list);
    }
  }

  return index;
}

async function getIndex(): Promise<Map<string, string[]>> {
  if (!cache) cache = await buildIndex();
  return cache;
}

/** 公開中の記事に限定した、商品に登場する記事一覧(表示用) */
export async function getArticlesForProduct(
  productId: string
): Promise<CollectionEntry<'articles'>[]> {
  const index = await getIndex();
  const articleIds = index.get(productId) ?? [];
  if (articleIds.length === 0) return [];

  const publishedArticles = await getPublished('articles');
  const byId = new Map(publishedArticles.map((a) => [a.id, a]));
  return articleIds
    .map((id) => byId.get(id))
    .filter((a): a is CollectionEntry<'articles'> => a !== undefined);
}
