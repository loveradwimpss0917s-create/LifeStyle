/**
 * 静的商品インデックスAPI — 26章c7
 * published商品の{id,name,image,alt,rating,category}をビルド時にJSON出力する。
 * /favorites/ ページがクライアント側でこれをfetchし、localStorageのIDと突き合わせる。
 */
import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { getImage } from 'astro:assets';
import { getPublished } from '@/lib/content';

export const GET: APIRoute = async () => {
  const products = await getPublished('products');

  const items = await Promise.all(
    products.map(async (product) => {
      const category = await getEntry(product.data.category);
      const optimized = await getImage({ src: product.data.images[0].src, width: 400 });
      return {
        id: product.id,
        name: product.data.name,
        image: optimized.src,
        alt: product.data.images[0].alt,
        rating: product.data.rating,
        category: category?.data.nameJa ?? '',
      };
    })
  );

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json' },
  });
};
