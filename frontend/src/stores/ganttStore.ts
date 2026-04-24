import { addDays } from "date-fns";
import { create } from "zustand";

import type {
  CreateFinancePlanRequest,
  FinancePlan,
  LoanType,
  MilestoneInput,
  PlanDocRef,
  RequiredCompletion,
  SovLine,
} from "@/lib/types";

type DraftMilestone = MilestoneInput & { localId: string };

export type FieldErrorMap = Record<
  string,
  Partial<
    Record<
      | "plannedPercentOfLoan"
      | "trancheAmount"
      | "plannedStartDate"
      | "plannedCompletionDate"
      | "planDocRefs"
      | "name",
      string
    >
  >
>;

export type ValidationResult = {
  errors: string[];
  fieldErrors: FieldErrorMap;
  trancheDelta: number;
};

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

  // Rows whose trancheAmount the user has typed in manually. These rows
  // are NOT auto-recomputed when plannedPercentOfLoan or loanAmount changes.
  trancheOverrides: Record<string, true>;

  // actions
  hydrateFromPlan(plan: FinancePlan): void;
  seedScaffold(loanAmount?: number): void;
  resetScaffold(): void;
  setField<K extends keyof GanttState>(key: K, value: GanttState[K]): void;
  setMilestoneField<K extends keyof DraftMilestone>(
    localId: string,
    key: K,
    value: DraftMilestone[K],
  ): void;
  addMilestone(): void;
  removeMilestone(localId: string): void;
  moveMilestone(localId: string, direction: -1 | 1): void;
  reorderMilestones(fromIndex: number, toIndex: number): void;
  addDocRef(localId: string, ref: PlanDocRef): void;
  removeDocRef(localId: string, documentId: string): void;
  select(localId: string | null): void;
  toCreateRequest(): CreateFinancePlanRequest;
  validate(knownPlanDocIds: string[]): ValidationResult;
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `m-${Math.random().toString(36).slice(2, 10)}`;

function renumber(ms: DraftMilestone[]): DraftMilestone[] {
  return ms.map((m, i) => ({ ...m, sequence: i + 1 }));
}

function trancheFor(
  pctNow: number,
  pctPrev: number,
  loanAmount: number,
): number {
  return Math.round(((pctNow - pctPrev) * loanAmount) / 100);
}

// Recompute every non-overridden row's trancheAmount from pctOfLoan deltas,
// then absorb rounding drift on the last non-overridden row so the sum
// matches loanAmount exactly.
function recomputeTranches(
  milestones: DraftMilestone[],
  overrides: Record<string, true>,
  loanAmount: number,
): DraftMilestone[] {
  const out = milestones.map((m, i) => {
    if (overrides[m.localId]) return m;
    const prev = i === 0 ? 0 : milestones[i - 1].plannedPercentOfLoan;
    return { ...m, trancheAmount: trancheFor(m.plannedPercentOfLoan, prev, loanAmount) };
  });
  const sum = out.reduce((acc, m) => acc + m.trancheAmount, 0);
  const drift = loanAmount - sum;
  if (drift !== 0) {
    for (let i = out.length - 1; i >= 0; i -= 1) {
      if (!overrides[out[i].localId]) {
        out[i] = { ...out[i], trancheAmount: out[i].trancheAmount + drift };
        break;
      }
    }
  }
  return out;
}

// Build a master SOV from the current milestones so the FinancePlan ships
// with one SOV line per milestone. Scales tranche amounts to totalBudget
// (tranches sum to loanAmount; the SOV sum must equal totalBudget) and
// absorbs sub-cent rounding drift on the last row.
function deriveSov(
  milestones: DraftMilestone[],
  totalBudget: number,
  loanAmount: number,
): SovLine[] {
  if (milestones.length === 0) return [];
  const scale = loanAmount > 0 ? totalBudget / loanAmount : 1;
  const lines: SovLine[] = milestones.map((m, i) => ({
    lineNumber: String(i + 1).padStart(2, "0"),
    description: m.name || `Milestone ${i + 1}`,
    scheduledValue: Math.round(m.trancheAmount * scale * 100) / 100,
    cellMappings: [],
  }));
  const sum = lines.reduce((a, l) => a + l.scheduledValue, 0);
  const drift = Math.round((totalBudget - sum) * 100) / 100;
  const last = lines[lines.length - 1];
  last.scheduledValue = Math.round((last.scheduledValue + drift) * 100) / 100;
  return lines;
}

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
    const trancheAmount = trancheFor(s.pctOfLoan, prevPctValue, loanAmount);
    prevPct.push(s.pctOfLoan);
    return {
      localId: newId(),
      sequence: i + 1,
      name: s.name,
      plannedStartDate: startDate.toISOString(),
      plannedCompletionDate: endDate.toISOString(),
      plannedPercentOfLoan: s.pctOfLoan,
      trancheAmount,
      plannedReleasePct: 100,
      planDocRefs: [],
      requiredCompletion: s.requiredCompletion,
      requiredDocs: [],
      status: "pending",
    };
  });

  // Absorb rounding drift on the last row.
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
  trancheOverrides: {},

  hydrateFromPlan(plan) {
    // Treat every hydrated tranche as user-owned. The saved plan may have
    // values that don't match `pct × loan/100` (bank edits, rounding).
    // Auto-recompute would silently clobber those.
    const overrides: Record<string, true> = {};
    const milestones = plan.milestones.map((m) => {
      overrides[m._id] = true;
      return {
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
      } satisfies DraftMilestone;
    });
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
      milestones,
      trancheOverrides: overrides,
      seeded: true,
    });
  },

  seedScaffold(loanAmountOverride) {
    const { kickoffDate, loanAmount } = get();
    const amt = loanAmountOverride ?? loanAmount;
    set({
      loanAmount: amt,
      milestones: defaultScaffold(kickoffDate, amt),
      trancheOverrides: {},
      selectedLocalId: null,
      seeded: true,
    });
  },

  resetScaffold() {
    get().seedScaffold(get().loanAmount);
  },

  setField(key, value) {
    set({ [key]: value } as Partial<GanttState>);
    if (key === "loanAmount" && typeof value === "number") {
      const { milestones, trancheOverrides } = get();
      set({ milestones: recomputeTranches(milestones, trancheOverrides, value) });
    }
  },

  setMilestoneField(localId, key, value) {
    const state = get();
    let overrides = state.trancheOverrides;
    let milestones = state.milestones.map((m) =>
      m.localId === localId ? { ...m, [key]: value } : m,
    );

    if (key === "trancheAmount") {
      overrides = { ...overrides, [localId]: true };
    }

    if (key === "plannedPercentOfLoan") {
      // Editing this row's pct changes both this row's incremental tranche
      // AND the next row's. Recompute all non-overridden rows.
      milestones = recomputeTranches(milestones, overrides, state.loanAmount);
    }

    set({ milestones, trancheOverrides: overrides });
  },

  addMilestone() {
    const state = get();
    const prev = state.milestones[state.milestones.length - 1];
    const prevPct = prev?.plannedPercentOfLoan ?? 0;
    const nextPct = Math.min(100, Math.round((prevPct + (100 - prevPct) / 2) * 10) / 10);
    const prevEnd = prev
      ? new Date(prev.plannedCompletionDate)
      : new Date(state.kickoffDate);
    const newRow: DraftMilestone = {
      localId: newId(),
      sequence: state.milestones.length + 1,
      name: "New milestone",
      plannedStartDate: prevEnd.toISOString(),
      plannedCompletionDate: addDays(prevEnd, 14).toISOString(),
      plannedPercentOfLoan: nextPct,
      trancheAmount: trancheFor(nextPct, prevPct, state.loanAmount),
      plannedReleasePct: 100,
      planDocRefs: [],
      requiredCompletion: [],
      requiredDocs: [],
      status: "pending",
    };
    const milestones = [...state.milestones, newRow];
    set({
      milestones: recomputeTranches(milestones, state.trancheOverrides, state.loanAmount),
      selectedLocalId: newRow.localId,
    });
  },

  removeMilestone(localId) {
    const state = get();
    const filtered = state.milestones.filter((m) => m.localId !== localId);
    const overrides = { ...state.trancheOverrides };
    delete overrides[localId];
    const milestones = recomputeTranches(
      renumber(filtered),
      overrides,
      state.loanAmount,
    );
    set({
      milestones,
      trancheOverrides: overrides,
      selectedLocalId:
        state.selectedLocalId === localId ? null : state.selectedLocalId,
    });
  },

  moveMilestone(localId, direction) {
    const state = get();
    const idx = state.milestones.findIndex((m) => m.localId === localId);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= state.milestones.length) return;
    get().reorderMilestones(idx, targetIdx);
  },

  reorderMilestones(fromIndex, toIndex) {
    const state = get();
    if (fromIndex === toIndex) return;
    const list = state.milestones.slice();
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    set({ milestones: renumber(list) });
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
      sov: deriveSov(s.milestones, s.totalBudget, s.loanAmount),
      milestones: s.milestones.map((m) => ({
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
    };
  },

  validate(knownPlanDocIds) {
    const s = get();
    const errors: string[] = [];
    const fieldErrors: FieldErrorMap = {};
    const setField = (
      localId: string,
      field: keyof FieldErrorMap[string],
      msg: string,
    ) => {
      fieldErrors[localId] = { ...(fieldErrors[localId] ?? {}), [field]: msg };
    };

    const totalTranche = s.milestones.reduce(
      (acc, m) => acc + m.trancheAmount,
      0,
    );
    const trancheDelta = totalTranche - s.loanAmount;

    if (s.milestones.length === 0) {
      errors.push("Add at least one milestone.");
      return { errors, fieldErrors, trancheDelta };
    }

    for (const m of s.milestones) {
      if (!m.name.trim()) {
        setField(m.localId, "name", "Name is required.");
        errors.push(`Milestone ${m.sequence} is missing a name.`);
      } else if (m.name.length > 80) {
        setField(m.localId, "name", "Max 80 characters.");
      }
    }

    for (let i = 1; i < s.milestones.length; i += 1) {
      const curr = s.milestones[i];
      const prev = s.milestones[i - 1];
      if (curr.plannedPercentOfLoan <= prev.plannedPercentOfLoan) {
        setField(
          curr.localId,
          "plannedPercentOfLoan",
          `Must exceed previous (${prev.plannedPercentOfLoan}%).`,
        );
        errors.push(
          `Milestone ${curr.sequence} % of loan must exceed milestone ${prev.sequence}.`,
        );
      }
    }

    const last = s.milestones[s.milestones.length - 1];
    if (last.plannedPercentOfLoan !== 100) {
      setField(
        last.localId,
        "plannedPercentOfLoan",
        "Last milestone must be 100%.",
      );
      errors.push("Last milestone % of loan must equal 100.");
    }

    if (trancheDelta < -1) {
      errors.push(
        `Tranche total $${totalTranche.toLocaleString()} must be at least the loan amount $${s.loanAmount.toLocaleString()} (short by $${Math.abs(trancheDelta).toLocaleString()}).`,
      );
    }

    for (const m of s.milestones) {
      const start = new Date(m.plannedStartDate).getTime();
      const end = new Date(m.plannedCompletionDate).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) {
        setField(m.localId, "plannedStartDate", "Invalid date.");
        errors.push(`Milestone "${m.name || m.sequence}" has an invalid date.`);
      } else if (start > end) {
        setField(
          m.localId,
          "plannedCompletionDate",
          "Must be on or after start.",
        );
        errors.push(
          `Milestone "${m.name || m.sequence}" starts after it ends.`,
        );
      }
    }

    const known = new Set(knownPlanDocIds);
    for (const m of s.milestones) {
      for (const ref of m.planDocRefs) {
        if (!known.has(ref.documentId)) {
          setField(
            m.localId,
            "planDocRefs",
            "References a document not in this project.",
          );
          errors.push(
            `Milestone "${m.name}" references a document not in this project.`,
          );
          break;
        }
      }
    }

    return { errors, fieldErrors, trancheDelta };
  },
}));

function formatSignedUsd(n: number): string {
  const abs = Math.abs(n).toLocaleString();
  return `${n >= 0 ? "+" : "-"}$${abs}`;
}
