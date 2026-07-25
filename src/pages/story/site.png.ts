/**
 * サイト自体を共有するためのストーリー画像エンドポイント(1080×1920)
 * 記事・商品単位ではなく、トップページのFollowCta横に置くShareRow専用。
 */
import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { renderStoryImage, resolveSiteHeroImagePath } from '@/lib/story-image';

export const GET: APIRoute = async () => {
  const site = await getEntry('site', 'main');
  const png = await renderStoryImage({
    title: site?.data.tagline ?? 'HIBISTACK',
    categoryLabel: site?.data.taglineEn,
    sourceImagePath: resolveSiteHeroImagePath(),
  });

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
