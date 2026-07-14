/**
 * Content Collections スキーマ定義
 * 出典: docs/07-data-model.md §4(products/articles/categories/brands/tags)・§5(site)
 * このファイルがデータの「正」。フィールドの追加・変更は必ずここから行う。
 *
 * 注: 08章の想定パスは `src/content/config.ts` だが、Astro 7 の Content Layer API では
 * `src/content.config.ts`(contentディレクトリの外)が必須のため、フレームワーク仕様に合わせている。
 */
import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const products = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
  schema: ({ image }) =>
    z
      .object({
        name: z.string().min(1).max(80),
        category: reference('categories'),
        brand: reference('brands').optional(),
        price: z.number().int().positive().optional(),
        purchasedAt: z.coerce.date(),
        usagePeriod: z.enum(['under1m', '1-3m', '3-6m', '6-12m', 'over1y', 'over3y']),
        rating: z.number().int().min(1).max(5),
        rankingWeight: z.number().int().default(0),
        summary: z.string().max(60),
        goodPoints: z.array(z.string().max(40)).min(1).max(5),
        concernPoints: z.array(z.string().max(40)).min(1).max(3),
        scenes: z
          .array(
            z.object({
              image: image(),
              alt: z.string(),
              caption: z.string().max(80),
            })
          )
          .max(3)
          .default([]),
        images: z.array(z.object({ src: image(), alt: z.string() })).min(1).max(6),
        tags: z.array(reference('tags')).max(8).default([]),
        affiliate: z
          .object({
            yahooShopping: z.object({ url: z.url(), checkedAt: z.coerce.date() }).optional(),
            yahooTravel: z.object({ url: z.url(), checkedAt: z.coerce.date() }).optional(),
            amazon: z.object({ url: z.url(), checkedAt: z.coerce.date() }).optional(),
            rakuten: z.object({ url: z.url(), checkedAt: z.coerce.date() }).optional(),
          })
          .default({}),
        status: z.enum(['draft', 'review', 'published', 'archived']).default('draft'),
        publishedAt: z.coerce.date().optional(),
        updatedAt: z.coerce.date().optional(),
      })
      .refine((data) => data.status !== 'published' || !!data.publishedAt, {
        message: 'published には publishedAt が必須です',
        path: ['publishedAt'],
      }),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/articles' }),
  schema: ({ image }) =>
    z
      .object({
        type: z.enum(['review', 'roundup', 'comparison', 'ranking', 'log']),
        title: z.string().min(1).max(60),
        lead: z.string().max(120),
        category: reference('categories'),
        heroImage: image(),
        heroAlt: z.string(),
        tags: z.array(reference('tags')).max(8).default([]),
        related: z.array(reference('articles')).max(3).default([]),
        seo: z
          .object({
            description: z.string().max(120).optional(),
            noindex: z.boolean().default(false),
          })
          .default({ noindex: false }),
        status: z.enum(['draft', 'review', 'published', 'archived']).default('draft'),
        publishedAt: z.coerce.date().optional(),
        updatedAt: z.coerce.date().optional(),
      })
      .refine((data) => data.status !== 'published' || !!data.publishedAt, {
        message: 'published には publishedAt が必須です',
        path: ['publishedAt'],
      }),
});

const categories = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/categories' }),
  schema: ({ image }) =>
    z.object({
      nameJa: z.string(),
      nameEn: z.string(),
      lead: z.string().max(100),
      image: image(),
      order: z.number().int(),
    }),
});

const brands = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/brands' }),
  schema: z.object({
    name: z.string(),
    nameKana: z.string().optional(),
    url: z.url().optional(),
  }),
});

const tags = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/tags' }),
  schema: z.object({
    name: z.string(),
  }),
});

/**
 * サイト設定(07章§5)。単一ファイル `content/site.json` を file() ローダーで読み込む。
 * file() ローダーは「idをキーとするオブジェクト」形式を要求するため、
 * site.json はトップレベルを `{ "main": { ...実データ } }` の形にしている。
 * 参照側は `getEntry('site', 'main')` で取得する。
 */
const site = defineCollection({
  loader: file('./src/content/site.json'),
  schema: ({ image }) =>
    z.object({
      siteName: z.string(),
      tagline: z.string(),
      taglineEn: z.string(),
      description: z.string(),
      url: z.url(),
      heroImage: image(),
      heroAlt: z.string(),
      author: z.object({
        name: z.string(),
        bio: z.string(),
        image: image(),
      }),
      sns: z.object({
        instagramPhoto: z.url().optional(),
        instagramHome: z.url().optional(),
        youtube: z.url().optional(),
        tiktok: z.url().optional(),
        threads: z.url().optional(),
      }),
      newsletterUrl: z.url().optional(),
      contactEmail: z.email().optional(),
      editorsPicks: z.array(reference('products')).default([]),
      pinned: z.record(z.string(), reference('articles')).default({}),
    }),
});

export const collections = { products, articles, categories, brands, tags, site };
