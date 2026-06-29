import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { renderWithProviders } from "../test/render.tsx";
import { AuthPanel } from "./AuthPanel.tsx";

const render = (ui: ReactElement) => renderWithProviders(ui);

describe("AuthPanel", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("shows the token entry and a generate-token link when anonymous", () => {
    render(<AuthPanel />);
    expect(screen.getByLabelText(/paste a github token/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /generate a token/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("github.com/settings"),
    );
  });

  it("confirms identity and shows the login after signing in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => ({ login: "octocat", avatar_url: "a.png", name: "Octo" }),
      }),
    );

    render(<AuthPanel />);
    fireEvent.change(screen.getByLabelText(/paste a github token/i), {
      target: { value: "github_pat_good" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/signed in as/i)).toBeInTheDocument();
    expect(screen.getByText("octocat")).toBeInTheDocument();
    expect(localStorage.getItem("beachfront.token")).toBe("github_pat_good");
  });

  it("surfaces an error and keeps the form when the token is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => ({}) }),
    );

    render(<AuthPanel />);
    fireEvent.change(screen.getByLabelText(/paste a github token/i), {
      target: { value: "bad" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/rejected/i);
  });

  it("signs out and clears the cached token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => ({ login: "octocat", avatar_url: "a.png", name: null }),
      }),
    );

    render(<AuthPanel />);
    fireEvent.change(screen.getByLabelText(/paste a github token/i), {
      target: { value: "github_pat_good" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await screen.findByText(/signed in as/i);

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() =>
      expect(screen.getByLabelText(/paste a github token/i)).toBeInTheDocument(),
    );
    expect(localStorage.getItem("beachfront.token")).toBeNull();
  });
});
