// Unit tests for `validateCrossFields` — the financial-correctness gate the
// verdict pipeline rests on. Hits the only DB query in the function
// (DocumentModel.find for planDocRefs) via vi.spyOn; everything else is pure.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { DocumentModel } from "../../src/models/document.js";
import { validateCrossFields } from "../../src/routes/financePlan.js";
import { mongoQuery } from "../helpers/mongoQuery.js";

type Body = Parameters<typeof validateCrossFields>[1];

const PROJECT_ID = new Types.ObjectId().toString();

function basePlan(overrides: Partial<Body> = {}): Body {
  return {
    loanType: "residential",
    loanAmount: 1_000_000,
    totalBudget: 1_200_000,
    currency: "USD",
    retainagePct: 10,
    retainageStepDownAt: 50,
    retainageStepDownTo: 5,
    coThresholdSingle: 25_000,
    coThresholdCumulativePct: 5,
    materialDelayDays: 30,
    cureDaysMonetary: 10,
    cureDaysNonMonetary: 15,
    kickoffDate: new Date("2026-01-01T00:00:00Z"),
    requiredCompletionDate: new Date("2026-12-31T00:00:00Z"),
    sov: [],
    milestones: [
      {
        sequence: 1,
        name: "Foundation",
        plannedStartDate: new Date("2026-01-01T00:00:00Z"),
        plannedCompletionDate: new Date("2026-02-01T00:00:00Z"),
        plannedPercentOfLoan: 50,
        trancheAmount: 500_000,
        plannedReleasePct: 100,
        planDocRefs: [],
        requiredCompletion: [],
        requiredDocs: [],
        status: "pending",
      },
      {
        sequence: 2,
        name: "Final",
        plannedStartDate: new Date("2026-02-01T00:00:00Z"),
        plannedCompletionDate: new Date("2026-12-30T00:00:00Z"),
        plannedPercentOfLoan: 100,
        trancheAmount: 500_000,
        plannedReleasePct: 100,
        planDocRefs: [],
        requiredCompletion: [],
        requiredDocs: [],
        status: "pending",
      },
    ],
    ...overrides,
  } as Body;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validateCrossFields", () => {
  it("accepts a valid plan with no errors", async () => {
    const errors = await validateCrossFields(PROJECT_ID, basePlan());
    expect(errors).toEqual([]);
  });

  it("flags SOV scheduledValue sum mismatch (>$0.01)", async () => {
    const body = basePlan({
      sov: [
        {
          lineNumber: "01",
          description: "Site work",
          scheduledValue: 600_000,
        },
        {
          lineNumber: "02",
          description: "Building",
          scheduledValue: 500_000, // sum=1.1M, totalBudget=1.2M -> off
        },
      ],
    });
    const errors = await validateCrossFields(PROJECT_ID, body);
    expect(errors).toEqual([
      expect.stringMatching(/SOV scheduledValue sum/),
    ]);
  });

  it("tolerates SOV sum off by less than $0.01", async () => {
    const body = basePlan({
      sov: [
        {
          lineNumber: "01",
          description: "Whole job",
          // 1.2M - 0.005 — within tolerance
          scheduledValue: 1_199_999.995,
        },
      ],
    });
    const errors = await validateCrossFields(PROJECT_ID, body);
    expect(errors).toEqual([]);
  });

  it("flags non-monotonic milestone plannedPercentOfLoan", async () => {
    const body = basePlan({
      milestones: [
        { ...basePlan().milestones[0]!, plannedPercentOfLoan: 60 },
        { ...basePlan().milestones[1]!, plannedPercentOfLoan: 60 }, // same as previous → not strictly monotonic
      ],
    });
    const errors = await validateCrossFields(PROJECT_ID, body);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/strictly monotonic/),
      ]),
    );
  });

  it("flags final milestone plannedPercentOfLoan != 100", async () => {
    const body = basePlan({
      milestones: [
        { ...basePlan().milestones[0]!, plannedPercentOfLoan: 50 },
        { ...basePlan().milestones[1]!, plannedPercentOfLoan: 90 },
      ],
    });
    const errors = await validateCrossFields(PROJECT_ID, body);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/final milestone plannedPercentOfLoan must equal 100/),
      ]),
    );
  });

  it("flags Σ trancheAmount diverging from loanAmount by more than $1", async () => {
    const body = basePlan({
      milestones: [
        { ...basePlan().milestones[0]!, trancheAmount: 500_000 },
        { ...basePlan().milestones[1]!, trancheAmount: 500_010 }, // off by $10
      ],
    });
    const errors = await validateCrossFields(PROJECT_ID, body);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/sum\(trancheAmount\)/),
      ]),
    );
  });

  it("tolerates Σ trancheAmount off by exactly $1", async () => {
    const body = basePlan({
      milestones: [
        { ...basePlan().milestones[0]!, trancheAmount: 500_000 },
        { ...basePlan().milestones[1]!, trancheAmount: 500_001 }, // off by $1 — boundary OK
      ],
    });
    const errors = await validateCrossFields(PROJECT_ID, body);
    expect(errors).toEqual([]);
  });

  it("flags milestone plannedStartDate after plannedCompletionDate", async () => {
    const body = basePlan();
    body.milestones[0]!.plannedStartDate = new Date("2026-03-01T00:00:00Z");
    body.milestones[0]!.plannedCompletionDate = new Date("2026-02-01T00:00:00Z");
    const errors = await validateCrossFields(PROJECT_ID, body);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/plannedStartDate must be <= plannedCompletionDate/),
      ]),
    );
  });

  it("flags planDocRefs that don't resolve to PLAN documents on this project", async () => {
    const referencedDocId = new Types.ObjectId().toString();
    const findSpy = vi
      .spyOn(DocumentModel, "find")
      // Mongoose `.find().select(...)` chain → return [] meaning no match
      .mockReturnValue(mongoQuery([]) as never);

    const body = basePlan();
    body.milestones[0]!.planDocRefs = [
      { documentId: referencedDocId, sheetLabels: [], notes: undefined },
    ];

    const errors = await validateCrossFields(PROJECT_ID, body);
    expect(findSpy).toHaveBeenCalledTimes(1);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(referencedDocId),
      ]),
    );
  });

  it("accepts planDocRefs that resolve to existing PLAN documents", async () => {
    const referencedDocId = new Types.ObjectId();
    vi.spyOn(DocumentModel, "find").mockReturnValue(
      mongoQuery([{ _id: referencedDocId }]) as never,
    );

    const body = basePlan();
    body.milestones[0]!.planDocRefs = [
      {
        documentId: referencedDocId.toString(),
        sheetLabels: [],
        notes: undefined,
      },
    ];

    const errors = await validateCrossFields(PROJECT_ID, body);
    expect(errors).toEqual([]);
  });
});
