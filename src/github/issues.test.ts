import { vi } from "vitest";
import {
  fetchOpenIssues,
  GitHubAuthError,
  GitHubRateLimitError,
} from "./issues.ts";

const listForRepo = vi.fn();
const paginate = vi.fn();

vi.mock("octokit", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: { issues: { listForRepo } },
    paginate,
  })),
}));

const REPO = { owner: "jamesagarside", repo: "beachfront" };

// Each test sets its own mock implementation (which overwrites the last), so no
// reset hook is needed — and resetting a mock that has returned a rejected
// promise detaches vitest's unhandled-rejection guard, surfacing false failures.
describe("fetchOpenIssues", () => {
  it("requests open issues for the configured repo", async () => {
    paginate.mockResolvedValue([]);
    await fetchOpenIssues("token", REPO);
    expect(paginate).toHaveBeenLastCalledWith(
      listForRepo,
      expect.objectContaining({
        owner: "jamesagarside",
        repo: "beachfront",
        state: "open",
      }),
    );
  });

  it("maps issues to title, number, labels and age", async () => {
    paginate.mockResolvedValue([
      {
        number: 42,
        title: "A bug",
        html_url: "https://github.com/o/r/issues/42",
        created_at: "2026-06-01T00:00:00Z",
        labels: [{ name: "bug", color: "ff8c61" }, "ready-for-agent"],
        comments: 3,
      },
    ]);

    const issues = await fetchOpenIssues("token", REPO);

    expect(issues).toEqual([
      {
        number: 42,
        title: "A bug",
        url: "https://github.com/o/r/issues/42",
        createdAt: "2026-06-01T00:00:00Z",
        labels: [
          { name: "bug", color: "ff8c61" },
          { name: "ready-for-agent", color: "" },
        ],
        comments: 3,
      },
    ]);
  });

  it("filters out pull requests", async () => {
    paginate.mockResolvedValue([
      {
        number: 1,
        title: "Real issue",
        html_url: "u",
        created_at: "2026-06-01T00:00:00Z",
        labels: [],
      },
      {
        number: 2,
        title: "A PR",
        html_url: "u",
        created_at: "2026-06-01T00:00:00Z",
        labels: [],
        pull_request: { url: "p" },
      },
    ]);

    const issues = await fetchOpenIssues("token", REPO);
    expect(issues.map((i) => i.number)).toEqual([1]);
  });

  it("returns a backlog larger than one page in full", async () => {
    paginate.mockResolvedValue(
      Array.from({ length: 150 }, (_, i) => ({
        number: i + 1,
        title: `Issue ${i + 1}`,
        html_url: "u",
        created_at: "2026-06-01T00:00:00Z",
        labels: [],
      })),
    );

    const issues = await fetchOpenIssues("token", REPO);
    expect(issues).toHaveLength(150);
    expect(paginate).toHaveBeenLastCalledWith(
      listForRepo,
      expect.objectContaining({ per_page: 100 }),
    );
  });

  it("raises a clear auth error on 401/403", async () => {
    paginate.mockRejectedValue({ status: 403 });
    await expect(fetchOpenIssues("bad", REPO)).rejects.toBeInstanceOf(
      GitHubAuthError,
    );
  });

  it("reports a spent rate limit as rate limiting, not a bad token", async () => {
    paginate.mockRejectedValue({
      status: 403,
      response: { headers: { "x-ratelimit-remaining": "0" } },
    });
    await expect(fetchOpenIssues("token", REPO)).rejects.toBeInstanceOf(
      GitHubRateLimitError,
    );
    paginate.mockRejectedValue({
      status: 403,
      response: { headers: { "x-ratelimit-remaining": "0" } },
    });
    await expect(fetchOpenIssues("token", REPO)).rejects.toThrow(
      /rate-limiting/,
    );
  });

  it("keeps a 403 with quota remaining on the token-rejected path", async () => {
    paginate.mockRejectedValue({
      status: 403,
      response: { headers: { "x-ratelimit-remaining": "42" } },
    });
    const err = await fetchOpenIssues("token", REPO).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GitHubAuthError);
    expect(err).not.toBeInstanceOf(GitHubRateLimitError);
  });

  it("rethrows other errors unchanged", async () => {
    paginate.mockRejectedValue(new Error("network down"));
    await expect(fetchOpenIssues("token", REPO)).rejects.toThrow(/network down/);
  });
});
