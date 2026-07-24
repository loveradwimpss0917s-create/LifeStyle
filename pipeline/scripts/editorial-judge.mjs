/**
 * Stage3: editorial-judge(記事判断) — 09章§4 Stage3
 * 生成された商品レビューの内容から、単独レビュー記事を書くべきか・既存の
 * roundup記事に追記すべきか・記事化見送りかをAIが提案する。
 *
 * 09章の記述どおり、このステージは「提案」までが責務であり、記事の生成は
 * 行わない(記事生成は提案が承認された場合に人間が別PRで実行する)。
 * open-pr.mjs(Stage6)がこの結果をPR本文に記載する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { z } from 'zod';
import { callClaude } from '../lib/claude.mjs';
import { renderTemplate } from '../lib/template.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.join(__dirname, '../prompts/editorial-judge.md');
const VOICE_PATH = path.join(__dirname, '../../src/content/brand/voice.md');
const ARTICLES_DIR = path.join(__dirname, '../../src/content/articles');

export const editorialJudgeResultSchema = z
  .object({
    judgment: z.enum(['standalone', 'roundup-append', 'skip']),
    reasoning: z.string().min(1),
    roundupArticleId: z.string().nullable(),
  })
  .refine((result) => result.judgment !== 'roundup-append' || result.roundupArticleId !== null, {
    message: 'judgmentがroundup-appendの場合、roundupArticleIdは必須です。',
  });

function parseFrontmatter(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return {};
  return parseYaml(match[1]) ?? {};
}

/** 同カテゴリ・公開済みのroundup記事一覧を返す(追記提案の選択肢) */
export function listRoundupCandidates(categoryId) {
  const files = readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.mdx'));
  return files
    .map((file) => ({ id: file.replace(/\.mdx$/, ''), data: parseFrontmatter(path.join(ARTICLES_DIR, file)) }))
    .filter((a) => a.data.status === 'published' && a.data.type === 'roundup' && a.data.category === categoryId)
    .map((a) => ({ id: a.id, title: a.data.title }));
}

function formatRoundupCandidates(candidates) {
  if (candidates.length === 0) {
    return '(同カテゴリのまとめ記事は現時点でありません。roundup-appendは選択できません)';
  }
  return candidates.map((c) => `- id: ${c.id} / タイトル: ${c.title}`).join('\n');
}

/**
 * @param {{ name: string, category: string, summary: string, goodPoints: string[], concernPoints: string[], body: string }} product
 * @returns {Promise<z.infer<typeof editorialJudgeResultSchema> & { roundupCandidates: Array<{id: string, title: string}> }>}
 */
export async function runEditorialJudge(product) {
  const template = readFileSync(PROMPT_PATH, 'utf-8');
  const voiceMd = readFileSync(VOICE_PATH, 'utf-8');
  const roundupCandidates = listRoundupCandidates(product.category);

  const prompt = renderTemplate(template, {
    voiceMd,
    name: product.name,
    category: product.category,
    summary: product.summary,
    goodPoints: product.goodPoints.join(' / '),
    concernPoints: product.concernPoints.join(' / '),
    body: product.body,
    roundupCandidates: formatRoundupCandidates(roundupCandidates),
  });

  const response = await callClaude({
    stage: 'editorialJudge',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  });

  const textBlock = response.content?.find((block) => block.type === 'text');
  if (!textBlock) {
    throw new Error('[pipeline/scripts/editorial-judge.mjs] Claude APIレスポンスにtextブロックが含まれていません。');
  }

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (err) {
    throw new Error(
      `[pipeline/scripts/editorial-judge.mjs] Claude APIレスポンスがJSONとして解析できませんでした: ${err.message}\n---\n${textBlock.text}`
    );
  }

  const result = editorialJudgeResultSchema.parse(parsed);

  if (result.judgment === 'roundup-append' && !roundupCandidates.some((c) => c.id === result.roundupArticleId)) {
    throw new Error(
      `[pipeline/scripts/editorial-judge.mjs] 候補一覧に存在しないroundupArticleIdが返されました: ${result.roundupArticleId}`
    );
  }

  return { ...result, roundupCandidates };
}

// CLI実行(GitHub Actions等から `node pipeline/scripts/editorial-judge.mjs <issueNumber>` で呼ぶ想定)
// analyze/compose-productの結果を前提とするため、単体のCLI実行には対応していない。
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  console.error(
    'editorial-judge.mjs はStage1/Stage2の出力(商品情報・本文)を前提とするため、' +
      '単体のCLI実行には対応していません。open-pr.mjs(Stage6)から呼び出してください。'
  );
  process.exit(1);
}
