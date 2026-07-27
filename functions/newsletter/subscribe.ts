/// <reference types="@cloudflare/workers-types" />
/**
 * /newsletter/subscribe — Newsletter(Buttondown)登録の受け口。
 *
 * 実バグ修正: 以前はブラウザから直接Buttondownの埋め込みフォームAPIへPOSTし、
 * target="_blank"で確認画面(英語UI)を新しいタブに開いていた。訪問者からは
 * 「登録の手間が増える」「英語表記で不安・見栄えが悪い」という指摘があった。
 * 一方で、実際のPOSTを行わずJS側で送信イベントだけを見て楽観的に「成功」
 * 表示する方式も試したが、本当に登録できたかを確認する手段がなく、実際には
 * 未登録なのに画面上は成功したように見えるという重大な不具合になった。
 *
 * そのため、フォームは同一オリジンのこの関数へPOSTし、ここでButtondownの
 * 公式API(https://api.buttondown.com/v1/subscribers)へサーバー側から登録し、
 * 実際の成否を確認したうえで、トップページへ結果をクエリパラメータ付きで
 * 302リダイレクトする(新しいタブを開かない・英語画面を一切見せない)。
 * BUTTONDOWN_API_KEY(Cloudflare Pagesの環境変数)が未設定の場合はエラー
 * 扱いでリダイレクトする(0章§0前提: 環境変数未設定でも壊れない)。
 *
 * 実バグ調査メモ: ダッシュボードの保存ダイアログには「この変更は次回の
 * デプロイから反映されます」と明記されており、Retry deploymentが古い
 * スナップショットのまま再実行される可能性があったため、確実に新しい
 * デプロイを発生させる目的でこのコメントのみのコミットを追加した。
 */

interface Env {
  BUTTONDOWN_API_KEY?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const redirectTo = new URL('/', request.url);

  let email: string | null = null;
  try {
    const formData = await request.formData();
    const value = formData.get('email');
    email = typeof value === 'string' ? value.trim() : null;
  } catch {
    email = null;
  }

  if (!email) {
    redirectTo.searchParams.set('newsletter', 'error');
    redirectTo.searchParams.set('newsletter_debug', 'no-email');
    return Response.redirect(redirectTo.toString(), 303);
  }

  if (!env.BUTTONDOWN_API_KEY) {
    redirectTo.searchParams.set('newsletter', 'error');
    redirectTo.searchParams.set('newsletter_debug', 'no-api-key-binding');
    return Response.redirect(redirectTo.toString(), 303);
  }

  try {
    const res = await fetch('https://api.buttondown.com/v1/subscribers', {
      method: 'POST',
      headers: {
        Authorization: `Token ${env.BUTTONDOWN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email_address: email, type: 'regular' }),
    });

    if (res.ok) {
      redirectTo.searchParams.set('newsletter', 'success');
    } else {
      const bodyText = await res.text().catch(() => '');
      const alreadySubscribed = /already|duplicate|exists/i.test(bodyText);
      redirectTo.searchParams.set('newsletter', alreadySubscribed ? 'already' : 'error');
      // 調査用の一時的な診断情報(APIキーそのものは含まない)。原因特定後に削除する。
      redirectTo.searchParams.set('newsletter_debug', `${res.status}:${bodyText.slice(0, 200)}`);
    }
  } catch (err) {
    redirectTo.searchParams.set('newsletter', 'error');
    redirectTo.searchParams.set('newsletter_debug', `throw:${err instanceof Error ? err.message : String(err)}`);
  }

  return Response.redirect(redirectTo.toString(), 303);
};
