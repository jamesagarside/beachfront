import { screen } from "@testing-library/react";
import { renderWithProviders } from "./test/render.tsx";
import { App } from "./App.tsx";

describe("App", () => {
  it("renders the Beachfront wordmark", () => {
    renderWithProviders(<App />);
    expect(
      screen.getByRole("heading", { name: /beachfront/i }),
    ).toBeInTheDocument();
  });
});
