import { render, screen, within } from "@testing-library/react";
import { SHORELINE, type Route } from "../routing/route.ts";
import { Shell } from "./Shell.tsx";

const repos = [
  { owner: "jamesagarside", repo: "beachfront" },
  { owner: "acme", repo: "widgets" },
];

describe("Shell", () => {
  it("renders the wordmark, the Shoreline link, and a nav item per repo", () => {
    render(
      <Shell route={SHORELINE} repos={repos}>
        <p>content</p>
      </Shell>,
    );

    expect(
      screen.getByRole("heading", { name: /beachfront/i }),
    ).toBeInTheDocument();

    const shoreline = screen.getByRole("link", { name: /shoreline/i });
    expect(shoreline).toHaveAttribute("href", "#/");

    expect(screen.getByRole("link", { name: /beachfront/i })).toHaveAttribute(
      "href",
      "#/repo/jamesagarside/beachfront",
    );
    expect(screen.getByRole("link", { name: /widgets/i })).toHaveAttribute(
      "href",
      "#/repo/acme/widgets",
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("marks the Shoreline active on the home route", () => {
    render(
      <Shell route={SHORELINE} repos={repos}>
        <p />
      </Shell>,
    );
    expect(screen.getByRole("link", { name: /shoreline/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // No repo is current on the home route.
    expect(screen.getByRole("link", { name: /widgets/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks the open repo active on a per-repo route", () => {
    const route: Route = { kind: "repo", owner: "acme", repo: "widgets" };
    render(
      <Shell route={route} repos={repos}>
        <p />
      </Shell>,
    );
    expect(screen.getByRole("link", { name: /widgets/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /shoreline/i }),
    ).not.toHaveAttribute("aria-current");
  });

  it("handles an empty Registry calmly", () => {
    render(
      <Shell route={SHORELINE} repos={[]}>
        <p />
      </Shell>,
    );
    const nav = screen.getByRole("navigation", { name: /beachfront views/i });
    expect(within(nav).getByText(/none linked yet/i)).toBeInTheDocument();
  });
});
