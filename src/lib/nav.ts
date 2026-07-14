/**
 * ナビゲーション定義(暫定)
 * 出典: docs/02-information-architecture.md §5
 *
 * TODO(commit2/content-schema後に置き換え):
 * 本来は `getCollection('categories')` を order昇順・上位5件で取得する(12章§3)。
 * commit1時点ではcategoriesコレクションが未実装のため、02章§3のマスタ表の並び順を
 * そのまま上位5件として暫定採用する。commit2でcategories実データが揃い次第、
 * Header.astro / Footer.astro のこの定数参照を動的クエリに差し替える。
 */
export type NavItem = {
  labelJa: string;
  labelEn: string;
  href: string;
};

export const primaryCategoryNav: NavItem[] = [
  { labelJa: '旅行', labelEn: 'Travel', href: '/categories/travel/' },
  { labelJa: '子育て', labelEn: 'Family', href: '/categories/parenting/' },
  { labelJa: '暮らし', labelEn: 'Living', href: '/categories/living/' },
  { labelJa: '日用品', labelEn: 'Essentials', href: '/categories/daily-goods/' },
  { labelJa: '家電', labelEn: 'Appliances', href: '/categories/appliances/' },
];

export const allCategoryNav: NavItem[] = [
  ...primaryCategoryNav,
  { labelJa: 'コーヒー', labelEn: 'Coffee', href: '/categories/coffee/' },
  { labelJa: '写真', labelEn: 'Photography', href: '/categories/photography/' },
];
