/**
 * Confirms a token's identity by calling the GitHub API as that token. This is
 * the first browser → GitHub API call (ADR-0001); later slices add Octokit +
 * TanStack Query, but identity is a single, dependency-free fetch.
 */
export interface Viewer {
  login: string;
  avatarUrl: string;
  name: string | null;
}

export async function fetchViewer(token: string): Promise<Viewer> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "GitHub rejected that token. Check it hasn't expired and has access.",
    );
  }
  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status}).`);
  }

  const data = (await res.json()) as {
    login: string;
    avatar_url: string;
    name: string | null;
  };
  return {
    login: data.login,
    avatarUrl: data.avatar_url,
    name: data.name ?? null,
  };
}
