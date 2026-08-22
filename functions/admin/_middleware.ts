/// <reference types="@cloudflare/workers-types" />
/**
 * /admin/* 用の認証ゲート。
 *
 * 当初はBasic Authだったが、iOSの「ホーム画面に追加」で開く独立表示モード
 * (WKWebViewベースでブラウザの外枠が無い)はBasic Authの認証ダイアログを
 * まともに表示できず、開くと黒画面のまま止まる不具合が実機で確認された。
 * そのためパスワード入力フォーム(POST /admin/login)+Cookieセッション方式
 * (functions/_lib/admin-session.ts)に変更した。
 *
 * 未認証の場合: /admin/api/* へのリクエストはJSON 401、それ以外(ページ本体)
 * はログインフォームHTMLをこのファイルが直接返す(静的アセットには到達
 * させない)。認証済みの場合のみ context.next() で本来のレスポンス
 * (静的ページ or APIファンクション)へ進む。
 *
 * ADMIN_PASSWORD未設定時はフェイルクローズ(アクセス拒否)する。
 */
import { createSessionCookie, hasValidSession } from '../_lib/admin-session';
import { buildInternalVisitorCookieHeader } from '../_lib/internal-visitor';

interface Env {
  ADMIN_PASSWORD?: string;
}

function loginFormHtml(errorMessage?: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ログイン | HIBISTACK Admin</title>
<link rel="manifest" href="/admin-manifest.webmanifest">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    color: #1a1a18;
    font-family: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", sans-serif;
    padding: 24px;
  }
  .card {
    width: 100%;
    max-width: 320px;
  }
  h1 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0 0 24px;
  }
  label {
    display: block;
    font-size: 0.8rem;
    color: #6b6b66;
    margin-bottom: 6px;
  }
  input[type="password"] {
    width: 100%;
    padding: 10px 12px;
    font-size: 1rem;
    border: 1px solid #d8d8d4;
    border-radius: 6px;
    margin-bottom: 16px;
  }
  button {
    width: 100%;
    padding: 10px 12px;
    font-size: 1rem;
    font-weight: 600;
    background: #1a1a18;
    color: #ffffff;
    border: none;
    border-radius: 6px;
  }
  .error {
    color: #b3261e;
    font-size: 0.85rem;
    margin-bottom: 16px;
  }
</style>
</head>
<body>
  <form class="card" method="POST" action="/admin/login">
    <h1>HIBISTACK 管理画面</h1>
    ${errorMessage ? `<p class="error">${errorMessage}</p>` : ''}
    <label for="password">パスワード</label>
    <input type="password" id="password" name="password" autocomplete="current-password" autofocus required>
    <button type="submit">ログイン</button>
  </form>
</body>
</html>`;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.ADMIN_PASSWORD) {
    return new Response('管理画面は未設定です(ADMIN_PASSWORDが設定されていません)。', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  if (request.method === 'POST' && url.pathname === '/admin/login') {
    let password: unknown = null;
    try {
      const formData = await request.formData();
      password = formData.get('password');
    } catch {
      password = null;
    }

    if (typeof password === 'string' && password === env.ADMIN_PASSWORD) {
      const sessionCookie = await createSessionCookie(env.ADMIN_PASSWORD);
      return new Response(null, {
        status: 303,
        headers: { Location: '/admin/', 'Set-Cookie': sessionCookie },
      });
    }

    return new Response(loginFormHtml('パスワードが違います。'), {
      status: 401,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const authed = await hasValidSession(request, env.ADMIN_PASSWORD);

  if (!authed) {
    if (url.pathname.startsWith('/admin/api/')) {
      return Response.json({ error: '認証が必要です。' }, { status: 401 });
    }
    return new Response(loginFormHtml(), {
      status: 401,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const response = await context.next();
  const responseWithCookie = new Response(response.body, response);
  responseWithCookie.headers.append('Set-Cookie', buildInternalVisitorCookieHeader());
  return responseWithCookie;
};
