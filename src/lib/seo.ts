/**
 * SEO用 JSON-LD 生成ユーティリティ
 * 出典: docs/10-seo-affiliate.md §1.3 / docs/12-implementation-spec.md §2(commit8)
 */
import { getImage } from 'astro:assets';
import type { CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';

const SITE_NAME = 'HIBISTACK';

/**
 * 著者Personの正規@id(26章c27・E-E-A-T)。/about/ページで実体(buildPersonJsonLd)を
 * 定義し、記事のauthorはこの@idで参照する(同一実体であることを検索エンジンに
 * 一貫して伝えるため、ページをまたいでも同じURLフラグメントを使う)。
 */
function personId(site: URL) {
  return `${new URL('/about/', site).toString()}#person`;
}

/**
 * WebSite+Organization JSON-LD(26章c3)。トップページのみで出力する。
 * SearchActionはPagefindのUIをそのまま利用できるURL構造(/search/?q=...)に合わせる。
 * Organization.logoは14章のブランドシンボルをラスタ化したicon-512.png(正方形)を使う。
 */
export function buildSiteJsonLd(site: URL, description: string) {
  const siteUrl = site.toString();
  const searchUrlTemplate = `${new URL('/search/', site).toString()}?q={search_term_string}`;

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: siteUrl,
      description,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: searchUrlTemplate,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: siteUrl,
      logo: new URL('/icons/icon-512.png', site).toString(),
    },
  ];
}

/**
 * Person構造化データ(26章c27・E-E-A-T)。/about/ページのみで出力する。
 * sameAsはsite.jsonのSNS実URLのうち設定済みのものだけを含める(プレースホルダー
 * URLのままでも壊れないが、公開前にオーナーが実URLへ差し替える運用は変わらない)。
 */
export async function buildPersonJsonLd(
  site: URL,
  author: { name: string; bio: string; image: ImageMetadata },
  sns: { instagramPhoto?: string; instagramHome?: string; youtube?: string; tiktok?: string; threads?: string }
) {
  const optimized = await getImage({ src: author.image, width: 400 });
  const imageUrl = new URL(optimized.src, site).toString();
  const sameAs = Array.from(new Set(Object.values(sns).filter((url): url is string => Boolean(url))));

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': personId(site),
    name: author.name,
    description: author.bio,
    image: imageUrl,
    url: new URL('/about/', site).toString(),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

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
    author: { '@id': personId(site) },
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
