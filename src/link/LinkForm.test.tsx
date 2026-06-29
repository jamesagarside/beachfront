import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/render.tsx";
import { LinkForm } from "./LinkForm.tsx";
import type { RegistryRepo } from "../registry/registry.ts";

const reposGet = vi.fn();
const getRef = vi.fn();
const createRef = vi.fn();
const createOrUpdateFileContents = vi.fn();
const pullsCreate = vi.fn();

vi.mock("octokit", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      repos: { get: reposGet, createOrUpdateFileContents },
      git: { getRef, createRef },
      pulls: { create: pullsCreate },
    },
  })),
}));

const linked: RegistryRepo[] = [{ owner: "acme", repo: "widgets" }];
const INSTANCE = { owner: "jamesagarside", repo: "beachfront" };

describe("LinkForm", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.clearAllMocks());

  it("validates access and confirms a linkable repo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => ({}) }),
    );

    renderWithProviders(
      <LinkForm token="tok" repos={linked} linkedBy="octocat" />,
    );
    fireEvent.change(screen.getByLabelText(/owner\/repo/i), {
      target: { value: "acme/gadgets" },
    });
    fireEvent.click(screen.getByRole("button", { name: /validate/i }));

    expect(await screen.findByText(/ready to link/i)).toHaveTextContent(
      /acme\/gadgets/,
    );
  });

  it("disallows a repo that is already linked", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: () => ({}) });
    vi.stubGlobal("fetch", fetchSpy);

    renderWithProviders(
      <LinkForm token="tok" repos={linked} linkedBy="octocat" />,
    );
    fireEvent.change(screen.getByLabelText(/owner\/repo/i), {
      target: { value: "acme/widgets" },
    });
    fireEvent.click(screen.getByRole("button", { name: /validate/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /already linked/i,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows a clear error when the token can't access the repo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => ({}) }),
    );

    renderWithProviders(
      <LinkForm token="tok" repos={linked} linkedBy="octocat" />,
    );
    fireEvent.change(screen.getByLabelText(/owner\/repo/i), {
      target: { value: "acme/secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /validate/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /can't access it|can't find/i,
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/owner\/repo/i)).toBeInTheDocument(),
    );
  });

  it("opens the linking PR and links the Viewer to it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => ({}) }),
    );
    reposGet.mockResolvedValue({ data: { default_branch: "main" } });
    getRef.mockResolvedValue({ data: { object: { sha: "basesha" } } });
    createRef.mockResolvedValue({});
    createOrUpdateFileContents.mockResolvedValue({});
    pullsCreate.mockResolvedValue({
      data: { html_url: "https://github.com/jamesagarside/beachfront/pull/99" },
    });

    renderWithProviders(
      <LinkForm
        token="tok"
        repos={linked}
        linkedBy="octocat"
        instance={INSTANCE}
      />,
    );
    fireEvent.change(screen.getByLabelText(/owner\/repo/i), {
      target: { value: "acme/gadgets" },
    });
    fireEvent.click(screen.getByRole("button", { name: /validate/i }));
    fireEvent.click(await screen.findByRole("button", { name: /link/i }));

    const link = await screen.findByRole("link", { name: /pull request/i });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/jamesagarside/beachfront/pull/99",
    );
  });

  it("shows a write-scope message when the token can't open a PR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => ({}) }),
    );
    reposGet.mockResolvedValue({ data: { default_branch: "main" } });
    getRef.mockResolvedValue({ data: { object: { sha: "basesha" } } });
    createRef.mockRejectedValue({ status: 403 });

    renderWithProviders(
      <LinkForm
        token="readonly"
        repos={linked}
        linkedBy="octocat"
        instance={INSTANCE}
      />,
    );
    fireEvent.change(screen.getByLabelText(/owner\/repo/i), {
      target: { value: "acme/gadgets" },
    });
    fireEvent.click(screen.getByRole("button", { name: /validate/i }));
    fireEvent.click(await screen.findByRole("button", { name: /link/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /write.*scope|needs a token with write/i,
    );
  });
});
