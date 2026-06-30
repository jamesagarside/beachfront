import { act } from "react";
import { screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { renderWithProviders } from "../test/render.tsx";
import { Shell } from "./Shell.tsx";
import { repoHash } from "../routing/route.ts";
import type { Viewer } from "../auth/identity.ts";
import type { RegistryRepo } from "../registry/registry.ts";

// The Shoreline composes data panes that fetch over the network; the shell test
// only cares that routing swaps it for the per-repo view, so stub it out.
vi.mock("./Shoreline.tsx", () => ({
  Shoreline: () => <div>shoreline-home</div>,
}));

const VIEWER: Viewer = { login: "lookout", avatarUrl: "", name: "Lookout" };
const REPOS: RegistryRepo[] = [
  { owner: "alpha", repo: "one" },
  { owner: "beta", repo: "two" },
];

function navigate(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new Event("hashchange"));
  });
}

describe("Shell navigation", () => {
  beforeEach(() => {
    window.location.hash = "#/";
  });

  it("renders the Shoreline home at the root route", () => {
    renderWithProviders(<Shell token="t" viewer={VIEWER} repos={REPOS} />);

    expect(screen.getByText("shoreline-home")).toBeInTheDocument();
    // The persistent frame is present and offers a way to each repo.
    const nav = screen.getByRole("navigation", { name: /managed repos/i });
    expect(
      within(nav).getByRole("link", { name: "alpha/one" }),
    ).toBeInTheDocument();
  });

  it("navigates from the shore to a per-repo route and back", () => {
    renderWithProviders(<Shell token="t" viewer={VIEWER} repos={REPOS} />);

    expect(screen.getByText("shoreline-home")).toBeInTheDocument();

    navigate(repoHash("beta", "two"));

    // The per-repo view has replaced the Shoreline...
    expect(
      screen.getByRole("region", { name: "beta/two" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("shoreline-home")).not.toBeInTheDocument();
    // ...while the persistent frame stays put.
    expect(
      screen.getByRole("navigation", { name: /managed repos/i }),
    ).toBeInTheDocument();

    navigate("#/");

    expect(screen.getByText("shoreline-home")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "beta/two" })).toBeNull();
  });

  it("falls back to a calm honest state for an unknown repo deep-link", () => {
    window.location.hash = repoHash("ghost", "repo");
    renderWithProviders(<Shell token="t" viewer={VIEWER} repos={REPOS} />);

    expect(
      screen.getByRole("region", { name: /unknown repo/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/off the map/i)).toBeInTheDocument();
  });
});
