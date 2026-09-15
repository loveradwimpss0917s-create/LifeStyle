/**
 * User-Agentベースの簡易ボット判定。functions/go/[[route]].ts のクリック計測から
 * 検索エンジン・SNSリンクプレビュー・SEOツール等のクローラーを除外するために使う。
 *
 * 経緯: /go/ はrobots.txtでDisallowにしたが、これは行儀の良いクローラー
 * (Googlebot等)にしか効かない。robots.txtを無視するボットや、Yahoo!/Amazon
 * 側のアフィリエイト計測が独自にボット除外している実測値との突き合わせで、
 * /go/側のクリック数だけが大幅に多い(同じ日・同じモールでYahoo公式0件に対し
 * こちら22件、等)ことが確認されたため導入した。
 *
 * リダイレクト自体は常に行い、Analytics Engineへの書き込みだけをスキップする
 * (0章§0前提: ボット判定を誤っても実際のユーザー体験は壊れない)。
 */
const BOT_USER_AGENT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|discordbot|telegrambot|whatsapp|preview|headless|semrush|ahrefs|mj12bot|gptbot|ccbot|claudebot|perplexitybot|bytespider|petalbot/i;

export function isLikelyBot(request: Request): boolean {
  const ua = request.headers.get('User-Agent') ?? '';
  if (ua === '') return true; // User-Agent無しは大半のブラウザで発生しないため、ボット・ツールの可能性が高い
  return BOT_USER_AGENT_PATTERN.test(ua);
}
