/**
 * GitHub REST API ヘルパー — 26章c17
 * pipeline各ステージ(Issue取得・コメント・Issue/PR作成)で共通利用する薄いラッパー。
 * GITHUB_TOKEN/GITHUB_REPOSITORY はGitHub Actions実行時に自動で環境変数へ入る
 * (workflow側で `env:` に明示的に渡すか、Actionsの既定変数をそのまま使う)。
 */

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[pipeline/lib/github.mjs] 環境変数 ${name} が設定されていません(GitHub Actions実行時のみ利用可能)。`
    );
  }
  return value;
}

function apiBase() {
  const repo = requireEnv('GITHUB_REPOSITORY');
  return `https://api.github.com/repos/${repo}`;
}

function headers() {
  const token = requireEnv('GITHUB_TOKEN');
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

export async function getIssue(issueNumber) {
  const res = await fetch(`${apiBase()}/issues/${issueNumber}`, { headers: headers() });
  if (!res.ok) {
    throw new Error(`[pipeline/lib/github.mjs] Issue #${issueNumber} の取得に失敗しました(status ${res.status})`);
  }
  return res.json();
}

export async function commentOnIssue(issueNumber, body) {
  const res = await fetch(`${apiBase()}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    throw new Error(`[pipeline/lib/github.mjs] Issue #${issueNumber} へのコメントに失敗しました(status ${res.status})`);
  }
  return res.json();
}

export async function findOpenIssueByLabel(label) {
  const res = await fetch(`${apiBase()}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=1`, {
    headers: headers(),
  });
  if (!res.ok) return null;
  const issues = await res.json();
  return Array.isArray(issues) && issues.length > 0 ? issues[0] : null;
}

export async function createIssue({ title, body, labels }) {
  const res = await fetch(`${apiBase()}/issues`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ title, body, labels }),
  });
  if (!res.ok) {
    throw new Error(`[pipeline/lib/github.mjs] Issue作成に失敗しました(status ${res.status})`);
  }
  return res.json();
}

export async function createPullRequest({ title, body, head, base = 'main' }) {
  const res = await fetch(`${apiBase()}/pulls`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ title, body, head, base }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`[pipeline/lib/github.mjs] PR作成に失敗しました(status ${res.status}): ${errBody}`);
  }
  return res.json();
}

/** ブランチ(refs/heads/{branch})のHEADコミットSHAを取得する(新規ブランチ作成の起点に使う) */
export async function getBranchSha(branch) {
  const res = await fetch(`${apiBase()}/git/ref/heads/${encodeURIComponent(branch)}`, { headers: headers() });
  if (!res.ok) {
    throw new Error(`[pipeline/lib/github.mjs] ブランチ ${branch} の取得に失敗しました(status ${res.status})`);
  }
  const data = await res.json();
  return data.object.sha;
}

/** 26章c21: Stage6(open-pr)がbaseブランチの最新コミットから新しい作業ブランチを作る際に使う */
export async function createBranch(branchName, fromSha) {
  const res = await fetch(`${apiBase()}/git/refs`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: fromSha }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`[pipeline/lib/github.mjs] ブランチ ${branchName} の作成に失敗しました(status ${res.status}): ${errBody}`);
  }
  return res.json();
}

/**
 * ファイルを指定ブランチへコミットする(新規作成・更新どちらも可)。
 * contentはUTF-8テキスト・バイナリいずれもBase64文字列で渡すこと
 * (画像などバイナリはBufferの `.toString('base64')`)。
 */
export async function createOrUpdateFile({ path: filePath, content, message, branch }) {
  const res = await fetch(`${apiBase()}/contents/${encodeURIComponent(filePath).replace(/%2F/g, '/')}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ message, content, branch }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`[pipeline/lib/github.mjs] ファイル ${filePath} のコミットに失敗しました(status ${res.status}): ${errBody}`);
  }
  return res.json();
}
