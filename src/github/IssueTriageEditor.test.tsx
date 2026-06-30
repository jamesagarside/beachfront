import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/render.tsx";
import { IssueTriageEditor } from "./IssueTriageEditor.tsx";
import type { Issue } from "./issues.ts";
import { defaultTriageMapping } from "../triage/mapping.ts";

const addLabels = vi.fn();
const removeLabel = vi.fn();
const createComment = vi.fn();

vi.mock("octokit", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      issues: { addLabels, removeLabel, createComment },
    },
  })),
}));

const REPO = { owner: "acme", repo: "gadgets" };
const mapping = defaultTriageMapping();

const issue: Issue = {
  number: 7,
  title: "Wire up the thing",
  url: "https://github.com/acme/gadgets/issues/7",
  labels: [
    { name: "enhancement", color: "" },
    { name: "needs-triage", color: "" },
  ],
  createdAt: "2026-06-01T00:00:00Z",
  comments: 0,
};

describe("IssueTriageEditor", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.clearAllMocks());

  it("shows an Edit-on-GitHub deep link for a read-only token", () => {
    renderWithProviders(
      <IssueTriageEditor
        token="ro"
        repo={REPO}
        issue={issue}
        mapping={mapping}
        canWrite={false}
      />,
    );

    const link = screen.getByRole("link", { name: /edit on github/i });
    expect(link).toHaveAttribute("href", issue.url);
    // No editing controls in read-only mode.
    expect(
      screen.queryByRole("button", { name: /set role/i }),
    ).not.toBeInTheDocument();
  });

  it("changes the triage state role via the mapped labels", async () => {
    addLabels.mockResolvedValue({});
    removeLabel.mockResolvedValue({});

    renderWithProviders(
      <IssueTriageEditor
        token="tok"
        repo={REPO}
        issue={issue}
        mapping={mapping}
        canWrite={true}
      />,
    );

    fireEvent.change(screen.getByLabelText(/triage role/i), {
      target: { value: "ready-for-agent" },
    });
    fireEvent.click(screen.getByRole("button", { name: /set role/i }));

    expect(await screen.findByText(/ready-for-agent/i)).toBeInTheDocument();
    expect(removeLabel).toHaveBeenCalledWith(
      expect.objectContaining({ name: "needs-triage" }),
    );
    expect(addLabels).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ["ready-for-agent"] }),
    );
  });

  it("posts a comment from the UI", async () => {
    createComment.mockResolvedValue({
      data: { html_url: "https://github.com/acme/gadgets/issues/7#c1" },
    });

    renderWithProviders(
      <IssueTriageEditor
        token="tok"
        repo={REPO}
        issue={issue}
        mapping={mapping}
        canWrite={true}
      />,
    );

    fireEvent.change(screen.getByLabelText(/comment/i), {
      target: { value: "On it." },
    });
    fireEvent.click(screen.getByRole("button", { name: /comment/i }));

    expect(await screen.findByText(/comment posted/i)).toBeInTheDocument();
    expect(createComment).toHaveBeenCalledWith(
      expect.objectContaining({ body: "On it." }),
    );
  });

  it("surfaces a write-scope failure calmly", async () => {
    removeLabel.mockRejectedValue({ status: 403 });
    addLabels.mockRejectedValue({ status: 403 });

    renderWithProviders(
      <IssueTriageEditor
        token="tok"
        repo={REPO}
        issue={issue}
        mapping={mapping}
        canWrite={true}
      />,
    );

    fireEvent.change(screen.getByLabelText(/triage role/i), {
      target: { value: "wontfix" },
    });
    fireEvent.click(screen.getByRole("button", { name: /set role/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /can't write|write.*scope/i,
    );
  });
});
