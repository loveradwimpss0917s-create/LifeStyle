/**
 * 運営者本人のブラウザを示すCookie。/admin/ へのログイン成功時に付与し、
 * /go/ のクリック計測(functions/go/[[route]].ts)側でこのCookieを持つ
 * リクエストは記録をスキップする(自分のクリックで集計が汚れるのを防ぐ)。
 * functions/admin/_middleware.ts と functions/go/[[route]].ts の両方から
 * importされる共有モジュール。
 */

const COOKIE_NAME = 'hibistack_internal';
// 1年。定期的に/admin/へアクセスしていれば実質切れない。
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function hasInternalVisitorCookie(request: Request): boolean {
  const cookieHeader = request.headers.get('Cookie') ?? '';
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${COOKIE_NAME}=1`);
}

export function buildInternalVisitorCookieHeader(): string {
  return `${COOKIE_NAME}=1; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}
