import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/render.tsx";
import { LinkForm } from "./LinkForm.tsx";
import type { RegistryRepo } from "../registry/registry.ts";

const linked: RegistryRepo[] = [{ owner: "acme", repo: "widgets" }];

describe("LinkForm", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("validates access and confirms a linkable repo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => ({}) }),
    );

    renderWithProviders(<LinkForm token="tok" repos={linked} />);
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

    renderWithProviders(<LinkForm token="tok" repos={linked} />);
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

    renderWithProviders(<LinkForm token="tok" repos={linked} />);
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
});
