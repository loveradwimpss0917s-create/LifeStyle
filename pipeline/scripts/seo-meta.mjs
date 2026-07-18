/**
 * Stage5: seo-meta+内部リンク提案 — 26章c20(09章§4 Stage5)
 * SEOメタ(title/description)の自動生成(L3・24章の自動化レベル表)と、
 * 既存記事からの関連候補の提案(L2・人間が最終判断)を行う。
 *
 * generateSeoMeta(): 文字数制限(title32字/description120字)を超えた場合、
 * 最大2回まで「制限内に収めるように」という注意書きを追加して再生成する
 * (初回+2回=最大3回試行)。それでも超過する場合は明示的なエラーを投げる
 * (超過したまま黙って公開されることはない)。
 *
 * suggestRelatedArticles(): src/lib/related.tsのスコアリング(26章c8:
 * タグ一致×3+カテゴリ一致×2+公開90日以内ボーナス1)と同じ考え方を、
 * astro:contentに依存しない素のNode版として再実装する(pipeline側は
 * Vite/Astroのビルドパイプライン外で動くため、既存libを直接importできない)。
 * あくまで「提案」であり、PR説明文に記載して人間が採否を判断する(L2)。
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { z } from 'zod';
import { callClaude } from '../lib/claude.mjs';
import { renderTemplate } from '../lib/template.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.join(__dirname, '../prompts/seo-meta.md');
const VOICE_PATH = path.join(__dirname, '../../src/content/brand/voice.md');
const ARTICLES_DIR = path.join(__dirname, '../../src/content/articles');

const MAX_TITLE_LENGTH = 32;
const MAX_DESCRIPTION_LENGTH = 120;
const MAX_REGENERATE_ATTEMPTS = 2;
const RELATED_TAG_WEIGHT = 3;
const RELATED_CATEGORY_WEIGHT = 2;
const RELATED_RECENCY_BONUS = 1;
const RELATED_RECENCY_WINDOW_DAYS = 90;

const seoMetaShapeSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

/**
 * @param {{ name: string, summary: string, category: string, tags: string[] }} product
 * @returns {Promise<{ title: string, description: string }>}
 */
export async function generateSeoMeta(product) {
  const template = readFileSync(PROMPT_PATH, 'utf-8');
  const voiceMd = readFileSync(VOICE_PATH, 'utf-8');

  let lastResult = null;
  for (let attempt = 0; attempt <= MAX_REGENERATE_ATTEMPTS; attempt++) {
    const prompt = renderTemplate(template, {
      voiceMd,
      name: product.name,
      summary: product.summary,
      category: product.category,
      tags: product.tags.join(', '),
      retryNotice:
        attempt > 0
          ? `前回の生成は文字数制限を超えていました(title${MAX_TITLE_LENGTH}字以内・description${MAX_DESCRIPTION_LENGTH}字以内)。今回は必ず制限内に収めてください。`
          : '',
    });

    const response = await callClaude({
      stage: 'seoMeta',
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    });

    const textBlock = response.content?.find((block) => block.type === 'text');
    if (!textBlock) {
      throw new Error('[pipeline/scripts/seo-meta.mjs] Claude APIレスポンスにtextブロックが含まれていません。');
    }

    let parsed;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch (err) {
      throw new Error(
        `[pipeline/scripts/seo-meta.mjs] Claude APIレスポンスがJSONとして解析できませんでした: ${err.message}\n---\n${textBlock.text}`
      );
    }

    lastResult = seoMetaShapeSchema.parse(parsed);

    if (lastResult.title.length <= MAX_TITLE_LENGTH && lastResult.description.length <= MAX_DESCRIPTION_LENGTH) {
      return lastResult;
    }
  }

  throw new Error(
    `[pipeline/scripts/seo-meta.mjs] ${MAX_REGENERATE_ATTEMPTS + 1}回試行しても文字数制限内に収まりませんでした。` +
      `title: ${lastResult.title.length}字/${MAX_TITLE_LENGTH}字, description: ${lastResult.description.length}字/${MAX_DESCRIPTION_LENGTH}字`
  );
}

function parseFrontmatter(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return {};
  return parseYaml(match[1]) ?? {};
}

function loadPublishedArticles() {
  const files = readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.mdx'));
  return files
    .map((file) => {
      const id = file.replace(/\.mdx$/, '');
      const data = parseFrontmatter(path.join(ARTICLES_DIR, file));
      return { id, data };
    })
    .filter((a) => a.data.status === 'published');
}

function scoreArticleForProduct(article, target) {
  const tags = article.data.tags ?? [];
  const tagMatches = tags.filter((t) => target.tagIds.includes(t)).length;
  const categoryMatch = article.data.category === target.categoryId ? 1 : 0;
  const ageDays = article.data.publishedAt
    ? (Date.now() - new Date(article.data.publishedAt).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;
  const isRecent = ageDays <= RELATED_RECENCY_WINDOW_DAYS;

  return (
    tagMatches * RELATED_TAG_WEIGHT + categoryMatch * RELATED_CATEGORY_WEIGHT + (isRecent ? RELATED_RECENCY_BONUS : 0)
  );
}

/**
 * @param {{ categoryId: string, tagIds: string[] }} target
 * @param {number} [limit]
 * @returns {Array<{ id: string, title: string, path: string, score: number }>}
 */
export function suggestRelatedArticles(target, limit = 3) {
  const articles = loadPublishedArticles();
  return articles
    .map((article) => ({ article, score: scoreArticleForProduct(article, target) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ article, score }) => ({
      id: article.id,
      title: article.data.title,
      path: `/articles/${article.id}/`,
      score,
    }));
}

// CLI実行(GitHub Actions等から `node pipeline/scripts/seo-meta.mjs <issueNumber>` で呼ぶ想定)
// analyze/compose-productの結果を前提とするため、実行にはANTHROPIC_API_KEY等が必要。
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  console.error(
    'seo-meta.mjs はStage1/Stage2の出力(商品名・要約・カテゴリ・タグ)を前提とするため、' +
      '単体のCLI実行には対応していません。open-pr.mjs(26章c21)から呼び出してください。'
  );
  process.exit(1);
}
