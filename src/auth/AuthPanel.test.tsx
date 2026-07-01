import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { renderWithProviders } from "../test/render.tsx";
import { AuthPanel } from "./AuthPanel.tsx";
import * as nav from "./browserNav.ts";

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

describe("AuthPanel — Login with GitHub (#25)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    window.history.pushState({}, "", "/");
  });

  function configureOAuth() {
    vi.stubEnv("VITE_BEACHFRONT_OAUTH_WORKER_URL", "https://worker.example/");
    vi.stubEnv("VITE_BEACHFRONT_OAUTH_CLIENT_ID", "Iv1.abc");
  }

  it("offers only PAT mode when no Worker is configured", () => {
    vi.stubEnv("VITE_BEACHFRONT_OAUTH_WORKER_URL", "");
    vi.stubEnv("VITE_BEACHFRONT_OAUTH_CLIENT_ID", "");
    render(<AuthPanel />);
    expect(
      screen.queryByRole("button", { name: /login with github/i }),
    ).toBeNull();
  });

  it("shows the button and redirects to GitHub with a stashed state on click", () => {
    configureOAuth();
    const redirect = vi.spyOn(nav, "redirect").mockImplementation(() => {});

    render(<AuthPanel />);
    fireEvent.click(screen.getByRole("button", { name: /login with github/i }));

    expect(redirect).toHaveBeenCalledOnce();
    const url = new URL(redirect.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("Iv1.abc");
    const state = url.searchParams.get("state");
    expect(state).toBeTruthy();
    expect(sessionStorage.getItem("beachfront.oauth.state")).toBe(state);
  });

  it("completes a callback: exchanges the code and signs in like PAT mode", async () => {
    configureOAuth();
    sessionStorage.setItem("beachfront.oauth.state", "st-1");
    window.history.pushState({}, "", "/?code=the-code&state=st-1");
    vi.spyOn(nav, "replaceUrl").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.startsWith("https://worker.example")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: "gho_tok" }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ login: "octocat", avatar_url: "a.png", name: "Octo" }),
        };
      }),
    );

    render(<AuthPanel />);

    expect(await screen.findByText(/signed in as/i)).toBeInTheDocument();
    expect(screen.getByText("octocat")).toBeInTheDocument();
    expect(localStorage.getItem("beachfront.token")).toBe("gho_tok");
  });

  it("surfaces an error and does not sign in when the callback state is forged", async () => {
    configureOAuth();
    sessionStorage.setItem("beachfront.oauth.state", "real-state");
    window.history.pushState({}, "", "/?code=the-code&state=attacker");
    vi.spyOn(nav, "replaceUrl").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthPanel />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not be verified/i,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("beachfront.token")).toBeNull();
  });
});
