import { render, screen } from "@testing-library/react";
import { StatusCounts } from "./StatusCounts.tsx";
import { defaultTriageMapping } from "../triage/mapping.ts";
import type { Issue } from "../github/issues.ts";

const mapping = defaultTriageMapping();

function issue(number: number, labelNames: string[]): Issue {
  return {
    number,
    title: `Issue ${number}`,
    url: `https://example.test/${number}`,
    labels: labelNames.map((name) => ({ name, color: "" })),
    createdAt: "2026-01-01T00:00:00Z",
    comments: 0,
  };
}

describe("StatusCounts", () => {
  it("summarises the non-zero counts on one line", () => {
    render(
      <StatusCounts
        issues={[
          issue(1, ["ready-for-agent"]),
          issue(2, ["ready-for-agent"]),
          issue(3, ["needs-triage"]),
        ]}
        mapping={mapping}
      />,
    );
    expect(screen.getByText(/2 ready for agent/)).toBeTruthy();
    expect(screen.getByText(/1 needs triage/)).toBeTruthy();
  });

  it("omits zero-count roles from the line", () => {
    render(
      <StatusCounts issues={[issue(1, ["ready-for-agent"])]} mapping={mapping} />,
    );
    expect(screen.getByText(/1 ready for agent/)).toBeTruthy();
    expect(screen.queryByText(/needs triage/)).toBeNull();
    expect(screen.queryByText(/untriaged/)).toBeNull();
    expect(screen.queryByText(/ready for human/)).toBeNull();
  });

  it("counts unlabelled issues as untriaged", () => {
    render(<StatusCounts issues={[issue(1, [])]} mapping={mapping} />);
    expect(screen.getByText(/1 untriaged/)).toBeTruthy();
  });

  it("shows a calm fallback when nothing is counted", () => {
    render(<StatusCounts issues={[issue(1, ["bug"])]} mapping={mapping} />);
    expect(screen.getByText("all calm")).toBeTruthy();
  });

  it("shows 'no open issues' when there are none", () => {
    render(<StatusCounts issues={[]} mapping={mapping} />);
    expect(screen.getByText("no open issues")).toBeTruthy();
  });
});
