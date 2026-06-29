import { render, screen } from "@testing-library/react";
import { App } from "./App.tsx";

describe("App", () => {
  it("renders the Beachfront wordmark", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /beachfront/i }),
    ).toBeInTheDocument();
  });
});
