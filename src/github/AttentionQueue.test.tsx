import { screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { renderWithProviders } from "../test/render.tsx";
import { AttentionQueue } from "./AttentionQueue.tsx";
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

function issue(
  number: number,
  title: string,
  labels: string[],
  comments = 0,
) {
  return {
    number,
    title,
    url: `https://github.com/o/r/issues/${number}`,
    createdAt: "2026-06-01T00:00:00Z",
    labels: labels.map((name) => ({ name, color: "" })),
    comments,
  };
}

describe("AttentionQueue", () => {
  beforeEach(async () => {
    fetchOpenIssues.mockReset();
    fetchTriageMapping.mockReset();
    const { defaultTriageMapping } = await vi.importActual<
      typeof import("../triage/mapping.ts")
    >("../triage/mapping.ts");
    fetchTriageMapping.mockResolvedValue(defaultTriageMapping());
  });

  it("renders the three buckets across repos, oldest-first, with the issue's repo", async () => {
    fetchOpenIssues.mockImplementation((_t: string, repo?: RepoRef) =>
      repo?.repo === "two"
        ? Promise.resolve([issue(20, "Needs info reply", ["needs-info"], 2)])
        : Promise.resolve([
            issue(10, "No labels here", []),
            issue(11, "Awaiting decision", ["needs-triage"]),
          ]),
    );

    renderWithProviders(<AttentionQueue token="t" repos={REPOS} />);

    const untriaged = await screen.findByRole("region", {
      name: /untriaged/i,
    });
    expect(
      within(untriaged).getByRole("link", { name: /no labels here/i }),
    ).toBeInTheDocument();
    expect(within(untriaged).getByText(/alpha\/one/i)).toBeInTheDocument();

    const needsTriage = screen.getByRole("region", { name: /needs triage/i });
    expect(
      within(needsTriage).getByRole("link", { name: /awaiting decision/i }),
    ).toBeInTheDocument();

    const needsInfo = screen.getByRole("region", { name: /needs info/i });
    expect(
      within(needsInfo).getByRole("link", { name: /needs info reply/i }),
    ).toBeInTheDocument();
  });

  it("shows a count per bucket", async () => {
    fetchOpenIssues.mockResolvedValue([
      issue(1, "One", []),
      issue(2, "Two", []),
    ]);

    renderWithProviders(
      <AttentionQueue token="t" repos={[{ owner: "alpha", repo: "one" }]} />,
    );

    const untriaged = await screen.findByRole("region", { name: /untriaged/i });
    expect(within(untriaged).getByText("2")).toBeInTheDocument();
  });

  it("omits a needs-info issue with no reporter activity", async () => {
    fetchOpenIssues.mockResolvedValue([
      issue(1, "Silent needs-info", ["needs-info"], 0),
      // A second, queued issue keeps the buckets rendered.
      issue(2, "Untriaged thing", []),
    ]);

    renderWithProviders(
      <AttentionQueue token="t" repos={[{ owner: "alpha", repo: "one" }]} />,
    );

    await screen.findByRole("region", { name: /untriaged/i });
    expect(
      screen.queryByRole("link", { name: /silent needs-info/i }),
    ).toBeNull();
  });

  it("calmly states when nothing needs a human", async () => {
    fetchOpenIssues.mockResolvedValue([
      issue(1, "Handled", ["ready-for-agent"]),
    ]);

    renderWithProviders(
      <AttentionQueue token="t" repos={[{ owner: "alpha", repo: "one" }]} />,
    );

    expect(await screen.findByText(/nothing needs a human/i)).toBeInTheDocument();
  });
});
