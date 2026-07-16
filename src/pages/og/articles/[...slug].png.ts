/**
 * 記事ページ用OGP画像エンドポイント — 12章§2(commit8)
 */
import type { APIRoute } from 'astro';
import { getEntry, type CollectionEntry } from 'astro:content';
import { getPublished } from '@/lib/content';
import { renderOgImage } from '@/lib/og-image';

export async function getStaticPaths() {
  const articles = await getPublished('articles');
  return articles.map((article) => ({
    params: { slug: article.id },
    props: { article },
  }));
}

type Props = { article: CollectionEntry<'articles'> };

export const GET: APIRoute<Props> = async ({ props }) => {
  const { article } = props;
  const category = await getEntry(article.data.category);
  const png = await renderOgImage({
    title: article.data.title,
    categoryLabel: category.data.nameEn,
  });

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
