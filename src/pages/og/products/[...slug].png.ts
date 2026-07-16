/**
 * 商品ページ用OGP画像エンドポイント — 12章§2(commit8)
 */
import type { APIRoute } from 'astro';
import { getEntry, type CollectionEntry } from 'astro:content';
import { getPublished } from '@/lib/content';
import { renderOgImage } from '@/lib/og-image';

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
  const png = await renderOgImage({
    title: product.data.name,
    categoryLabel: category.data.nameEn,
  });

  return new Response(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png' },
  });
};
