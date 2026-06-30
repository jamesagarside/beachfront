import { render, screen } from "@testing-library/react";
import { KanbanBoard } from "./KanbanBoard.tsx";
import { defaultTriageMapping } from "../triage/mapping.ts";
import type { Issue } from "../github/issues.ts";

const mapping = defaultTriageMapping();

function issue(number: number, title: string, labels: string[]): Issue {
  return {
    number,
    title,
    url: `https://github.com/acme/widgets/issues/${number}`,
    labels: labels.map((name) => ({ name, color: "" })),
    createdAt: "2026-06-01T00:00:00Z",
    comments: 0,
  };
}

describe("KanbanBoard", () => {
  it("renders a heading for each canonical column", () => {
    render(<KanbanBoard issues={[]} mapping={mapping} />);
    expect(
      screen.getByRole("heading", { name: "untriaged" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "ready for agent" }),
    ).toBeInTheDocument();
  });

  it("links a card to the issue url showing number and title", () => {
    render(
      <KanbanBoard
        issues={[issue(42, "Fix the leak", ["ready-for-agent"])]}
        mapping={mapping}
      />,
    );
    const link = screen.getByRole("link", { name: /#42 Fix the leak/ });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/acme/widgets/issues/42",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows a calm placeholder for empty columns", () => {
    render(<KanbanBoard issues={[]} mapping={mapping} />);
    expect(screen.getAllByText("none").length).toBeGreaterThan(0);
  });

  it("groups issues into the untriaged and state columns", () => {
    render(
      <KanbanBoard
        issues={[
          issue(1, "Needs a look", ["documentation"]),
          issue(2, "Ready to go", ["ready-for-agent"]),
        ]}
        mapping={mapping}
      />,
    );
    expect(
      screen.getByRole("link", { name: /#1 Needs a look/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /#2 Ready to go/ }),
    ).toBeInTheDocument();
  });
});
