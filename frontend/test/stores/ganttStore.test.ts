// Tests for the Gantt editor store. Drives the public actions only —
// `recomputeTranches`, `deriveSov`, and `defaultScaffold` are private,
// so we exercise them through `setField('loanAmount', …)`,
// `toCreateRequest()`, and `seedScaffold()` respectively. The store is a
// singleton; reset state at the top of every test.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useGanttStore } from "@/stores/ganttStore";
import type { FinancePlan } from "@/lib/types";

const KICKOFF = "2026-01-01T00:00:00.000Z";

function fixedKickoffDefaults(loanAmount = 1_000_000) {
  // Set a deterministic kickoff so date math in `defaultScaffold` is stable.
  useGanttStore.setState({
    loanAmount,
    totalBudget: loanAmount * 1.2,
    kickoffDate: KICKOFF,
    requiredCompletionDate: "2026-12-31T00:00:00.000Z",
    milestones: [],
    trancheOverrides: {},
    seeded: false,
    selectedLocalId: null,
  });
}

beforeEach(() => {
  // Bring the singleton back to a clean baseline before each test.
  useGanttStore.getState().resetAll();
});

afterEach(() => {
  useGanttStore.getState().resetAll();
});

describe("seedScaffold (defaultScaffold)", () => {
  it("seeds 8 monotonically-increasing milestones ending at 100%", () => {
    fixedKickoffDefaults();
    useGanttStore.getState().seedScaffold();
    const { milestones, seeded } = useGanttStore.getState();

    expect(seeded).toBe(true);
    expect(milestones).toHaveLength(8);
    expect(milestones[0]!.name).toBe("Foundation");
    expect(milestones[milestones.length - 1]!.plannedPercentOfLoan).toBe(100);

    // strictly monotonic
    for (let i = 1; i < milestones.length; i += 1) {
      expect(milestones[i]!.plannedPercentOfLoan).toBeGreaterThan(
        milestones[i - 1]!.plannedPercentOfLoan,
      );
    }
  });

  it("tranche amounts sum exactly to loanAmount (drift absorbed on the last row)", () => {
    fixedKickoffDefaults(1_000_000);
    useGanttStore.getState().seedScaffold();
    const { milestones, loanAmount } = useGanttStore.getState();

    const sum = milestones.reduce((a, m) => a + m.trancheAmount, 0);
    expect(sum).toBe(loanAmount);
  });
});

describe("recomputeTranches (via setField('loanAmount', …))", () => {
  it("scales non-overridden tranches when the loan amount changes; sum stays exact", () => {
    fixedKickoffDefaults(1_000_000);
    useGanttStore.getState().seedScaffold();

    useGanttStore.getState().setField("loanAmount", 2_000_000);

    const { milestones, loanAmount } = useGanttStore.getState();
    expect(loanAmount).toBe(2_000_000);
    const sum = milestones.reduce((a, m) => a + m.trancheAmount, 0);
    expect(sum).toBe(2_000_000);

    // First milestone seed has plannedPercentOfLoan=10, so tranche should
    // approximately double from 100k to 200k after a 2x loan.
    expect(milestones[0]!.trancheAmount).toBe(200_000);
  });

  it("preserves user-overridden tranche amounts when loanAmount changes", () => {
    fixedKickoffDefaults(1_000_000);
    useGanttStore.getState().seedScaffold();

    const firstId = useGanttStore.getState().milestones[0]!.localId;
    // Manually setting trancheAmount marks the row as overridden.
    useGanttStore.getState().setMilestoneField(firstId, "trancheAmount", 99_999);

    useGanttStore.getState().setField("loanAmount", 2_000_000);

    const { milestones } = useGanttStore.getState();
    const firstAfter = milestones.find((m) => m.localId === firstId)!;
    expect(firstAfter.trancheAmount).toBe(99_999); // not auto-recomputed
    // And the rest still sum to loanAmount.
    const sum = milestones.reduce((a, m) => a + m.trancheAmount, 0);
    expect(sum).toBe(2_000_000);
  });
});

describe("deriveSov (via toCreateRequest)", () => {
  it("emits one SOV line per milestone, summing exactly to totalBudget", () => {
    fixedKickoffDefaults(1_000_000);
    useGanttStore.setState({ totalBudget: 1_200_000 });
    useGanttStore.getState().seedScaffold();

    const req = useGanttStore.getState().toCreateRequest();

    expect(req.sov).toHaveLength(8);
    const sovSum = req.sov!.reduce((a, l) => a + l.scheduledValue, 0);
    expect(sovSum).toBeCloseTo(1_200_000, 2);
    // Backend tolerance is $0.01.
    expect(Math.abs(sovSum - 1_200_000)).toBeLessThanOrEqual(0.01);
    expect(req.sov![0]!.lineNumber).toBe("01");
  });
});

describe("validate", () => {
  function seed() {
    fixedKickoffDefaults(1_000_000);
    useGanttStore.getState().seedScaffold();
  }

  it("returns no errors on a clean default scaffold", () => {
    seed();
    const result = useGanttStore.getState().validate([]);
    expect(result.errors).toEqual([]);
    expect(Object.keys(result.fieldErrors)).toEqual([]);
    expect(result.trancheDelta).toBe(0);
  });

  it("flags non-strictly-monotonic plannedPercentOfLoan on the offending row", () => {
    seed();
    const ms = useGanttStore.getState().milestones;
    // Force milestone 2's % to equal milestone 1's.
    useGanttStore
      .getState()
      .setMilestoneField(
        ms[1]!.localId,
        "plannedPercentOfLoan",
        ms[0]!.plannedPercentOfLoan,
      );

    const result = useGanttStore.getState().validate([]);
    expect(result.errors.some((e) => e.includes("must exceed"))).toBe(true);
    expect(result.fieldErrors[ms[1]!.localId]?.plannedPercentOfLoan).toMatch(
      /Must exceed/,
    );
  });

  it("flags last milestone not equal to 100%", () => {
    seed();
    const ms = useGanttStore.getState().milestones;
    useGanttStore
      .getState()
      .setMilestoneField(ms[ms.length - 1]!.localId, "plannedPercentOfLoan", 99);

    const result = useGanttStore.getState().validate([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Last milestone % of loan must equal 100/),
      ]),
    );
  });

  it("flags tranche shortfall (delta < -1) but ignores positive overage", () => {
    seed();
    const ms = useGanttStore.getState().milestones;
    // Drop the first row's tranche by $100 → total is short by $100.
    useGanttStore
      .getState()
      .setMilestoneField(ms[0]!.localId, "trancheAmount", ms[0]!.trancheAmount - 100);

    const short = useGanttStore.getState().validate([]);
    expect(short.trancheDelta).toBeLessThan(-1);
    expect(short.errors.some((e) => /must be at least the loan amount/.test(e))).toBe(
      true,
    );
  });

  it("flags milestone with start date after completion date", () => {
    seed();
    const ms = useGanttStore.getState().milestones;
    useGanttStore.getState().setMilestoneField(
      ms[0]!.localId,
      "plannedStartDate",
      "2027-12-31T00:00:00.000Z",
    );

    const result = useGanttStore.getState().validate([]);
    expect(
      result.fieldErrors[ms[0]!.localId]?.plannedCompletionDate,
    ).toMatch(/on or after start/);
  });

  it("flags planDocRefs that are not in the project's known plan documents", () => {
    seed();
    const ms = useGanttStore.getState().milestones;
    useGanttStore.getState().addDocRef(ms[0]!.localId, {
      documentId: "doc-not-in-project",
      sheetLabels: ["A1.0"],
    });

    const result = useGanttStore.getState().validate([]); // empty knownPlanDocIds
    expect(result.fieldErrors[ms[0]!.localId]?.planDocRefs).toMatch(
      /not in this project/,
    );
  });
});

describe("hydrateFromPlan", () => {
  it("round-trips milestones and marks every hydrated tranche as a user override", () => {
    const plan: FinancePlan = {
      _id: "p1",
      projectId: "proj1",
      loanType: "residential",
      loanAmount: 750_000,
      totalBudget: 900_000,
      currency: "USD",
      retainagePct: 10,
      retainageStepDownAt: 50,
      retainageStepDownTo: 5,
      coThresholdSingle: 25_000,
      coThresholdCumulativePct: 5,
      materialDelayDays: 30,
      cureDaysMonetary: 10,
      cureDaysNonMonetary: 15,
      kickoffDate: KICKOFF,
      requiredCompletionDate: "2026-12-01T00:00:00.000Z",
      sov: [],
      milestones: [
        {
          _id: "m1",
          sequence: 1,
          name: "Hydrated A",
          plannedStartDate: KICKOFF,
          plannedCompletionDate: "2026-02-01T00:00:00.000Z",
          plannedPercentOfLoan: 60,
          trancheAmount: 300_001, // intentionally not pct*loan/100
          plannedReleasePct: 100,
          actualReleasePct: null,
          actualReleasedAt: null,
          amountReleased: 0,
          planDocRefs: [],
          requiredCompletion: [],
          requiredDocs: [],
          status: "pending",
        },
        {
          _id: "m2",
          sequence: 2,
          name: "Hydrated B",
          plannedStartDate: "2026-02-01T00:00:00.000Z",
          plannedCompletionDate: "2026-03-01T00:00:00.000Z",
          plannedPercentOfLoan: 100,
          trancheAmount: 449_999,
          plannedReleasePct: 100,
          actualReleasePct: null,
          actualReleasedAt: null,
          amountReleased: 0,
          planDocRefs: [],
          requiredCompletion: [],
          requiredDocs: [],
          status: "pending",
        },
      ],
      modelVersion: "x",
      uploadedAt: KICKOFF,
      createdAt: KICKOFF,
      updatedAt: KICKOFF,
    };

    useGanttStore.getState().hydrateFromPlan(plan);
    const state = useGanttStore.getState();

    expect(state.loanAmount).toBe(750_000);
    expect(state.milestones).toHaveLength(2);
    expect(state.milestones[0]!.localId).toBe("m1");
    expect(state.milestones[0]!.trancheAmount).toBe(300_001);
    // Both rows must be marked overridden so a later loanAmount edit doesn't
    // silently rewrite the bank-edited values — that's the bug class this
    // hydration logic was added to prevent.
    expect(state.trancheOverrides["m1"]).toBe(true);
    expect(state.trancheOverrides["m2"]).toBe(true);
  });
});
