import { vi } from "vitest";
import { fetchOpenIssues, GitHubAuthError } from "./issues.ts";

const listForRepo = vi.fn();

vi.mock("octokit", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: { issues: { listForRepo } },
  })),
}));

const REPO = { owner: "jamesagarside", repo: "beachfront" };

// Each test sets its own mock implementation (which overwrites the last), so no
// reset hook is needed — and resetting a mock that has returned a rejected
// promise detaches vitest's unhandled-rejection guard, surfacing false failures.
describe("fetchOpenIssues", () => {
  it("requests open issues for the configured repo", async () => {
    listForRepo.mockResolvedValue({ data: [] });
    await fetchOpenIssues("token", REPO);
    expect(listForRepo).toHaveBeenLastCalledWith(
      expect.objectContaining({
        owner: "jamesagarside",
        repo: "beachfront",
        state: "open",
      }),
    );
  });

  it("maps issues to title, number, labels and age", async () => {
    listForRepo.mockResolvedValue({
      data: [
        {
          number: 42,
          title: "A bug",
          html_url: "https://github.com/o/r/issues/42",
          created_at: "2026-06-01T00:00:00Z",
          labels: [{ name: "bug", color: "ff8c61" }, "ready-for-agent"],
        },
      ],
    });

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
      },
    ]);
  });

  it("filters out pull requests", async () => {
    listForRepo.mockResolvedValue({
      data: [
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
      ],
    });

    const issues = await fetchOpenIssues("token", REPO);
    expect(issues.map((i) => i.number)).toEqual([1]);
  });

  it("raises a clear auth error on 401/403", async () => {
    listForRepo.mockRejectedValue({ status: 403 });
    await expect(fetchOpenIssues("bad", REPO)).rejects.toBeInstanceOf(
      GitHubAuthError,
    );
  });

  it("rethrows other errors unchanged", async () => {
    listForRepo.mockRejectedValue(new Error("network down"));
    await expect(fetchOpenIssues("token", REPO)).rejects.toThrow(/network down/);
  });
});
