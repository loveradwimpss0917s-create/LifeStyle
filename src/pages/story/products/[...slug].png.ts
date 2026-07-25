/**
 * 商品ページ用ストーリー共有画像エンドポイント(1080×1920)
 * ShareRowのネイティブ共有(Instagramストーリーズ等)専用。/og/とは別画像。
 */
import type { APIRoute } from 'astro';
import { getEntry, type CollectionEntry } from 'astro:content';
import { getPublished } from '@/lib/content';
import { renderStoryImage, resolveProductImagePath } from '@/lib/story-image';

export async function getStaticPaths() {
  const products = await getPublished('products');
  return products.map((product) => ({
    params: { slug: product.id },
    props: { product },
  }));
}

type Props = { product: CollectionEntry<'products'> };

export const GET: APIRoute<Props> = async ({ props }) => {
  const { product } = props;
  const category = await getEntry(product.data.category);
  const png = await renderStoryImage({
    title: product.data.name,
    categoryLabel: category.data.nameEn,
    sourceImagePath: resolveProductImagePath(product.id),
  });

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
