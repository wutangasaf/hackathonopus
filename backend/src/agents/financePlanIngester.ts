import { readFile } from "node:fs/promises";
import type { Types } from "mongoose";
import * as XLSX from "xlsx";
import {
  DocumentModel,
  type DocumentDoc,
} from "../models/document.js";
import { FinancePlan, LOAN_TYPES } from "../models/financePlan.js";
import { DISCIPLINES } from "../models/planClassification.js";
import { withAgentRun } from "./shared.js";

const AGENT_NAME = "FinancePlanIngester";
const MODEL_VERSION = "finance-plan-ingester/v1";

type KV = Record<string, string>;

const REQUIRED_TABS = [
  "Loan_Terms",
  "SOV",
  "Milestones",
  "Milestone_Requirements",
] as const;

const XLSX_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

function readLoanTerms(ws: XLSX.WorkSheet): KV {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    header: 1,
    blankrows: false,
  });
  const kv: KV = {};
  for (const r of rows) {
    const arr = r as unknown as unknown[];
    if (arr.length < 2) continue;
    const k = String(arr[0] ?? "").trim();
    const v = arr[1];
    if (!k) continue;
    if (v === null || v === undefined) continue;
    kv[k] = typeof v === "string" ? v.trim() : String(v);
  }
  return kv;
}

function requireStr(kv: KV, key: string): string {
  const v = kv[key];
  if (v === undefined || v === "") {
    throw new Error(`Loan_Terms is missing required field: ${key}`);
  }
  return v;
}

function requireNum(kv: KV, key: string): number {
  const raw = requireStr(kv, key);
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Loan_Terms.${key} is not a number: ${raw}`);
  }
  return n;
}

function optionalNum(kv: KV, key: string, fallback: number): number {
  const raw = kv[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Loan_Terms.${key} is not a number: ${raw}`);
  }
  return n;
}

function parseLoanType(raw: string): (typeof LOAN_TYPES)[number] {
  if (!(LOAN_TYPES as readonly string[]).includes(raw)) {
    throw new Error(
      `Loan_Terms.loanType must be one of ${LOAN_TYPES.join(", ")} (got: ${raw})`,
    );
  }
  return raw as (typeof LOAN_TYPES)[number];
}

function parseDiscipline(
  raw: string,
  fieldLabel: string,
): (typeof DISCIPLINES)[number] | undefined {
  if (!raw) return undefined;
  if (!(DISCIPLINES as readonly string[]).includes(raw)) {
    throw new Error(
      `${fieldLabel} must be one of ${DISCIPLINES.join(", ")} (got: ${raw})`,
    );
  }
  return raw as (typeof DISCIPLINES)[number];
}

function parseDate(raw: string, fieldLabel: string): Date {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`${fieldLabel} is not a valid date: ${raw}`);
  }
  return d;
}

type SovRow = {
  lineNumber: string;
  description: string;
  csiCode?: string;
  scheduledValue: number;
  disciplineHint?: (typeof DISCIPLINES)[number];
  zoneHint?: string;
};

function readSov(ws: XLSX.WorkSheet): SovRow[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
  });
  return rows
    .filter(
      (r) =>
        String(r.lineNumber ?? "").trim() !== "" ||
        String(r.description ?? "").trim() !== "",
    )
    .map((r, i) => {
      const desc = String(r.description ?? "").trim();
      if (!desc) {
        throw new Error(`SOV row ${i + 2}: description is required`);
      }
      const scheduledValueRaw = r.scheduledValue;
      const scheduledValue = Number(scheduledValueRaw);
      if (!Number.isFinite(scheduledValue)) {
        throw new Error(
          `SOV row ${i + 2}: scheduledValue is not a number (${String(scheduledValueRaw)})`,
        );
      }
      const disciplineRaw = String(r.disciplineHint ?? "").trim();
      const csi = String(r.csiCode ?? "").trim();
      const zone = String(r.zoneHint ?? "").trim();
      return {
        lineNumber: String(r.lineNumber ?? "").trim() || `${i + 1}`,
        description: desc,
        csiCode: csi || undefined,
        scheduledValue,
        disciplineHint: parseDiscipline(disciplineRaw, `SOV row ${i + 2}.disciplineHint`),
        zoneHint: zone || undefined,
      };
    });
}

type MilestoneRow = {
  sequence: number;
  name: string;
  plannedCompletionDate: Date;
  plannedPercentOfLoan: number;
  status: "pending" | "in_progress" | "claimed" | "verified" | "rejected";
};

const MILESTONE_STATUS_SET = new Set([
  "pending",
  "in_progress",
  "claimed",
  "verified",
  "rejected",
]);

function readMilestones(ws: XLSX.WorkSheet): MilestoneRow[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
  });
  const out = rows
    .filter(
      (r) =>
        String(r.sequence ?? "").trim() !== "" ||
        String(r.name ?? "").trim() !== "",
    )
    .map((r, i) => {
      const seq = Number(r.sequence);
      if (!Number.isInteger(seq) || seq < 1) {
        throw new Error(
          `Milestones row ${i + 2}: sequence must be a positive integer (got: ${String(r.sequence)})`,
        );
      }
      const name = String(r.name ?? "").trim();
      if (!name) throw new Error(`Milestones row ${i + 2}: name is required`);
      const pct = Number(r.plannedPercentOfLoan);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        throw new Error(
          `Milestones row ${i + 2}: plannedPercentOfLoan out of range (got: ${String(r.plannedPercentOfLoan)})`,
        );
      }
      const status = String(r.status ?? "pending").trim();
      if (!MILESTONE_STATUS_SET.has(status)) {
        throw new Error(
          `Milestones row ${i + 2}: invalid status "${status}"`,
        );
      }
      return {
        sequence: seq,
        name,
        plannedCompletionDate: parseDate(
          String(r.plannedCompletionDate),
          `Milestones row ${i + 2}.plannedCompletionDate`,
        ),
        plannedPercentOfLoan: pct,
        status: status as MilestoneRow["status"],
      };
    });
  out.sort((a, b) => a.sequence - b.sequence);
  return out;
}

type RequirementRow = {
  milestoneSequence: number;
  discipline: (typeof DISCIPLINES)[number];
  elementKindOrId: string;
  minPct: number;
  requiredDocs?: string;
};

function readRequirements(ws: XLSX.WorkSheet | undefined): RequirementRow[] {
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
  });
  return rows
    .filter(
      (r) =>
        String(r.milestoneSequence ?? "").trim() !== "" ||
        String(r.discipline ?? "").trim() !== "",
    )
    .map((r, i) => {
      const seq = Number(r.milestoneSequence);
      if (!Number.isInteger(seq) || seq < 1) {
        throw new Error(
          `Milestone_Requirements row ${i + 2}: milestoneSequence must be positive int`,
        );
      }
      const disciplineRaw = String(r.discipline ?? "").trim();
      const d = parseDiscipline(
        disciplineRaw,
        `Milestone_Requirements row ${i + 2}.discipline`,
      );
      if (!d) {
        throw new Error(
          `Milestone_Requirements row ${i + 2}.discipline is required`,
        );
      }
      const el = String(r.elementKindOrId ?? "").trim();
      if (!el) {
        throw new Error(
          `Milestone_Requirements row ${i + 2}.elementKindOrId is required`,
        );
      }
      const minPct = Number(r.minPct);
      if (!Number.isFinite(minPct) || minPct < 0 || minPct > 100) {
        throw new Error(
          `Milestone_Requirements row ${i + 2}.minPct out of range`,
        );
      }
      const docs = String(r.requiredDocs ?? "").trim();
      return {
        milestoneSequence: seq,
        discipline: d,
        elementKindOrId: el,
        minPct,
        requiredDocs: docs || undefined,
      };
    });
}

export type ParsedFinancePlan = ReturnType<typeof shapeFromWorkbook>;

function shapeFromWorkbook(wb: XLSX.WorkBook) {
  for (const tab of REQUIRED_TABS) {
    if (!wb.SheetNames.includes(tab)) {
      throw new Error(`workbook missing required tab "${tab}"`);
    }
  }
  const kv = readLoanTerms(wb.Sheets["Loan_Terms"]!);
  const sov = readSov(wb.Sheets["SOV"]!);
  const milestones = readMilestones(wb.Sheets["Milestones"]!);
  const requirements = readRequirements(wb.Sheets["Milestone_Requirements"]);

  const loanAmount = requireNum(kv, "loanAmount");
  const totalBudget = requireNum(kv, "totalBudget");

  const sovSum = sov.reduce((acc, r) => acc + r.scheduledValue, 0);
  if (Math.abs(sovSum - totalBudget) > 0.01) {
    throw new Error(
      `SOV scheduledValue sum (${sovSum}) does not equal Loan_Terms.totalBudget (${totalBudget})`,
    );
  }

  const lastMilestone = milestones[milestones.length - 1];
  if (!lastMilestone) throw new Error("Milestones sheet is empty");
  if (lastMilestone.plannedPercentOfLoan !== 100) {
    throw new Error(
      `final milestone plannedPercentOfLoan must equal 100 (got ${lastMilestone.plannedPercentOfLoan})`,
    );
  }

  const reqByMilestone = new Map<number, RequirementRow[]>();
  const docsByMilestone = new Map<number, Set<string>>();
  for (const r of requirements) {
    if (!reqByMilestone.has(r.milestoneSequence)) {
      reqByMilestone.set(r.milestoneSequence, []);
      docsByMilestone.set(r.milestoneSequence, new Set());
    }
    reqByMilestone.get(r.milestoneSequence)!.push(r);
    if (r.requiredDocs) {
      docsByMilestone.get(r.milestoneSequence)!.add(r.requiredDocs);
    }
  }
  const milestoneSequences = new Set(milestones.map((m) => m.sequence));
  for (const seq of reqByMilestone.keys()) {
    if (!milestoneSequences.has(seq)) {
      throw new Error(
        `Milestone_Requirements references unknown milestone sequence ${seq}`,
      );
    }
  }

  return {
    loanType: parseLoanType(requireStr(kv, "loanType")),
    loanAmount,
    totalBudget,
    currency: (kv.currency || "USD") as "USD",
    retainagePct: optionalNum(kv, "retainagePct", 10),
    retainageStepDownAt: optionalNum(kv, "retainageStepDownAt", 50),
    retainageStepDownTo: optionalNum(kv, "retainageStepDownTo", 5),
    coThresholdSingle: optionalNum(kv, "coThresholdSingle", 50000),
    coThresholdCumulativePct: optionalNum(kv, "coThresholdCumulativePct", 5),
    materialDelayDays: optionalNum(kv, "materialDelayDays", 60),
    cureDaysMonetary: optionalNum(kv, "cureDaysMonetary", 10),
    cureDaysNonMonetary: optionalNum(kv, "cureDaysNonMonetary", 30),
    requiredCompletionDate: parseDate(
      requireStr(kv, "requiredCompletionDate"),
      "Loan_Terms.requiredCompletionDate",
    ),
    sov,
    milestones: milestones.map((m) => {
      const rs = reqByMilestone.get(m.sequence) ?? [];
      const docs = Array.from(docsByMilestone.get(m.sequence) ?? new Set());
      return {
        sequence: m.sequence,
        name: m.name,
        plannedCompletionDate: m.plannedCompletionDate,
        plannedPercentOfLoan: m.plannedPercentOfLoan,
        amountReleased: 0,
        requiredCompletion: rs.map((r) => ({
          discipline: r.discipline,
          elementKindOrId: r.elementKindOrId,
          minPct: r.minPct,
        })),
        requiredDocs: docs,
        status: m.status,
      };
    }),
  };
}

export async function runFinancePlanIngester(
  projectId: Types.ObjectId | string,
) {
  return withAgentRun(
    { projectId, agentName: AGENT_NAME, modelVersion: MODEL_VERSION },
    async () => {
      const doc = (await DocumentModel.findOne({
        projectId,
        kind: "FINANCE_PLAN",
      }).sort({ serverReceivedAt: -1 })) as DocumentDoc | null;

      if (!doc) {
        throw new Error("no FINANCE_PLAN document for project");
      }

      const isXlsx =
        doc.originalFilename.toLowerCase().endsWith(".xlsx") ||
        XLSX_MIMES.has(doc.mimeType);
      if (!isXlsx) {
        throw new Error(
          `finance plan ingestion currently supports XLSX only (got mimeType=${doc.mimeType}, filename=${doc.originalFilename})`,
        );
      }

      const buf = await readFile(doc.storagePath);
      const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
      const shaped = shapeFromWorkbook(wb);

      await FinancePlan.deleteMany({ projectId });
      const plan = await FinancePlan.create({
        projectId,
        ...shaped,
        modelVersion: MODEL_VERSION,
        uploadedAt: new Date(),
      });

      return {
        financePlanId: plan._id,
        sovLineCount: shaped.sov.length,
        milestoneCount: shaped.milestones.length,
        loanAmount: shaped.loanAmount,
        totalBudget: shaped.totalBudget,
      };
    },
  );
}
