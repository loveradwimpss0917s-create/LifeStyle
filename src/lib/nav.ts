/**
 * ナビゲーション定義
 * 出典: docs/02-information-architecture.md §5 / docs/12-implementation-spec.md §3
 * docs/28-site-audit-2026-07.md 課題1: primaryCategoryNav は空カテゴリ(公開記事・
 * 公開商品がともに0件)をヘッダーナビの候補から除外してから上位5件を返す。
 *
 * ナビ項目は `categories` コレクションを order 昇順で取得する。
 * primaryCategoryNav は上位5件(ヘッダーのデスクトップナビ用)、
 * allCategoryNav は全件(フッター・モバイルメニュー用、空カテゴリも含む)。
 */
import { getCollection } from 'astro:content';
import { getPublished } from '@/lib/content';

export type NavItem = {
  labelJa: string;
  labelEn: string;
  href: string;
};

async function getOrderedCategories() {
  const categories = await getCollection('categories');
  return categories.sort((a, b) => a.data.order - b.data.order);
}

function toNavItem(category: Awaited<ReturnType<typeof getOrderedCategories>>[number]): NavItem {
  return {
    labelJa: category.data.nameJa,
    labelEn: category.data.nameEn,
    href: `/categories/${category.id}/`,
  };
}

async function getOrderedCategoryNav(): Promise<NavItem[]> {
  const categories = await getOrderedCategories();
  return categories.map(toNavItem);
}

export async function getPrimaryCategoryNav(): Promise<NavItem[]> {
  const [categories, articles, products] = await Promise.all([
    getOrderedCategories(),
    getPublished('articles'),
    getPublished('products'),
  ]);

  const categoriesWithContent = new Set<string>();
  for (const article of articles) categoriesWithContent.add(article.data.category.id);
  for (const product of products) categoriesWithContent.add(product.data.category.id);

  return categories
    .filter((category) => categoriesWithContent.has(category.id))
    .slice(0, 5)
    .map(toNavItem);
}

export async function getAllCategoryNav(): Promise<NavItem[]> {
  return getOrderedCategoryNav();
}
