import { render, screen } from "@testing-library/react";
import { ShoreCard } from "./ShoreCard.tsx";
import type { RepoHealth } from "./shoreSummary.ts";

/**
 * ShoreCard is a pure presentational link — no providers needed. These tests
 * pin the load-bearing contract: it renders the slug, the whole card is the
 * internal hash deep-link into the repo's deck, and the three signals show as
 * specified — crucially the coral "needs you" figure appears ONLY when
 * attention is non-zero, because coral's scarcity is the brand's whole point.
 */
function health(over: Partial<RepoHealth> = {}): RepoHealth {
  return {
    repo: { owner: "alpha", repo: "one" },
    openIssues: 3,
    attention: 1,
    running: 2,
    harness: { state: "current", installed: "cur1234", current: "cur1234", fix: null },
    ...over,
  };
}

describe("ShoreCard", () => {
  it("renders the owner/repo slug", () => {
    render(<ShoreCard health={health()} />);
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("alpha/")).toBeInTheDocument();
  });

  it("links the whole card to the repo's internal hash deep-link", () => {
    render(<ShoreCard health={health()} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("#/repo/alpha/one");
    // Internal SPA navigation — must not open a new tab.
    expect(link).not.toHaveAttribute("target", "_blank");
  });

  it("shows the open-issue count", () => {
    render(<ShoreCard health={health({ openIssues: 7 })} />);
    expect(screen.getByText("7 open")).toBeInTheDocument();
  });

  it("shows the coral 'needs you' figure when attention > 0", () => {
    render(<ShoreCard health={health({ attention: 4 })} />);
    const needs = screen.getByText("4 need you");
    expect(needs).toBeInTheDocument();
    expect(needs.className).toContain("text-coral");
  });

  it("omits the 'needs you' figure entirely when attention is 0", () => {
    render(<ShoreCard health={health({ attention: 0 })} />);
    expect(screen.queryByText(/need you/)).not.toBeInTheDocument();
  });

  it("shows running agents in tide-teal when running > 0", () => {
    render(<ShoreCard health={health({ running: 2 })} />);
    const agents = screen.getByText("2 agents running");
    expect(agents).toBeInTheDocument();
    expect(agents.className).toContain("text-tide-teal");
  });

  it("reads idle driftwood for running agents when none are in flight", () => {
    render(<ShoreCard health={health({ running: 0 })} />);
    const agents = screen.getByText("0 agents running");
    expect(agents.className).toContain("text-driftwood");
  });

  it("flags a behind harness in coral, with the fix as its tooltip (#115)", () => {
    render(
      <ShoreCard
        health={health({
          harness: {
            state: "behind",
            installed: "old9999",
            current: "cur1234",
            fix: "scripts/beachfront-update.sh alpha/one",
          },
        })}
      />,
    );
    const note = screen.getByText("harness behind");
    expect(note.className).toContain("text-coral");
    expect(note).toHaveAttribute(
      "title",
      "Update with: scripts/beachfront-update.sh alpha/one",
    );
  });

  it("notes an unknown vintage in quiet driftwood, no fix (older onboard)", () => {
    render(
      <ShoreCard
        health={health({
          harness: { state: "unknown", installed: null, current: "cur1234", fix: null },
        })}
      />,
    );
    const note = screen.getByText("harness vintage unknown");
    expect(note.className).toContain("text-driftwood");
  });

  it("says nothing about the harness when the repo is current — stays calm", () => {
    render(<ShoreCard health={health()} />);
    expect(screen.queryByText(/harness/)).not.toBeInTheDocument();
  });
});
