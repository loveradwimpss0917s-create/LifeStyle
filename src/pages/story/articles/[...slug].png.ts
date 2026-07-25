/**
 * 記事ページ用ストーリー共有画像エンドポイント(1080×1920)
 * ShareRowのネイティブ共有(Instagramストーリーズ等)専用。/og/とは別画像。
 */
import type { APIRoute } from 'astro';
import { getEntry, type CollectionEntry } from 'astro:content';
import { getPublished } from '@/lib/content';
import { renderStoryImage, resolveArticleHeroImagePath } from '@/lib/story-image';

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
  const png = await renderStoryImage({
    title: article.data.title,
    categoryLabel: category.data.nameEn,
    sourceImagePath: resolveArticleHeroImagePath(article.id),
  });

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
