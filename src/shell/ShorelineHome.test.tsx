import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "../test/render.tsx";
import { ShorelineHome } from "./ShorelineHome.tsx";

describe("ShorelineHome", () => {
  it("renders the Shoreline header and a calm empty shore when nothing is linked", () => {
    // token=null keeps the cross-repo queries idle, so this exercises the
    // structure and the empty-Registry state without any network.
    renderWithProviders(<ShorelineHome token={null} repos={[]} />);

    expect(
      screen.getByRole("heading", { name: /shoreline/i }),
    ).toBeInTheDocument();

    const shore = screen.getByRole("region", { name: /^the shore$/i });
    expect(within(shore).getByText(/no repos linked yet/i)).toBeInTheDocument();
  });
});
