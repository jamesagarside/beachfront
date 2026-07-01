import { afterEach, vi } from "vitest";
import { oauthConfig, parseRepoRef } from "./config.ts";

describe("parseRepoRef", () => {
  it("splits an owner/repo slug", () => {
    expect(parseRepoRef("jamesagarside/beachfront")).toEqual({
      owner: "jamesagarside",
      repo: "beachfront",
    });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseRepoRef("  octocat/hello-world  ")).toEqual({
      owner: "octocat",
      repo: "hello-world",
    });
  });

  it("rejects a slug without a slash", () => {
    expect(() => parseRepoRef("beachfront")).toThrow(/owner\/repo/i);
  });
});

describe("oauthConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns null when nothing is configured", () => {
    vi.stubEnv("VITE_BEACHFRONT_OAUTH_WORKER_URL", "");
    vi.stubEnv("VITE_BEACHFRONT_OAUTH_CLIENT_ID", "");
    expect(oauthConfig()).toBeNull();
  });

  it("returns null when only one of the two is set", () => {
    vi.stubEnv("VITE_BEACHFRONT_OAUTH_WORKER_URL", "https://worker.example/");
    vi.stubEnv("VITE_BEACHFRONT_OAUTH_CLIENT_ID", "");
    expect(oauthConfig()).toBeNull();
  });

  it("returns the trimmed worker url and client id when both are set", () => {
    vi.stubEnv("VITE_BEACHFRONT_OAUTH_WORKER_URL", " https://worker.example/ ");
    vi.stubEnv("VITE_BEACHFRONT_OAUTH_CLIENT_ID", " Iv1.abc ");
    expect(oauthConfig()).toEqual({
      workerUrl: "https://worker.example/",
      clientId: "Iv1.abc",
    });
  });
});
