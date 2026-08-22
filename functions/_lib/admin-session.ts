/**
 * /admin/ のセッションCookie発行・検証。
 *
 * 当初はBasic Authだったが、iOSの「ホーム画面に追加」で開く独立表示モード
 * (WKWebViewベースでブラウザの外枠が無い)はBasic Authの認証ダイアログを
 * まともに表示できず、開くと黒画面のまま止まる不具合が実機で確認された。
 * そのためパスワード入力フォーム+Cookieセッション方式に変更した(通常の
 * HTMLフォーム送信+Cookieは独立表示モードでも問題なく動作する)。
 *
 * サーバー側にセッションを保存する仕組み(KV/D1)を持たないため、有効期限
 * 付きの署名(HMAC-SHA256、鍵はADMIN_PASSWORD自体)をCookie値に埋め込む
 * ステートレス方式にした。ADMIN_PASSWORDを変更すると、発行済みの全
 * セッションは自動的に無効になる。
 */

const SESSION_COOKIE_NAME = 'hibistack_admin_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180日

async function hmacHex(key: string, message: string): Promise<string> {
  const keyData = new TextEncoder().encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSessionCookie(adminPassword: string): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const signature = await hmacHex(adminPassword, String(expires));
  const value = `${expires}.${signature}`;
  return `${SESSION_COOKIE_NAME}=${value}; Path=/admin/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/admin/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie') ?? '';
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1);
    }
  }
  return null;
}

export async function hasValidSession(request: Request, adminPassword: string): Promise<boolean> {
  const raw = readCookie(request, SESSION_COOKIE_NAME);
  if (!raw) return false;

  const dotIndex = raw.indexOf('.');
  if (dotIndex < 0) return false;

  const expiresPart = raw.slice(0, dotIndex);
  const signaturePart = raw.slice(dotIndex + 1);
  const expires = Number(expiresPart);
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false;

  const expectedSignature = await hmacHex(adminPassword, expiresPart);
  return signaturePart === expectedSignature;
}
