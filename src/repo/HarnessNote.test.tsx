import { render, screen } from "@testing-library/react";
import type { HarnessDrift } from "../core/harnessDrift.ts";
import { HarnessNote } from "./HarnessNote.tsx";

/**
 * HarnessNote is a pure presentational element — no providers needed. It pins
 * the deck's drift contract (#115): silent when current, coral with the exact
 * fix when behind, quiet driftwood when the vintage is unknown.
 */
describe("HarnessNote", () => {
  it("renders nothing when the harness is current — the deck stays calm", () => {
    const drift: HarnessDrift = {
      state: "current",
      installed: "cur1234",
      current: "cur1234",
      fix: null,
    };
    const { container } = render(<HarnessNote drift={drift} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows coral 'behind' with the exact beachfront-update.sh fix", () => {
    const drift: HarnessDrift = {
      state: "behind",
      installed: "old9999",
      current: "cur1234",
      fix: "scripts/beachfront-update.sh acme/widgets",
    };
    render(<HarnessNote drift={drift} />);
    expect(screen.getByText(/harness behind/i)).toBeInTheDocument();
    expect(
      screen.getByText("scripts/beachfront-update.sh acme/widgets"),
    ).toBeInTheDocument();
  });

  it("notes an unknown vintage in driftwood, without pushing a fix", () => {
    const drift: HarnessDrift = {
      state: "unknown",
      installed: null,
      current: "cur1234",
      fix: null,
    };
    render(<HarnessNote drift={drift} />);
    expect(screen.getByText(/vintage unknown/i)).toBeInTheDocument();
    expect(screen.queryByText(/beachfront-update\.sh/)).not.toBeInTheDocument();
  });
});
