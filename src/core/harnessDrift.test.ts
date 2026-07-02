import {
  computeHarnessDrift,
  updateCommand,
  type HarnessDrift,
} from "./harnessDrift.ts";

const REPO = { owner: "octo", repo: "alpha" };

describe("computeHarnessDrift", () => {
  it("reads current when the installed vintage matches the Tool-repo's", () => {
    const drift = computeHarnessDrift(REPO, "abc1234", "abc1234");
    expect(drift.state).toBe("current");
    expect(drift.installed).toBe("abc1234");
    expect(drift.current).toBe("abc1234");
    // A current repo needs no fix, so no update command is offered.
    expect(drift.fix).toBeNull();
  });

  it("reads behind when a stamped vintage differs from the Tool-repo's", () => {
    const drift = computeHarnessDrift(REPO, "old9999", "abc1234");
    expect(drift.state).toBe("behind");
    expect(drift.installed).toBe("old9999");
    expect(drift.current).toBe("abc1234");
    // A behind repo hints at exactly the fix a Viewer runs.
    expect(drift.fix).toBe("scripts/beachfront-update.sh octo/alpha");
  });

  it("reads unknown when the repo carries no version stamp (older onboard)", () => {
    const drift = computeHarnessDrift(REPO, null, "abc1234");
    expect(drift.state).toBe("unknown");
    expect(drift.installed).toBeNull();
    // We can't be sure it's behind, so we don't push the fix at it.
    expect(drift.fix).toBeNull();
  });

  it("treats a blank or whitespace-only stamp as no stamp (unknown)", () => {
    expect(computeHarnessDrift(REPO, "", "abc1234").state).toBe("unknown");
    expect(computeHarnessDrift(REPO, "   ", "abc1234").state).toBe("unknown");
  });

  it("trims surrounding whitespace before comparing (stamp is a file line)", () => {
    const drift = computeHarnessDrift(REPO, "  abc1234\n", "abc1234");
    expect(drift.state).toBe("current");
    expect(drift.installed).toBe("abc1234");
  });

  it("is unknown, never behind, when the current version itself is unknown", () => {
    // A build that couldn't inject its own vintage can't judge drift honestly.
    const drift = computeHarnessDrift(REPO, "old9999", null);
    expect(drift.state).toBe("unknown");
    expect(drift.fix).toBeNull();
  });
});

describe("updateCommand", () => {
  it("names the exact fix a Viewer runs for a repo", () => {
    expect(updateCommand({ owner: "a", repo: "b" })).toBe(
      "scripts/beachfront-update.sh a/b",
    );
  });
});

describe("HarnessDrift type", () => {
  it("is a discriminated union on state", () => {
    // Compile-time guard that the three states are the surface's contract.
    const states: HarnessDrift["state"][] = ["current", "behind", "unknown"];
    expect(states).toHaveLength(3);
  });
});
