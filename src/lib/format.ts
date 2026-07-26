/**
 * 表示フォーマット変換ユーティリティ
 * 出典: docs/07-data-model.md §4(usagePeriod表示変換)/ docs/08-tech-architecture.md §3
 */
import type { CollectionEntry } from 'astro:content';

type UsagePeriod = CollectionEntry<'products'>['data']['usagePeriod'];

const USAGE_PERIOD_LABEL: Record<UsagePeriod, string> = {
  under1m: '使用1ヶ月未満',
  '1-3m': '使用1〜3ヶ月',
  '3-6m': '使用3〜6ヶ月',
  '6-12m': '使用6ヶ月〜1年',
  over1y: '使用1年以上',
  over3y: '使用3年以上',
};

export function formatUsagePeriod(period: UsagePeriod): string {
  return USAGE_PERIOD_LABEL[period];
}

export function formatPrice(price?: number): string | undefined {
  if (price === undefined) return undefined;
  return `¥${price.toLocaleString('ja-JP')}`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatYearMonth(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
  }).format(date);
}

/** 購入時期は正確な日付ではなく「上旬・中旬・下旬」表記にする(20章方針)。 */
export function formatPurchasePeriod(date: Date): string {
  const day = date.getDate();
  const part = day <= 10 ? '上旬' : day <= 20 ? '中旬' : '下旬';
  return `${formatYearMonth(date)}${part}`;
}
