/**
 * RSS(記事) — 08章§3
 */
import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { getPublished } from '@/lib/content';

export const GET: APIRoute = async (context) => {
  const articles = (await getPublished('articles')).sort(
    (a, b) => (b.data.publishedAt?.getTime() ?? 0) - (a.data.publishedAt?.getTime() ?? 0)
  );
  const site = await getEntry('site', 'main');

  return rss({
    title: site?.data.siteName ?? 'LIFESTACK',
    description: site?.data.description ?? '日常を、美しく残す。',
    site: context.site!,
    items: articles.map((article) => ({
      title: article.data.title,
      description: article.data.lead,
      pubDate: article.data.publishedAt,
      link: `/articles/${article.id}/`,
    })),
    customData: `<language>ja</language>`,
  });
};
