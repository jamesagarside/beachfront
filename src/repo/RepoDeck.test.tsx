import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/render.tsx";
import { RepoDeck } from "./RepoDeck.tsx";

describe("RepoDeck", () => {
  it("renders the repo's slug heading", () => {
    // token=null keeps the per-repo queries idle; this checks the deck resolves
    // and titles the repo without hitting the network.
    renderWithProviders(
      <RepoDeck token={null} repo={{ owner: "acme", repo: "widgets" }} />,
    );

    const heading = screen.getByRole("heading", { name: /acme\/\s*widgets/i });
    expect(heading).toBeInTheDocument();
  });
});
