import { addDays } from "date-fns";
import { create } from "zustand";

import type {
  CreateFinancePlanRequest,
  FinancePlan,
  LoanType,
  MilestoneInput,
  PlanDocRef,
  RequiredCompletion,
} from "@/lib/types";

type DraftMilestone = MilestoneInput & { localId: string };

type GanttState = {
  loanType: LoanType;
  loanAmount: number;
  totalBudget: number;
  retainagePct: number;
  retainageStepDownAt: number;
  retainageStepDownTo: number;
  coThresholdSingle: number;
  coThresholdCumulativePct: number;
  materialDelayDays: number;
  cureDaysMonetary: number;
  cureDaysNonMonetary: number;
  kickoffDate: string;
  requiredCompletionDate: string;

  milestones: DraftMilestone[];
  selectedLocalId: string | null;

  seeded: boolean;

  // actions
  hydrateFromPlan(plan: FinancePlan): void;
  seedScaffold(loanAmount?: number): void;
  setField<K extends keyof GanttState>(key: K, value: GanttState[K]): void;
  setMilestoneField<K extends keyof DraftMilestone>(
    localId: string,
    key: K,
    value: DraftMilestone[K],
  ): void;
  addDocRef(localId: string, ref: PlanDocRef): void;
  removeDocRef(localId: string, documentId: string): void;
  select(localId: string | null): void;
  toCreateRequest(): CreateFinancePlanRequest;
  validate(knownPlanDocIds: string[]): string[];
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `m-${Math.random().toString(36).slice(2, 10)}`;

function defaultScaffold(
  kickoff: string,
  loanAmount: number,
): DraftMilestone[] {
  const start = new Date(kickoff);
  const stages: {
    name: string;
    durationDays: number;
    pctOfLoan: number;
    requiredCompletion: RequiredCompletion[];
  }[] = [
    {
      name: "Foundation",
      durationDays: 21,
      pctOfLoan: 10,
      requiredCompletion: [
        { discipline: "STRUCTURAL", elementKindOrId: "foundation", minPct: 95 },
      ],
    },
    {
      name: "Framing",
      durationDays: 28,
      pctOfLoan: 22,
      requiredCompletion: [
        { discipline: "STRUCTURAL", elementKindOrId: "framing", minPct: 95 },
      ],
    },
    {
      name: "Dry-in",
      durationDays: 21,
      pctOfLoan: 36,
      requiredCompletion: [
        { discipline: "ARCHITECTURE", elementKindOrId: "envelope", minPct: 90 },
      ],
    },
    {
      name: "MEP rough",
      durationDays: 28,
      pctOfLoan: 55,
      requiredCompletion: [
        { discipline: "ELECTRICAL", elementKindOrId: "rough", minPct: 85 },
        { discipline: "PLUMBING", elementKindOrId: "rough", minPct: 85 },
      ],
    },
    {
      name: "Insulation + drywall",
      durationDays: 21,
      pctOfLoan: 70,
      requiredCompletion: [
        { discipline: "ARCHITECTURE", elementKindOrId: "insulation", minPct: 95 },
      ],
    },
    {
      name: "Interior finishes",
      durationDays: 28,
      pctOfLoan: 85,
      requiredCompletion: [
        { discipline: "ARCHITECTURE", elementKindOrId: "finishes", minPct: 85 },
      ],
    },
    {
      name: "MEP trim",
      durationDays: 14,
      pctOfLoan: 95,
      requiredCompletion: [
        { discipline: "ELECTRICAL", elementKindOrId: "trim", minPct: 95 },
        { discipline: "PLUMBING", elementKindOrId: "trim", minPct: 95 },
      ],
    },
    {
      name: "Final + closeout",
      durationDays: 14,
      pctOfLoan: 100,
      requiredCompletion: [
        { discipline: "ARCHITECTURE", elementKindOrId: "punch", minPct: 100 },
      ],
    },
  ];

  let cursor = start;
  const prevPct: number[] = [];
  const draft: DraftMilestone[] = stages.map((s, i) => {
    const startDate = cursor;
    const endDate = addDays(cursor, s.durationDays);
    cursor = endDate;
    const prevPctValue = i === 0 ? 0 : prevPct[i - 1];
    const trancheAmount = Math.round(
      loanAmount * ((s.pctOfLoan - prevPctValue) / 100),
    );
    prevPct.push(s.pctOfLoan);
    return {
      localId: newId(),
      sequence: i + 1,
      name: s.name,
      plannedStartDate: startDate.toISOString(),
      plannedCompletionDate: endDate.toISOString(),
      plannedPercentOfLoan: s.pctOfLoan,
      trancheAmount,
      plannedReleasePct: 90,
      planDocRefs: [],
      requiredCompletion: s.requiredCompletion,
      requiredDocs: [],
      status: "pending",
    };
  });

  // Fix rounding drift so sum(trancheAmount) === loanAmount exactly.
  const drift =
    loanAmount - draft.reduce((acc, m) => acc + m.trancheAmount, 0);
  if (draft.length > 0) draft[draft.length - 1].trancheAmount += drift;

  return draft;
}

export const useGanttStore = create<GanttState>((set, get) => ({
  loanType: "residential",
  loanAmount: 1_000_000,
  totalBudget: 1_200_000,
  retainagePct: 10,
  retainageStepDownAt: 50,
  retainageStepDownTo: 5,
  coThresholdSingle: 25_000,
  coThresholdCumulativePct: 5,
  materialDelayDays: 30,
  cureDaysMonetary: 10,
  cureDaysNonMonetary: 15,
  kickoffDate: new Date().toISOString(),
  requiredCompletionDate: addDays(new Date(), 175).toISOString(),

  milestones: [],
  selectedLocalId: null,
  seeded: false,

  hydrateFromPlan(plan) {
    set({
      loanType: plan.loanType,
      loanAmount: plan.loanAmount,
      totalBudget: plan.totalBudget,
      retainagePct: plan.retainagePct,
      retainageStepDownAt: plan.retainageStepDownAt,
      retainageStepDownTo: plan.retainageStepDownTo,
      coThresholdSingle: plan.coThresholdSingle,
      coThresholdCumulativePct: plan.coThresholdCumulativePct,
      materialDelayDays: plan.materialDelayDays,
      cureDaysMonetary: plan.cureDaysMonetary,
      cureDaysNonMonetary: plan.cureDaysNonMonetary,
      kickoffDate: plan.kickoffDate,
      requiredCompletionDate: plan.requiredCompletionDate,
      milestones: plan.milestones.map((m) => ({
        localId: m._id,
        sequence: m.sequence,
        name: m.name,
        plannedStartDate: m.plannedStartDate,
        plannedCompletionDate: m.plannedCompletionDate,
        plannedPercentOfLoan: m.plannedPercentOfLoan,
        trancheAmount: m.trancheAmount,
        plannedReleasePct: m.plannedReleasePct,
        planDocRefs: m.planDocRefs,
        requiredCompletion: m.requiredCompletion,
        requiredDocs: m.requiredDocs,
        status: m.status,
      })),
      seeded: true,
    });
  },

  seedScaffold(loanAmountOverride) {
    const { kickoffDate, loanAmount } = get();
    const amt = loanAmountOverride ?? loanAmount;
    set({
      loanAmount: amt,
      milestones: defaultScaffold(kickoffDate, amt),
      seeded: true,
    });
  },

  setField(key, value) {
    set({ [key]: value } as Partial<GanttState>);
    // If loanAmount changes, rescale tranche amounts proportionally.
    if (key === "loanAmount" && typeof value === "number") {
      const { milestones } = get();
      const oldTotal = milestones.reduce((acc, m) => acc + m.trancheAmount, 0);
      if (oldTotal > 0 && oldTotal !== value) {
        const scale = value / oldTotal;
        const rescaled = milestones.map((m) => ({
          ...m,
          trancheAmount: Math.round(m.trancheAmount * scale),
        }));
        const drift =
          value - rescaled.reduce((acc, m) => acc + m.trancheAmount, 0);
        if (rescaled.length > 0) {
          rescaled[rescaled.length - 1].trancheAmount += drift;
        }
        set({ milestones: rescaled });
      }
    }
  },

  setMilestoneField(localId, key, value) {
    set((s) => ({
      milestones: s.milestones.map((m) =>
        m.localId === localId ? { ...m, [key]: value } : m,
      ),
    }));
  },

  addDocRef(localId, ref) {
    set((s) => ({
      milestones: s.milestones.map((m) =>
        m.localId === localId
          ? m.planDocRefs.some((r) => r.documentId === ref.documentId)
            ? m
            : { ...m, planDocRefs: [...m.planDocRefs, ref] }
          : m,
      ),
    }));
  },

  removeDocRef(localId, documentId) {
    set((s) => ({
      milestones: s.milestones.map((m) =>
        m.localId === localId
          ? {
              ...m,
              planDocRefs: m.planDocRefs.filter(
                (r) => r.documentId !== documentId,
              ),
            }
          : m,
      ),
    }));
  },

  select(localId) {
    set({ selectedLocalId: localId });
  },

  toCreateRequest() {
    const s = get();
    return {
      loanType: s.loanType,
      loanAmount: s.loanAmount,
      totalBudget: s.totalBudget,
      currency: "USD",
      retainagePct: s.retainagePct,
      retainageStepDownAt: s.retainageStepDownAt,
      retainageStepDownTo: s.retainageStepDownTo,
      coThresholdSingle: s.coThresholdSingle,
      coThresholdCumulativePct: s.coThresholdCumulativePct,
      materialDelayDays: s.materialDelayDays,
      cureDaysMonetary: s.cureDaysMonetary,
      cureDaysNonMonetary: s.cureDaysNonMonetary,
      kickoffDate: s.kickoffDate,
      requiredCompletionDate: s.requiredCompletionDate,
      sov: [],
      milestones: s.milestones.map(({ localId: _localId, ...m }) => m),
    };
  },

  validate(knownPlanDocIds) {
    const s = get();
    const errors: string[] = [];
    if (s.milestones.length === 0) {
      errors.push("At least one milestone is required.");
      return errors;
    }
    // strict monotonic, last === 100
    for (let i = 1; i < s.milestones.length; i += 1) {
      if (
        s.milestones[i].plannedPercentOfLoan <=
        s.milestones[i - 1].plannedPercentOfLoan
      ) {
        errors.push(
          `Milestone ${i + 1} plannedPercentOfLoan must exceed milestone ${i}.`,
        );
      }
    }
    if (
      s.milestones[s.milestones.length - 1].plannedPercentOfLoan !== 100
    ) {
      errors.push("Last milestone plannedPercentOfLoan must equal 100.");
    }
    // sum trancheAmount ≈ loanAmount
    const totalTranche = s.milestones.reduce(
      (acc, m) => acc + m.trancheAmount,
      0,
    );
    if (Math.abs(totalTranche - s.loanAmount) > 1) {
      errors.push(
        `Sum of tranche amounts ($${totalTranche.toLocaleString()}) must equal loan amount ($${s.loanAmount.toLocaleString()}).`,
      );
    }
    // date ordering
    for (const m of s.milestones) {
      if (
        new Date(m.plannedStartDate).getTime() >
        new Date(m.plannedCompletionDate).getTime()
      ) {
        errors.push(
          `Milestone "${m.name}" starts after it ends.`,
        );
      }
    }
    // known doc refs
    const known = new Set(knownPlanDocIds);
    for (const m of s.milestones) {
      for (const ref of m.planDocRefs) {
        if (!known.has(ref.documentId)) {
          errors.push(
            `Milestone "${m.name}" references a document not in this project.`,
          );
        }
      }
    }
    return errors;
  },
}));
