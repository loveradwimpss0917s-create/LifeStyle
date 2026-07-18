/**
 * Stage1: analyze(解析) — 26章c18(09章§4 Stage1)
 * Intakeの写真+メモをvision入力でClaude APIに渡し、商品データ候補JSON
 * { name, category, brand, priceRange, tags, images, overallConfidence } を得る。
 * 確信度が低い項目は自己点検の結果、値の先頭に "TODO: " が付く想定
 * (プロンプト側で指示。Zodスキーマでは文字列としてのみ検証する)。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { callClaude } from '../lib/claude.mjs';
import { renderTemplate } from '../lib/template.mjs';

export { renderTemplate };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.join(__dirname, '../prompts/analyze.md');
const VOICE_PATH = path.join(__dirname, '../../src/content/brand/voice.md');

const CATEGORY_IDS = ['appliances', 'coffee', 'daily-goods', 'living', 'parenting', 'photography', 'travel'];
const confidenceSchema = z.enum(['high', 'medium', 'low']);

export const analyzeResultSchema = z.object({
  name: z.object({ value: z.string().min(1), confidence: confidenceSchema }),
  category: z.object({ value: z.enum(CATEGORY_IDS), confidence: confidenceSchema }),
  brand: z.object({ value: z.string().nullable(), confidence: confidenceSchema }),
  priceRange: z.object({ value: z.string().min(1), confidence: confidenceSchema }),
  tags: z.array(z.object({ value: z.string().min(1), confidence: confidenceSchema })),
  images: z.array(z.object({ alt: z.string().min(1) })),
  overallConfidence: confidenceSchema,
});

/** data URI・ホスティングURLどちらもClaude Messages APIのimageコンテンツブロックへ変換する */
export function toImageContentBlock(url) {
  const dataUriMatch = url.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUriMatch) {
    return { type: 'image', source: { type: 'base64', media_type: dataUriMatch[1], data: dataUriMatch[2] } };
  }
  return { type: 'image', source: { type: 'url', url } };
}

/**
 * @param {{ memo: string, imageUrls: string[], date: string | null }} intake - parseIntake()の出力
 * @returns {Promise<z.infer<typeof analyzeResultSchema>>}
 */
export async function runAnalyze(intake) {
  const template = readFileSync(PROMPT_PATH, 'utf-8');
  const voiceMd = readFileSync(VOICE_PATH, 'utf-8');

  const prompt = renderTemplate(template, {
    voiceMd,
    memo: intake.memo,
    date: intake.date ?? '不明',
    imageCount: String(intake.imageUrls.length),
  });

  const content = [
    ...intake.imageUrls.map(toImageContentBlock),
    { type: 'text', text: prompt },
  ];

  const response = await callClaude({
    stage: 'analyze',
    messages: [{ role: 'user', content }],
  });

  const textBlock = response.content?.find((block) => block.type === 'text');
  if (!textBlock) {
    throw new Error('[pipeline/scripts/analyze.mjs] Claude APIレスポンスにtextブロックが含まれていません。');
  }

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (err) {
    throw new Error(
      `[pipeline/scripts/analyze.mjs] Claude APIレスポンスがJSONとして解析できませんでした: ${err.message}\n---\n${textBlock.text}`
    );
  }

  return analyzeResultSchema.parse(parsed);
}

// CLI実行(GitHub Actions等から `node pipeline/scripts/analyze.mjs <issueNumber>` で呼ぶ想定)
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const issueNumber = process.argv[2];
  if (!issueNumber) {
    console.error('Usage: node pipeline/scripts/analyze.mjs <issueNumber>');
    process.exit(1);
  }
  const { getIssue } = await import('../lib/github.mjs');
  const { parseIntake } = await import('../lib/parse-intake.mjs');

  const issue = await getIssue(issueNumber);
  const intake = parseIntake(issue.body);
  const result = await runAnalyze(intake);
  console.log(JSON.stringify(result, null, 2));
}
