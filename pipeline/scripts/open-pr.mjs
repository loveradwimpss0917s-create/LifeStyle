/**
 * Stage6: open-pr(PR作成) — 26章c21(09章§4 Stage6)
 * Stage1(analyze)〜Stage5(seo-meta)の結果を統合し、ブランチ作成→
 * products/*.md・画像のコミット→PR作成までを行う承認フローの最終ステージ。
 *
 * 実装上の補足(統合作業で判明したギャップ):
 * - content.config.tsのproducts collectionスキーマは rating/usagePeriod が
 *   必須(brand/priceと異なりoptionalではない)。09章のAI解析だけでは
 *   本来推測が難しい項目だが、Zodスキーマ上「値を書かずに下書きとして
 *   保存する」ことができないため、analyzeResultSchema(26章c18)に
 *   rating/usagePeriodを追加し、低確信度でも妥当な値を出力する契約にした
 *   (低確信度の場合はPRチェックリストで人間の確認を促す)。
 * - productsスキーマにはarticlesのような `seo.description` 相当の項目が
 *   存在せず、ProductLayout.astroは name/summary をそのままmeta descriptionに
 *   使っている。そのためseo-meta.mjs(26章c20)が生成するtitle/descriptionは
 *   frontmatterには書き込まず、PR本文の参考情報としてのみ記載する
 *   (既存のレンダリング・スキーマを変更しない方針)。
 * - スラッグ(ファイル名・URLに使う英語識別子)はStage1(analyze)が
 *   `slug` フィールドとして提案する(26章c18で追加)。
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getIssue,
  createBranch,
  createOrUpdateFile,
  createPullRequest,
  commentOnIssue,
  getBranchSha,
} from '../lib/github.mjs';
import { parseIntake } from '../lib/parse-intake.mjs';
import { runAnalyze } from './analyze.mjs';
import { runComposeProduct } from './compose-product.mjs';
import { generateSeoMeta, suggestRelatedArticles } from './seo-meta.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTS_DIR = path.join(__dirname, '../../src/content/products');
const PR_TEMPLATE_PATH = path.join(__dirname, '../../.github/PULL_REQUEST_TEMPLATE/content.md');
const BASE_BRANCH = 'main';

function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

function renderPrBody(vars) {
  const template = readFileSync(PR_TEMPLATE_PATH, 'utf-8');
  const withoutComments = stripHtmlComments(template);
  return withoutComments.replace(/\{\{(\w+)\}\}/g, (_, key) => (key in vars ? String(vars[key]) : ''));
}

/** 既存商品と衝突しないスラッグを決める(衝突時は -2, -3 ... を付与) */
export function resolveUniqueSlug(baseSlug) {
  const existing = new Set(readdirSync(PRODUCTS_DIR).map((f) => f.replace(/\.md$/, '')));
  if (!existing.has(baseSlug)) return baseSlug;
  let n = 2;
  while (existing.has(`${baseSlug}-${n}`)) n++;
  return `${baseSlug}-${n}`;
}

/** "約3,000円" のような文字列から先頭の数値を抽出する。抽出できなければnull(priceはoptionalのため省略可) */
export function parsePriceRange(priceRangeText) {
  const match = priceRangeText.replace(/,/g, '').match(/(\d+)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function yamlString(value) {
  return JSON.stringify(value);
}

/**
 * @param {object} analyzeResult - runAnalyze()の出力
 * @param {object} composeResult - runComposeProduct()の出力(needsConfirmation:false)
 * @param {{ purchasedAt: string, images: Array<{ filename: string, alt: string }> }} extra
 * @returns {string} frontmatter+本文の完全なMarkdownファイル内容
 */
export function buildFullProductFile(analyzeResult, composeResult, slug, extra) {
  if (composeResult.needsConfirmation) {
    throw new Error('[pipeline/scripts/open-pr.mjs] needsConfirmation:true の結果からファイルは組み立てられません。');
  }

  const price = parsePriceRange(analyzeResult.priceRange.value);
  const fm = composeResult.frontmatter;

  const lines = [
    `name: ${yamlString(fm.name)}`,
    `category: ${analyzeResult.category.value}`,
  ];
  if (analyzeResult.brand.value) {
    lines.push(`brand: ${analyzeResult.brand.value}`);
  }
  if (price !== null) {
    lines.push(`price: ${price}`);
  }
  lines.push(`purchasedAt: ${extra.purchasedAt}`);
  lines.push(`usagePeriod: ${analyzeResult.usagePeriod.value}`);
  lines.push(`rating: ${analyzeResult.rating.value}`);
  lines.push(`summary: ${yamlString(fm.summary)}`);
  lines.push('goodPoints:');
  for (const p of fm.goodPoints) lines.push(`  - ${yamlString(p)}`);
  lines.push('concernPoints:');
  for (const p of fm.concernPoints) lines.push(`  - ${yamlString(p)}`);
  lines.push('images:');
  for (const img of extra.images) {
    lines.push(`  - src: "../../assets/products/${slug}/${img.filename}"`);
    lines.push(`    alt: ${yamlString(img.alt)}`);
  }
  if (fm.tags.length > 0) {
    lines.push('tags:');
    for (const t of fm.tags) lines.push(`  - ${t}`);
  }
  lines.push('status: draft');

  return `---\n${lines.join('\n')}\n---\n\n${composeResult.body}\n`;
}

/** data URI・ホスティングURLどちらも{ base64, extension }に変換する(GitHub Contents APIへのコミット用) */
export async function fetchImageAsBase64(url) {
  const dataUriMatch = url.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUriMatch) {
    const extension = dataUriMatch[1].split('/')[1] ?? 'jpg';
    return { base64: dataUriMatch[2], extension };
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[pipeline/scripts/open-pr.mjs] 画像の取得に失敗しました(status ${res.status}): ${url}`);
  }
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const extension = contentType.split('/')[1]?.split(';')[0] ?? 'jpg';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString('base64'), extension };
}

/**
 * Issue番号を起点にStage1〜Stage6を実行し、products/*.mdと画像をコミットしてPRを作成する。
 * Stage2がneedsConfirmation:trueを返した場合はPRを作らず、Issueにコメントして終了する
 * (intakeは失われない・09章§7ガードレール)。
 */
export async function runOpenPr(issueNumber) {
  const issue = await getIssue(issueNumber);
  const intake = parseIntake(issue.body);

  const analyzeResult = await runAnalyze(intake);
  const composeResult = await runComposeProduct(analyzeResult, intake);

  if (composeResult.needsConfirmation) {
    await commentOnIssue(
      issueNumber,
      `Stage2(compose-product)が確認を必要としています。PRは作成していません。\n\n理由: ${composeResult.confirmationReason}`
    );
    return { status: 'needs_confirmation', reason: composeResult.confirmationReason };
  }

  const slug = resolveUniqueSlug(analyzeResult.slug.value);

  const images = [];
  for (let i = 0; i < analyzeResult.images.length; i++) {
    const sourceUrl = intake.imageUrls[i];
    const { base64, extension } = await fetchImageAsBase64(sourceUrl);
    const filename = `${String(i + 1).padStart(2, '0')}.${extension}`;
    images.push({ filename, alt: analyzeResult.images[i].alt, base64 });
  }

  const purchasedAt = intake.date ?? new Date().toISOString().slice(0, 10);
  const fileContent = buildFullProductFile(analyzeResult, composeResult, slug, {
    purchasedAt,
    images: images.map(({ filename, alt }) => ({ filename, alt })),
  });

  const seoMeta = await generateSeoMeta({
    name: composeResult.frontmatter.name,
    summary: composeResult.frontmatter.summary,
    category: analyzeResult.category.value,
    tags: composeResult.frontmatter.tags,
  });
  const relatedArticles = suggestRelatedArticles({
    categoryId: analyzeResult.category.value,
    tagIds: composeResult.frontmatter.tags,
  });

  const branchName = `content/${issueNumber}-${slug}`;
  const baseSha = await getBranchSha(BASE_BRANCH);
  await createBranch(branchName, baseSha);

  await createOrUpdateFile({
    path: `src/content/products/${slug}.md`,
    content: Buffer.from(fileContent, 'utf-8').toString('base64'),
    message: `content: ${composeResult.frontmatter.name}の下書きを追加(#${issueNumber})`,
    branch: branchName,
  });

  for (const image of images) {
    await createOrUpdateFile({
      path: `src/assets/products/${slug}/${image.filename}`,
      content: image.base64,
      message: `content: ${composeResult.frontmatter.name}の画像を追加(#${issueNumber})`,
      branch: branchName,
    });
  }

  const prBody = renderPrBody({
    productName: composeResult.frontmatter.name,
    category: analyzeResult.category.value,
    previewUrl: `(Cloudflare Pagesのプレビューデプロイが完了次第、このPRに自動でリンクが表示されます)`,
    generationSummary: [
      `- 総合確信度: ${analyzeResult.overallConfidence}`,
      `- 参考SEO title: ${seoMeta.title}`,
      `- 参考SEO description: ${seoMeta.description}`,
      `- rating(AI推測): ${analyzeResult.rating.value}(confidence: ${analyzeResult.rating.confidence})`,
      `- usagePeriod(AI推測): ${analyzeResult.usagePeriod.value}(confidence: ${analyzeResult.usagePeriod.confidence})`,
    ].join('\n'),
    relatedArticlesList:
      relatedArticles.length > 0
        ? relatedArticles.map((a) => `- [${a.title}](${a.path})`).join('\n')
        : '(提案できる関連記事がありませんでした)',
  });

  const pr = await createPullRequest({
    title: `content: ${composeResult.frontmatter.name}`,
    body: prBody,
    head: branchName,
    base: BASE_BRANCH,
  });

  return { status: 'ok', pr };
}

// CLI実行: `node pipeline/scripts/open-pr.mjs <issueNumber>`
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const issueNumber = process.argv[2];
  if (!issueNumber) {
    console.error('Usage: node pipeline/scripts/open-pr.mjs <issueNumber>');
    process.exit(1);
  }
  const result = await runOpenPr(issueNumber);
  console.log(JSON.stringify(result, null, 2));
}
