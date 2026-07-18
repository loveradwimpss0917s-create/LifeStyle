/**
 * Stage2: compose-product(商品レビュー下書き生成) — 26章c19(09章§4 Stage2)
 * Stage1(analyze)の解析結果+メモ+voice.md+既存同カテゴリレビュー2本
 * (few-shot)から、商品frontmatterの一部(name/summary/goodPoints/
 * concernPoints/tags)と本文Markdownを生成する。
 *
 * category/brand/price/usagePeriod/images等はStage1解析結果・人間の
 * 確認で埋まる項目のためこのステージでは扱わない(analyzeResultと
 * マージしてsrc/content/products/{slug}.mdを組み立てるのはc21
 * open-pr.mjsの責務)。
 *
 * concernPointsがメモから正当に導けない場合、AIは絶対に取り繕った内容を
 * 創作せず needsConfirmation: true を返す契約(09章§4 Stage2の完了条件)。
 * この場合 buildProductMarkdown() は呼び出せない(呼ぶとエラーになる)。
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { z } from 'zod';
import { callClaude } from '../lib/claude.mjs';
import { renderTemplate } from '../lib/template.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.join(__dirname, '../prompts/compose-product.md');
const VOICE_PATH = path.join(__dirname, '../../src/content/brand/voice.md');
const PRODUCTS_DIR = path.join(__dirname, '../../src/content/products');

const draftContentSchema = z.object({
  needsConfirmation: z.literal(false),
  confirmationReason: z.null(),
  frontmatter: z.object({
    name: z.string().min(1).max(80),
    summary: z.string().min(1).max(60),
    goodPoints: z.array(z.string().min(1).max(40)).min(1).max(5),
    concernPoints: z.array(z.string().min(1).max(40)).min(1).max(3),
    tags: z.array(z.string().min(1)).max(8),
  }),
  body: z.string().min(1),
});

const needsConfirmationSchema = z.object({
  needsConfirmation: z.literal(true),
  confirmationReason: z.string().min(1),
  frontmatter: z.null(),
  body: z.null(),
});

export const composeProductResultSchema = z.union([draftContentSchema, needsConfirmationSchema]);

function parseFrontmatter(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  return { raw, data: parseYaml(match[1]) ?? {} };
}

/** 同カテゴリのpublished商品を最大2件、few-shot用に全文取得する(不足時はあるだけ返す) */
export function collectFewShotExamples(categoryId, limit = 2) {
  const files = readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith('.md'));
  const examples = [];
  for (const file of files) {
    const parsed = parseFrontmatter(path.join(PRODUCTS_DIR, file));
    if (!parsed) continue;
    if (parsed.data.status === 'published' && parsed.data.category === categoryId) {
      examples.push(parsed.raw);
    }
    if (examples.length >= limit) break;
  }
  return examples;
}

function formatFewShotBlock(examples) {
  if (examples.length === 0) {
    return '(同カテゴリの既存レビューがまだありません。voice.mdの文体規則のみを頼りに執筆してください)';
  }
  return examples.map((raw, i) => `#### 参考商品${i + 1}\n\n\`\`\`md\n${raw}\`\`\``).join('\n\n');
}

/**
 * @param {object} analyzeResult - runAnalyze()の出力
 * @param {{ memo: string, imageUrls: string[], date: string | null }} intake
 * @returns {Promise<z.infer<typeof composeProductResultSchema>>}
 */
export async function runComposeProduct(analyzeResult, intake) {
  const template = readFileSync(PROMPT_PATH, 'utf-8');
  const voiceMd = readFileSync(VOICE_PATH, 'utf-8');
  const fewShotExamples = collectFewShotExamples(analyzeResult.category.value);

  const prompt = renderTemplate(template, {
    voiceMd,
    analyzeResultJson: JSON.stringify(analyzeResult, null, 2),
    memo: intake.memo,
    date: intake.date ?? '不明',
    fewShotExamples: formatFewShotBlock(fewShotExamples),
  });

  const response = await callClaude({
    stage: 'composeProduct',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  });

  const textBlock = response.content?.find((block) => block.type === 'text');
  if (!textBlock) {
    throw new Error('[pipeline/scripts/compose-product.mjs] Claude APIレスポンスにtextブロックが含まれていません。');
  }

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (err) {
    throw new Error(
      `[pipeline/scripts/compose-product.mjs] Claude APIレスポンスがJSONとして解析できませんでした: ${err.message}\n---\n${textBlock.text}`
    );
  }

  const result = composeProductResultSchema.parse(parsed);

  if (!result.needsConfirmation) {
    const violations = checkBannedWords(`${result.frontmatter.summary}\n${result.body}`, voiceMd);
    if (violations.length > 0) {
      throw new Error(
        `[pipeline/scripts/compose-product.mjs] 生成文に禁止語/回避語が含まれています: ${violations.join(', ')}`
      );
    }
  }

  return result;
}

/**
 * voice.mdのbannedWords/avoidWordsと生成テキストを照合する(26章c19完了条件:
 * 「禁止語リストとの照合が走る」)。1件でも一致すればそのまま公開せず
 * エラーとして扱う(自動修正はしない。プロンプト側の指示が効かなかった
 * ことの検知が目的)。
 */
export function checkBannedWords(text, voiceMdRaw) {
  const match = voiceMdRaw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return [];
  const frontmatter = parseYaml(match[1]) ?? {};
  const words = [
    ...Object.values(frontmatter.bannedWords ?? {}).flat(),
    ...Object.values(frontmatter.avoidWords ?? {}).flat(),
  ];
  return words.filter((word) => text.includes(word));
}

/** needsConfirmationがfalseの結果からproducts/{slug}.md本文相当のfrontmatter抜粋+bodyを組み立てる(open-pr.mjsが最終的なファイルに合成する) */
export function buildProductMarkdown(result) {
  if (result.needsConfirmation) {
    throw new Error(
      '[pipeline/scripts/compose-product.mjs] needsConfirmation:true の結果からMarkdownは組み立てられません。' +
        `理由: ${result.confirmationReason}`
    );
  }
  const fm = result.frontmatter;
  const frontmatterLines = [
    `name: ${JSON.stringify(fm.name)}`,
    'goodPoints:',
    ...fm.goodPoints.map((p) => `  - ${JSON.stringify(p)}`),
    'concernPoints:',
    ...fm.concernPoints.map((p) => `  - ${JSON.stringify(p)}`),
    'tags:',
    ...fm.tags.map((t) => `  - ${t}`),
    `summary: ${JSON.stringify(fm.summary)}`,
  ];
  return `---\n${frontmatterLines.join('\n')}\n---\n\n${result.body}\n`;
}

// CLI実行(GitHub Actions等から `node pipeline/scripts/compose-product.mjs <issueNumber>` で呼ぶ想定)
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const issueNumber = process.argv[2];
  if (!issueNumber) {
    console.error('Usage: node pipeline/scripts/compose-product.mjs <issueNumber>');
    process.exit(1);
  }
  const { getIssue } = await import('../lib/github.mjs');
  const { parseIntake } = await import('../lib/parse-intake.mjs');
  const { runAnalyze } = await import('./analyze.mjs');

  const issue = await getIssue(issueNumber);
  const intake = parseIntake(issue.body);
  const analyzeResult = await runAnalyze(intake);
  const result = await runComposeProduct(analyzeResult, intake);
  console.log(JSON.stringify(result, null, 2));
}
