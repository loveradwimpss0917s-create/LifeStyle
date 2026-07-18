/**
 * Stage4: derive-sns(SNS派生生成) — 26章c23(09章§4 Stage4)
 * 商品レビューの内容から6チャネル分(ig-feed/ig-reel/ig-story/threads/
 * tiktok/yt-shorts)の投稿文・台本を1回のAPI呼び出しでまとめて生成する
 * (コスト最適化。6回に分けない)。
 *
 * 出力はサイトのビルド対象外である content-hub/sns/{slug}/ に配置する
 * (astro.config.mjsはsrc/pages・publicのみを対象とし、リポジトリ直下の
 * content-hub/は一切参照しないため、サイトには出ない)。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { callClaude } from '../lib/claude.mjs';
import { renderTemplate } from '../lib/template.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.join(__dirname, '../prompts/derive-sns.md');
const VOICE_PATH = path.join(__dirname, '../../src/content/brand/voice.md');

const MAX_EMOJI_PER_TEXT = 2;
// 絵文字の簡易カウント用(結合絵文字・肌色修飾子等の厳密な分割は行わないが、
// 実用上「1投稿2個まで」の超過検知には十分な精度)
const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;

export function countEmoji(text) {
  return (text.match(EMOJI_PATTERN) ?? []).length;
}

const sceneSchema = z.object({
  photo: z.string().min(1),
  caption: z.string().min(1),
  narration: z.string().min(1),
  durationSec: z.number().positive(),
});

const slideSchema = z.object({
  photo: z.string().min(1),
  stickerOrLinkPosition: z.string().min(1),
  text: z.string().min(1),
});

export const deriveSnsResultSchema = z.object({
  igFeed: z.object({
    caption: z.string().min(1),
    hashtags: z.array(z.string().min(1)).length(15),
  }),
  igReel: z.object({
    scenes: z.array(sceneSchema).min(6).max(9),
  }),
  igStory: z.object({
    slides: z.array(slideSchema).length(3),
  }),
  threads: z.object({
    text: z.string().min(1).max(250),
  }),
  tiktok: z.object({
    hook: z.string().min(1),
    development: z.string().min(1),
    punchline: z.string().min(1),
    description: z.string().min(1),
  }),
  ytShorts: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    tags: z.array(z.string().min(1)),
    script: z.string().min(1),
  }),
});

/** 生成結果に含まれる全テキストフィールドを走査し、1投稿2個までの絵文字制限(13章)を超えていないか検査する */
export function checkEmojiLimits(result) {
  const violations = [];
  function check(label, text) {
    const count = countEmoji(text);
    if (count > MAX_EMOJI_PER_TEXT) violations.push(`${label}(${count}個)`);
  }

  check('igFeed.caption', result.igFeed.caption);
  result.igReel.scenes.forEach((s, i) => {
    check(`igReel.scenes[${i}].caption`, s.caption);
    check(`igReel.scenes[${i}].narration`, s.narration);
  });
  result.igStory.slides.forEach((s, i) => check(`igStory.slides[${i}].text`, s.text));
  check('threads.text', result.threads.text);
  check('tiktok.hook', result.tiktok.hook);
  check('tiktok.development', result.tiktok.development);
  check('tiktok.punchline', result.tiktok.punchline);
  check('tiktok.description', result.tiktok.description);
  check('ytShorts.title', result.ytShorts.title);
  check('ytShorts.description', result.ytShorts.description);
  check('ytShorts.script', result.ytShorts.script);

  return violations;
}

/**
 * @param {{ name: string, summary: string, goodPoints: string[], concernPoints: string[], body: string }} product
 * @param {string} productUrl
 * @returns {Promise<z.infer<typeof deriveSnsResultSchema>>}
 */
export async function runDeriveSns(product, productUrl) {
  const template = readFileSync(PROMPT_PATH, 'utf-8');
  const voiceMd = readFileSync(VOICE_PATH, 'utf-8');

  const prompt = renderTemplate(template, {
    voiceMd,
    name: product.name,
    summary: product.summary,
    goodPoints: product.goodPoints.join(' / '),
    concernPoints: product.concernPoints.join(' / '),
    body: product.body,
    productUrl,
  });

  const response = await callClaude({
    stage: 'deriveSns',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  });

  const textBlock = response.content?.find((block) => block.type === 'text');
  if (!textBlock) {
    throw new Error('[pipeline/scripts/derive-sns.mjs] Claude APIレスポンスにtextブロックが含まれていません。');
  }

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (err) {
    throw new Error(
      `[pipeline/scripts/derive-sns.mjs] Claude APIレスポンスがJSONとして解析できませんでした: ${err.message}\n---\n${textBlock.text}`
    );
  }

  const result = deriveSnsResultSchema.parse(parsed);

  const emojiViolations = checkEmojiLimits(result);
  if (emojiViolations.length > 0) {
    throw new Error(`[pipeline/scripts/derive-sns.mjs] 絵文字が1投稿2個の上限を超えています: ${emojiViolations.join(', ')}`);
  }

  return result;
}

/**
 * content-hub/sns/{slug}/ に配置する6ファイル分の { path, content } を組み立てる。
 * content-hubはastro.config.mjsのどの対象にも含まれないため、サイトのビルドには
 * 一切影響しない(src/pages・publicのみが対象)。
 */
export function buildSnsFiles(slug, result) {
  const base = `content-hub/sns/${slug}`;

  const igFeedMd = [
    '# Instagram フィード',
    '',
    result.igFeed.caption,
    '',
    result.igFeed.hashtags.map((h) => `#${h}`).join(' '),
    '',
  ].join('\n');

  const igReelMd = [
    '# Instagram リール台本',
    '',
    ...result.igReel.scenes.map(
      (s, i) =>
        `## シーン${i + 1}(${s.durationSec}秒)\n\n- 写真: ${s.photo}\n- テロップ: ${s.caption}\n- ナレーション: ${s.narration}\n`
    ),
  ].join('\n');

  const igStoryMd = [
    '# Instagram ストーリー構成案(3枚)',
    '',
    ...result.igStory.slides.map(
      (s, i) => `## ${i + 1}枚目\n\n- 写真: ${s.photo}\n- スタンプ/リンク位置: ${s.stickerOrLinkPosition}\n- 文言: ${s.text}\n`
    ),
  ].join('\n');

  const threadsMd = ['# Threads', '', result.threads.text, ''].join('\n');

  const tiktokMd = [
    '# TikTok 台本',
    '',
    `## フック(最初の3秒)\n\n${result.tiktok.hook}\n`,
    `## 展開\n\n${result.tiktok.development}\n`,
    `## オチ\n\n${result.tiktok.punchline}\n`,
    `## 概要欄\n\n${result.tiktok.description}\n`,
  ].join('\n');

  const ytShortsMd = [
    '# YouTube Shorts',
    '',
    `## タイトル\n\n${result.ytShorts.title}\n`,
    `## 説明欄\n\n${result.ytShorts.description}\n`,
    `## タグ\n\n${result.ytShorts.tags.join(', ')}\n`,
    `## 台本\n\n${result.ytShorts.script}\n`,
  ].join('\n');

  return [
    { path: `${base}/ig-feed.md`, content: igFeedMd },
    { path: `${base}/ig-reel.md`, content: igReelMd },
    { path: `${base}/ig-story.md`, content: igStoryMd },
    { path: `${base}/threads.md`, content: threadsMd },
    { path: `${base}/tiktok.md`, content: tiktokMd },
    { path: `${base}/yt-shorts.md`, content: ytShortsMd },
  ];
}
