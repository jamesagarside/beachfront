import { screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import { renderWithProviders } from "../test/render.tsx";
import { RegistryIssues } from "./RegistryIssues.tsx";
import { GitHubAuthError, GitHubRateLimitError } from "./issues.ts";
import type { RepoRef } from "../config.ts";

const fetchOpenIssues = vi.fn();
vi.mock("./issues.ts", async () => {
  const actual = await vi.importActual<typeof import("./issues.ts")>(
    "./issues.ts",
  );
  return {
    ...actual,
    fetchOpenIssues: (...a: unknown[]) => fetchOpenIssues(...a),
  };
});

const fetchTriageMapping = vi.fn();
vi.mock("./triageMapping.ts", async () => {
  const actual = await vi.importActual<typeof import("./triageMapping.ts")>(
    "./triageMapping.ts",
  );
  return {
    ...actual,
    fetchTriageMapping: (...a: unknown[]) => fetchTriageMapping(...a),
  };
});

const REPOS: RepoRef[] = [
  { owner: "alpha", repo: "one" },
  { owner: "beta", repo: "two" },
];

function issue(number: number, title: string) {
  return {
    number,
    title,
    url: `https://github.com/o/r/issues/${number}`,
    createdAt: "2026-06-01T00:00:00Z",
    labels: [{ name: "enhancement", color: "1b998b" }],
  };
}

describe("RegistryIssues", () => {
  beforeEach(() => {
    fetchOpenIssues.mockReset();
    fetchTriageMapping.mockReset();
    fetchTriageMapping.mockResolvedValue(null);
  });

  it("renders issues from every accessible repo, grouped by repo", async () => {
    fetchOpenIssues.mockImplementation((_token: string, repo?: RepoRef) =>
      repo?.repo === "two"
        ? Promise.resolve([issue(2, "Second repo issue")])
        : Promise.resolve([issue(1, "First repo issue")]),
    );

    renderWithProviders(<RegistryIssues token="t" repos={REPOS} />);

    const alpha = await screen.findByRole("region", { name: /alpha\/one/i });
    expect(
      within(alpha).getByRole("link", { name: /first repo issue/i }),
    ).toBeInTheDocument();

    const beta = screen.getByRole("region", { name: /beta\/two/i });
    expect(
      within(beta).getByRole("link", { name: /second repo issue/i }),
    ).toBeInTheDocument();
  });

  it("skips an inaccessible repo without breaking the rest of the view", async () => {
    fetchOpenIssues.mockImplementation((_token: string, repo?: RepoRef) =>
      repo?.repo === "two"
        ? Promise.reject(new GitHubAuthError("no access"))
        : Promise.resolve([issue(1, "Visible issue")]),
    );

    renderWithProviders(<RegistryIssues token="t" repos={REPOS} />);

    expect(
      await screen.findByRole("link", { name: /visible issue/i }),
    ).toBeInTheDocument();
    // The errored repo is skipped, not surfaced as a loud failure.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /beta\/two/i })).toBeNull();
    await waitFor(() =>
      expect(screen.getByText(/skipped 1 repo/i)).toBeInTheDocument(),
    );
  });

  it("does not count a rate-limited repo as skipped/inaccessible", async () => {
    fetchOpenIssues.mockImplementation((_token: string, repo?: RepoRef) => {
      if (repo?.repo === "two")
        return Promise.reject(new GitHubAuthError("no access"));
      if (repo?.repo === "three")
        return Promise.reject(new GitHubRateLimitError("throttled"));
      return Promise.resolve([issue(1, "Visible issue")]);
    });

    renderWithProviders(
      <RegistryIssues
        token="t"
        repos={[...REPOS, { owner: "gamma", repo: "three" }]}
      />,
    );

    expect(
      await screen.findByRole("link", { name: /visible issue/i }),
    ).toBeInTheDocument();
    // Throttled ≠ inaccessible — only the auth-failed repo reads as skipped.
    await waitFor(() =>
      expect(screen.getByText(/skipped 1 repo\b/i)).toBeInTheDocument(),
    );
  });

  it("badges issues with canonical roles from each repo's Mapping", async () => {
    const { defaultTriageMapping } = await vi.importActual<
      typeof import("../triage/mapping.ts")
    >("../triage/mapping.ts");
    fetchOpenIssues.mockResolvedValue([
      {
        ...issue(1, "Roled issue"),
        labels: [{ name: "ready-for-agent", color: "1b998b" }],
      },
    ]);
    fetchTriageMapping.mockResolvedValue(defaultTriageMapping());

    renderWithProviders(
      <RegistryIssues token="t" repos={[{ owner: "alpha", repo: "one" }]} />,
    );

    expect(await screen.findAllByText("ready-for-agent")).not.toHaveLength(0);
  });

  it("shows a calm empty state for a repo with no open issues", async () => {
    fetchOpenIssues.mockResolvedValue([]);
    renderWithProviders(
      <RegistryIssues token="t" repos={[{ owner: "alpha", repo: "one" }]} />,
    );
    expect(await screen.findByText(/all calm/i)).toBeInTheDocument();
  });
});
