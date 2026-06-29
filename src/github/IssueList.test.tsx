import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { renderWithProviders } from "../test/render.tsx";
import { formatAge, IssueList, IssueRow } from "./IssueList.tsx";
import { GitHubAuthError } from "./issues.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";

const fetchOpenIssues = vi.fn();
vi.mock("./issues.ts", async () => {
  const actual = await vi.importActual<typeof import("./issues.ts")>(
    "./issues.ts",
  );
  return { ...actual, fetchOpenIssues: (...a: unknown[]) => fetchOpenIssues(...a) };
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

const REPO = { owner: "jamesagarside", repo: "beachfront" };

function makeIssue(labels: string[]) {
  return {
    number: 7,
    title: "Classify issues",
    url: "https://github.com/o/r/issues/7",
    createdAt: "2026-06-01T00:00:00Z",
    labels: labels.map((name) => ({ name, color: "1b998b" })),
  };
}

beforeEach(() => {
  fetchTriageMapping.mockResolvedValue(null);
});

describe("IssueList", () => {
  it("renders each issue's number, title, label and age", async () => {
    fetchOpenIssues.mockResolvedValue([
      {
        number: 7,
        title: "Classify issues",
        url: "https://github.com/o/r/issues/7",
        createdAt: "2026-06-01T00:00:00Z",
        labels: [{ name: "enhancement", color: "1b998b" }],
      },
    ]);

    renderWithProviders(<IssueList token="t" repo={REPO} />);

    const link = await screen.findByRole("link", { name: /classify issues/i });
    expect(link).toHaveAttribute("href", "https://github.com/o/r/issues/7");
    expect(screen.getByText("#7")).toBeInTheDocument();
    expect(screen.getByText("enhancement")).toBeInTheDocument();
    expect(screen.getByText(/opened/i)).toBeInTheDocument();
  });

  it("shows a calm empty state when there are no open issues", async () => {
    fetchOpenIssues.mockResolvedValue([]);
    renderWithProviders(<IssueList token="t" repo={REPO} />);
    expect(await screen.findByText(/all calm/i)).toBeInTheDocument();
  });

  it("surfaces a rejected token clearly", async () => {
    fetchOpenIssues.mockRejectedValue(new GitHubAuthError("token rejected"));
    renderWithProviders(<IssueList token="bad" repo={REPO} />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/token rejected/i),
    );
  });
});

describe("IssueRow role badges", () => {
  const mapping = defaultTriageMapping();

  it("shows the canonical category and state roles when a Mapping is known", () => {
    render(<IssueRow issue={makeIssue(["bug", "ready-for-agent"])} mapping={mapping} />);
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("ready-for-agent")).toBeInTheDocument();
  });

  it("flags an untriaged issue (no recognized triage label)", () => {
    render(<IssueRow issue={makeIssue(["documentation"])} mapping={mapping} />);
    expect(screen.getByText(/untriaged/i)).toBeInTheDocument();
  });

  it("flags an issue whose labels resolve to conflicting roles", () => {
    render(
      <IssueRow
        issue={makeIssue(["ready-for-agent", "needs-triage"])}
        mapping={mapping}
      />,
    );
    expect(screen.getByText(/conflicting roles/i)).toBeInTheDocument();
  });

  it("falls back to raw labels when the repo has no Mapping", () => {
    render(<IssueRow issue={makeIssue(["enhancement"])} mapping={null} />);
    expect(screen.getByText("enhancement")).toBeInTheDocument();
    expect(screen.queryByText(/untriaged/i)).not.toBeInTheDocument();
  });
});

describe("IssueList classification", () => {
  it("badges issues with their canonical roles from the repo's Mapping", async () => {
    fetchOpenIssues.mockResolvedValue([makeIssue(["bug", "ready-for-agent"])]);
    fetchTriageMapping.mockResolvedValue(defaultTriageMapping());

    renderWithProviders(<IssueList token="t" repo={REPO} />);

    expect(await screen.findByText("ready-for-agent")).toBeInTheDocument();
    expect(screen.getByText("bug")).toBeInTheDocument();
  });
});

describe("formatAge", () => {
  const now = new Date("2026-06-29T00:00:00Z");
  it("reports recent ages", () => {
    expect(formatAge("2026-06-29T00:00:00Z", now)).toBe("today");
    expect(formatAge("2026-06-28T00:00:00Z", now)).toBe("yesterday");
    expect(formatAge("2026-06-24T00:00:00Z", now)).toBe("5 days ago");
  });
  it("reports months and years", () => {
    expect(formatAge("2026-04-01T00:00:00Z", now)).toBe("2 months ago");
    expect(formatAge("2024-06-01T00:00:00Z", now)).toBe("2 years ago");
  });
});
