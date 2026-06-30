import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "../test/render.tsx";
import { NavFrame } from "./NavFrame.tsx";
import type { Viewer } from "../auth/identity.ts";
import type { RegistryRepo } from "../registry/registry.ts";

const VIEWER: Viewer = { login: "lookout", avatarUrl: "", name: "Lookout" };
const REPOS: RegistryRepo[] = [
  { owner: "alpha", repo: "one" },
  { owner: "beta", repo: "two" },
];

describe("NavFrame", () => {
  it("lists the Shoreline and every Managed repo, and renders the routed child", () => {
    renderWithProviders(
      <NavFrame repos={REPOS} route={{ name: "shoreline" }} viewer={VIEWER}>
        <div>routed view</div>
      </NavFrame>,
    );

    expect(
      screen.getByRole("link", { name: /shoreline/i }),
    ).toBeInTheDocument();
    const repos = screen.getByRole("navigation", { name: /managed repos/i });
    expect(
      within(repos).getByRole("link", { name: "alpha/one" }),
    ).toHaveAttribute("href", "#/repo/alpha/one");
    expect(
      within(repos).getByRole("link", { name: "beta/two" }),
    ).toHaveAttribute("href", "#/repo/beta/two");
    expect(screen.getByText("routed view")).toBeInTheDocument();
  });

  it("marks the active repo as the current page", () => {
    renderWithProviders(
      <NavFrame
        repos={REPOS}
        route={{ name: "repo", owner: "beta", repo: "two" }}
        viewer={VIEWER}
      >
        <div />
      </NavFrame>,
    );

    expect(
      screen.getByRole("link", { name: "beta/two" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "alpha/one" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("calms the sidebar when no repos are linked", () => {
    renderWithProviders(
      <NavFrame repos={[]} route={{ name: "shoreline" }} viewer={VIEWER}>
        <div />
      </NavFrame>,
    );

    expect(screen.getByText(/no repos linked yet/i)).toBeInTheDocument();
  });
});
