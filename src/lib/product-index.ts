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

/**
 * 記事本文に埋め込まれた商品IDを出現順・重複除去で抽出する(04章§4.4「登場した商品まとめ」用)。
 * 存在しない商品IDが含まれる場合はビルドエラーにする(product-indexと同じ整合性保証)。
 */
export async function getEmbeddedProductIds(
  article: Pick<CollectionEntry<'articles'>, 'id' | 'body'>
): Promise<string[]> {
  const products = await getCollection('products');
  const productIds = new Set(products.map((p) => p.id));
  const body = article.body ?? '';
  const ids: string[] = [];

  for (const match of body.matchAll(PRODUCT_EMBED_PATTERN)) {
    const productId = match[1];
    if (!productIds.has(productId)) {
      throw new Error(
        `[product-index] 記事 "${article.id}" が存在しない商品ID "${productId}" を ProductEmbed で参照しています`
      );
    }
    if (!ids.includes(productId)) ids.push(productId);
  }

  return ids;
}
