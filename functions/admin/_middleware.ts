/// <reference types="@cloudflare/workers-types" />
/**
 * /admin/* 用のBasic Auth (簡易パスワード) ゲート。
 * ADMIN_PASSWORD(Cloudflare Pagesの環境変数、Secret)と一致しない場合は
 * ブラウザ標準のBasic Auth再入力ダイアログを返す。ユーザー名は問わない
 * (パスワードのみのゲートとして運用する想定)。
 *
 * 低リスク・内部向け(読み取り専用の集計値のみ)であるため、タイミング攻撃
 * 対策の定数時間比較までは導入していない(0章§0の過剰実装回避方針)。
 *
 * ADMIN_PASSWORD未設定時はフェイルクローズ(アクセス拒否)する。
 *
 * 認証成功時は運営者識別Cookie(functions/_lib/internal-visitor.ts)を付与し、
 * このブラウザからの/go/クリックが集計に混ざらないようにする。
 */
import { buildInternalVisitorCookieHeader } from '../_lib/internal-visitor';

interface Env {
  ADMIN_PASSWORD?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!env.ADMIN_PASSWORD) {
    return new Response('管理画面は未設定です(ADMIN_PASSWORDが設定されていません)。', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const [scheme, encoded] = authHeader.split(' ');
  let providedPassword = '';
  if (scheme === 'Basic' && encoded) {
    try {
      const decoded = atob(encoded);
      const separatorIndex = decoded.indexOf(':');
      providedPassword = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : decoded;
    } catch {
      providedPassword = '';
    }
  }

  if (providedPassword !== env.ADMIN_PASSWORD) {
    return new Response('認証が必要です。', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="HIBISTACK Admin"',
        'content-type': 'text/plain; charset=utf-8',
      },
    });
  }

  const response = await context.next();
  const responseWithCookie = new Response(response.body, response);
  responseWithCookie.headers.append('Set-Cookie', buildInternalVisitorCookieHeader());
  return responseWithCookie;
};
