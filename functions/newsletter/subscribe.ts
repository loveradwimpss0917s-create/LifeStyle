/// <reference types="@cloudflare/workers-types" />
/**
 * /newsletter/subscribe — Newsletter(Buttondown)登録の受け口。
 *
 * 実バグ修正の経緯: ①ブラウザから直接Buttondownの埋め込みフォームAPIへPOSTし、
 * target="_blank"で確認画面(英語UI)を新しいタブに開いていたが、登録者から
 * 「手間が増える」「英語表記で見栄えが悪く不安を煽る」との指摘があった。
 * ②非表示iframeへ送信しその場に日本語メッセージを出す方式を試したが、
 * 実際の送信結果を確認する手段がなく、未登録なのに画面上は成功したように
 * 見える重大な不具合になった。
 *
 * そのため、フォームは同一オリジンのこの関数へPOSTし、ここでButtondownの
 * 公式API(https://api.buttondown.com/v1/subscribers)へサーバー側から登録し、
 * 実際の成否を確認したうえで、トップページへ結果をクエリパラメータ付きで
 * 302リダイレクトする(新しいタブを開かない・英語画面を一切見せない)。
 * BUTTONDOWN_API_KEY(Cloudflare Pagesの環境変数)が未設定の場合はエラー
 * 扱いでリダイレクトする(0章§0前提: 環境変数未設定でも壊れない)。
 *
 * X-Buttondown-Bypass-Firewallヘッダーについて: Buttondownはスパム対策の
 * ファイアウォールを持ち、実在するGmailアドレスであってもリスクスコアに
 * より誤ってブロックされることがある(subscriber_blocked)。このFunctionは
 * 認証済みのAPIキーを持つ、サイト運営者自身のサーバー経由という信頼できる
 * 送信元からのリクエストのため、公式ドキュメント通りこのヘッダーで
 * ファイアウォールをバイパスする。
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
    return Response.redirect(redirectTo.toString(), 303);
  }

  if (!env.BUTTONDOWN_API_KEY) {
    redirectTo.searchParams.set('newsletter', 'error');
    return Response.redirect(redirectTo.toString(), 303);
  }

  try {
    const res = await fetch('https://api.buttondown.com/v1/subscribers', {
      method: 'POST',
      headers: {
        Authorization: `Token ${env.BUTTONDOWN_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Buttondown-Bypass-Firewall': 'true',
      },
      body: JSON.stringify({ email_address: email, type: 'regular' }),
    });

    if (res.ok) {
      redirectTo.searchParams.set('newsletter', 'success');
    } else {
      const bodyText = await res.text().catch(() => '');
      const alreadySubscribed = /already|duplicate|exists/i.test(bodyText);
      redirectTo.searchParams.set('newsletter', alreadySubscribed ? 'already' : 'error');
    }
  } catch {
    redirectTo.searchParams.set('newsletter', 'error');
  }

  return Response.redirect(redirectTo.toString(), 303);
};
