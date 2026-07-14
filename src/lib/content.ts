/**
 * コンテンツ取得ユーティリティ
 * 出典: docs/07-data-model.md §4 / docs/12-implementation-spec.md §3
 *
 * status !== 'published' のコンテンツはビルド出力から除外する。
 * ただし PUBLIC_PREVIEW=true のプレビュー環境では draft/review も出力する
 * (Cloudflare Pages のプレビューデプロイでレビューできるようにするため)。
 */
import { getCollection, type CollectionEntry } from 'astro:content';

type PublishableCollection = 'products' | 'articles';

const isPreview = import.meta.env.PUBLIC_PREVIEW === 'true';

export async function getPublished<C extends PublishableCollection>(
  collection: C
): Promise<CollectionEntry<C>[]> {
  return getCollection(collection, (entry) => {
    if (isPreview) return true;
    return entry.data.status === 'published';
  });
}
