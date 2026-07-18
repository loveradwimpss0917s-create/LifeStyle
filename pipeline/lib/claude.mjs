/**
 * Claude Messages API 呼び出しラッパー — 26章c17
 * pipeline/config.json のmodel/temperature/maxTokens/retry設定を適用する。
 * 429(レート制限)・5xx(サーバーエラー)は指数バックオフでリトライし、
 * それ以外の4xx(リクエスト自体の誤り)は即座にエラーにする。
 *
 * ANTHROPIC_API_KEY はGitHub ActionsのSecretsに設定する運用(README参照)。
 * 未設定時は実際にAPIを呼ぶ前に明確なエラーメッセージで停止する。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '../config.json');

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

const DEFAULT_RETRY = { maxAttempts: 3, initialDelayMs: 1000, backoffMultiplier: 2 };

export function loadPipelineConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
}

function resolveStageConfig(config, stage) {
  const override = stage ? config.stages?.[stage] : undefined;
  return {
    model: override?.model ?? config.model,
    temperature: override?.temperature ?? config.temperature,
    maxTokens: override?.maxTokens ?? config.maxTokens,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {object} params
 * @param {string} [params.stage] - config.jsonのstages内キー(analyze等)。未指定時はトップレベルのデフォルト設定を使う
 * @param {Array<object>} params.messages - Messages API形式のmessages配列
 * @param {string} [params.system] - systemプロンプト
 * @returns {Promise<object>} Messages APIのレスポンスJSON
 */
export async function callClaude({ stage, messages, system }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[pipeline/lib/claude.mjs] 環境変数 ANTHROPIC_API_KEY が設定されていません。' +
        'GitHub Secretsに設定してください(README「オーナーへの引き継ぎ事項」参照)。'
    );
  }
  if (!messages || messages.length === 0) {
    throw new Error('[pipeline/lib/claude.mjs] messages が空です。');
  }

  const config = loadPipelineConfig();
  const { model, temperature, maxTokens } = resolveStageConfig(config, stage);
  const retry = { ...DEFAULT_RETRY, ...config.retry };

  let lastError;
  for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          ...(system ? { system } : {}),
          messages,
        }),
      });

      if (res.ok) {
        return await res.json();
      }

      if (res.status !== 429 && res.status < 500) {
        const body = await res.text();
        throw new Error(`[pipeline/lib/claude.mjs] Claude APIエラー(status ${res.status}, リトライ対象外): ${body}`);
      }

      lastError = new Error(`[pipeline/lib/claude.mjs] Claude APIエラー(status ${res.status})、リトライします`);
    } catch (err) {
      lastError = err;
    }

    if (attempt < retry.maxAttempts) {
      const delay = retry.initialDelayMs * Math.pow(retry.backoffMultiplier, attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError;
}
