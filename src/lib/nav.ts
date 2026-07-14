/**
 * ナビゲーション定義
 * 出典: docs/02-information-architecture.md §5 / docs/12-implementation-spec.md §3
 *
 * ナビ項目は `categories` コレクションを order 昇順で取得する。
 * primaryCategoryNav は上位5件(ヘッダーのデスクトップナビ用)、
 * allCategoryNav は全件(フッター・モバイルメニュー用)。
 */
import { getCollection } from 'astro:content';

export type NavItem = {
  labelJa: string;
  labelEn: string;
  href: string;
};

async function getOrderedCategoryNav(): Promise<NavItem[]> {
  const categories = await getCollection('categories');
  return categories
    .sort((a, b) => a.data.order - b.data.order)
    .map((category) => ({
      labelJa: category.data.nameJa,
      labelEn: category.data.nameEn,
      href: `/categories/${category.id}/`,
    }));
}

export async function getPrimaryCategoryNav(): Promise<NavItem[]> {
  const all = await getOrderedCategoryNav();
  return all.slice(0, 5);
}

export async function getAllCategoryNav(): Promise<NavItem[]> {
  return getOrderedCategoryNav();
}
