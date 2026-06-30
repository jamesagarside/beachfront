import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/render.tsx";
import { RepoView } from "./RepoView.tsx";
import type { RegistryRepo } from "../registry/registry.ts";

const REPOS: RegistryRepo[] = [{ owner: "alpha", repo: "one" }];

describe("RepoView", () => {
  it("renders the per-repo deck for a Managed repo resolved from the Registry", () => {
    renderWithProviders(<RepoView owner="alpha" repo="one" repos={REPOS} />);

    expect(
      screen.getByRole("region", { name: "alpha/one" }),
    ).toBeInTheDocument();
    expect(screen.getByText("alpha/one")).toBeInTheDocument();
  });

  it("shows an honest fallback with a route home for an unmanaged repo", () => {
    renderWithProviders(<RepoView owner="ghost" repo="repo" repos={REPOS} />);

    expect(
      screen.getByRole("region", { name: /unknown repo/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to the shore/i }),
    ).toHaveAttribute("href", "#/");
  });
});
