/**
 * SEO用 JSON-LD 生成ユーティリティ
 * 出典: docs/10-seo-affiliate.md §1.3 / docs/12-implementation-spec.md §2(commit8)
 */
import { getImage } from 'astro:assets';
import type { CollectionEntry } from 'astro:content';

const SITE_NAME = 'HIBISTACK';

export type BreadcrumbInput = { label: string; href?: string };

export function buildBreadcrumbJsonLd(items: BreadcrumbInput[], site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: new URL(item.href, site).toString() } : {}),
    })),
  };
}

export async function buildProductJsonLd(
  product: CollectionEntry<'products'>,
  brand: CollectionEntry<'brands'> | undefined,
  site: URL
) {
  const optimized = await getImage({ src: product.data.images[0].src, width: 800 });
  const imageUrl = new URL(optimized.src, site).toString();

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.data.name,
    image: [imageUrl],
    description: product.data.summary,
    ...(brand ? { brand: { '@type': 'Brand', name: brand.data.name } } : {}),
    review: {
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: product.data.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: { '@type': 'Person', name: SITE_NAME },
      ...(product.data.publishedAt
        ? { datePublished: product.data.publishedAt.toISOString().slice(0, 10) }
        : {}),
      reviewBody: product.data.summary,
    },
  };
}

export async function buildArticleJsonLd(article: CollectionEntry<'articles'>, site: URL) {
  const optimized = await getImage({ src: article.data.heroImage, width: 1200 });
  const imageUrl = new URL(optimized.src, site).toString();

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.data.title,
    image: [imageUrl],
    description: article.data.seo.description ?? article.data.lead,
    ...(article.data.publishedAt
      ? { datePublished: article.data.publishedAt.toISOString().slice(0, 10) }
      : {}),
    ...(article.data.updatedAt
      ? { dateModified: article.data.updatedAt.toISOString().slice(0, 10) }
      : {}),
    author: { '@type': 'Person', name: SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME },
  };
}

export type ItemListInput = { url: string; name?: string };

export function buildItemListJsonLd(items: ItemListInput[], site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: new URL(item.url, site).toString(),
      ...(item.name ? { name: item.name } : {}),
    })),
  };
}
