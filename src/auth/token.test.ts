import {
  clearStoredToken,
  GENERATE_TOKEN_URL,
  getStoredToken,
  storeToken,
} from "./token.ts";

describe("token storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when nothing is stored", () => {
    expect(getStoredToken()).toBeNull();
  });

  it("round-trips a token through localStorage", () => {
    storeToken("github_pat_abc");
    expect(getStoredToken()).toBe("github_pat_abc");
  });

  it("clears the cached token", () => {
    storeToken("github_pat_abc");
    clearStoredToken();
    expect(getStoredToken()).toBeNull();
  });

  it("points the generate link at GitHub's fine-grained PAT page", () => {
    expect(GENERATE_TOKEN_URL).toContain("github.com/settings");
    expect(GENERATE_TOKEN_URL).toContain("personal-access-tokens");
  });
});
