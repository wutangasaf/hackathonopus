import { writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

const OUT =
  process.argv[2] ?? "/tmp/mock_finance_plan.xlsx";

const loanTermsRows: [string, string | number][] = [
  ["projectName", "Potwine Passive House (mock)"],
  ["borrowerName", "Potwine Builders LLC"],
  ["loanType", "residential"],
  ["loanAmount", 850000],
  ["totalBudget", 1050000],
  ["currency", "USD"],
  ["retainagePct", 10],
  ["retainageStepDownAt", 50],
  ["retainageStepDownTo", 5],
  ["coThresholdSingle", 50000],
  ["coThresholdCumulativePct", 5],
  ["materialDelayDays", 60],
  ["cureDaysMonetary", 10],
  ["cureDaysNonMonetary", 30],
  ["loanClosingDate", "2026-04-20"],
  ["requiredCompletionDate", "2027-04-20"],
];

const sovRows = [
  {
    lineNumber: "001",
    description: "Site prep & staking",
    csiCode: "02 41 00",
    scheduledValue: 25000,
    disciplineHint: "ARCHITECTURE",
    zoneHint: "site-wide",
  },
  {
    lineNumber: "002",
    description: "Underslab plumbing rough-in",
    csiCode: "22 10 00",
    scheduledValue: 38000,
    disciplineHint: "PLUMBING",
    zoneHint: "foundation",
  },
  {
    lineNumber: "003",
    description: "Foundation trench + concrete",
    csiCode: "03 30 00",
    scheduledValue: 140000,
    disciplineHint: "STRUCTURAL",
    zoneHint: "foundation",
  },
  {
    lineNumber: "004",
    description: "Framing",
    csiCode: "06 10 00",
    scheduledValue: 160000,
    disciplineHint: "STRUCTURAL",
    zoneHint: "shell",
  },
  {
    lineNumber: "005",
    description: "Roof + envelope",
    csiCode: "07 00 00",
    scheduledValue: 115000,
    disciplineHint: "ARCHITECTURE",
    zoneHint: "shell",
  },
  {
    lineNumber: "006",
    description: "Rough plumbing (above-slab)",
    csiCode: "22 11 00",
    scheduledValue: 48000,
    disciplineHint: "PLUMBING",
    zoneHint: "interior",
  },
  {
    lineNumber: "007",
    description: "Rough electrical",
    csiCode: "26 05 00",
    scheduledValue: 55000,
    disciplineHint: "ELECTRICAL",
    zoneHint: "interior",
  },
  {
    lineNumber: "008",
    description: "Insulation + air sealing",
    csiCode: "07 21 00",
    scheduledValue: 42000,
    disciplineHint: "ARCHITECTURE",
    zoneHint: "interior",
  },
  {
    lineNumber: "009",
    description: "Drywall + interior finishes",
    csiCode: "09 00 00",
    scheduledValue: 90000,
    disciplineHint: "ARCHITECTURE",
    zoneHint: "interior",
  },
  {
    lineNumber: "010",
    description: "Plumbing fixtures + trim",
    csiCode: "22 40 00",
    scheduledValue: 58000,
    disciplineHint: "PLUMBING",
    zoneHint: "interior",
  },
  {
    lineNumber: "011",
    description: "Electrical fixtures + trim",
    csiCode: "26 50 00",
    scheduledValue: 34000,
    disciplineHint: "ELECTRICAL",
    zoneHint: "interior",
  },
  {
    lineNumber: "012",
    description: "Cabinets + countertops",
    csiCode: "06 40 00",
    scheduledValue: 68000,
    disciplineHint: "ARCHITECTURE",
    zoneHint: "interior",
  },
  {
    lineNumber: "013",
    description: "Builder's GC / overhead",
    csiCode: "",
    scheduledValue: 110000,
    disciplineHint: "ARCHITECTURE",
    zoneHint: "site-wide",
  },
  {
    lineNumber: "014",
    description: "Contingency",
    csiCode: "",
    scheduledValue: 67000,
    disciplineHint: "ARCHITECTURE",
    zoneHint: "site-wide",
  },
];

const milestoneRows = [
  {
    sequence: 1,
    name: "Plumbing rough layout approval (pre-trench)",
    plannedCompletionDate: "2026-05-10",
    plannedPercentOfLoan: 5,
    status: "pending",
  },
  {
    sequence: 2,
    name: "Foundation trench + underslab plumbing",
    plannedCompletionDate: "2026-06-15",
    plannedPercentOfLoan: 15,
    status: "pending",
  },
  {
    sequence: 3,
    name: "Slab + rough framing",
    plannedCompletionDate: "2026-08-15",
    plannedPercentOfLoan: 30,
    status: "pending",
  },
  {
    sequence: 4,
    name: "Dried-in + envelope",
    plannedCompletionDate: "2026-10-15",
    plannedPercentOfLoan: 55,
    status: "pending",
  },
  {
    sequence: 5,
    name: "Rough MEP inspections passed",
    plannedCompletionDate: "2026-12-15",
    plannedPercentOfLoan: 70,
    status: "pending",
  },
  {
    sequence: 6,
    name: "Drywall + insulation",
    plannedCompletionDate: "2027-01-31",
    plannedPercentOfLoan: 82,
    status: "pending",
  },
  {
    sequence: 7,
    name: "Fixtures + finishes",
    plannedCompletionDate: "2027-03-15",
    plannedPercentOfLoan: 95,
    status: "pending",
  },
  {
    sequence: 8,
    name: "Certificate of occupancy + retainage release",
    plannedCompletionDate: "2027-04-20",
    plannedPercentOfLoan: 100,
    status: "pending",
  },
];

const requirementRows = [
  // Milestone 1 — pre-trench plumbing layout sign-off.
  {
    milestoneSequence: 1,
    discipline: "PLUMBING",
    elementKindOrId: "water_closet",
    minPct: 0,
    requiredDocs: "stamped plumbing layout",
  },
  {
    milestoneSequence: 1,
    discipline: "PLUMBING",
    elementKindOrId: "corner_shower",
    minPct: 0,
    requiredDocs: "plumbing layout RFIs closed",
  },
  {
    milestoneSequence: 1,
    discipline: "PLUMBING",
    elementKindOrId: "floor_drain",
    minPct: 0,
    requiredDocs: "",
  },
  {
    milestoneSequence: 1,
    discipline: "PLUMBING",
    elementKindOrId: "countertop_lavatory",
    minPct: 0,
    requiredDocs: "",
  },
  // Milestone 2 — trench + underslab plumbing
  {
    milestoneSequence: 2,
    discipline: "STRUCTURAL",
    elementKindOrId: "foundation",
    minPct: 100,
    requiredDocs: "building-dept foundation inspection",
  },
  {
    milestoneSequence: 2,
    discipline: "PLUMBING",
    elementKindOrId: "underslab_plumbing",
    minPct: 100,
    requiredDocs: "pressure test record",
  },
  // Milestone 3
  {
    milestoneSequence: 3,
    discipline: "STRUCTURAL",
    elementKindOrId: "rough_framing",
    minPct: 100,
    requiredDocs: "framing inspection sign-off",
  },
  // Milestone 4
  {
    milestoneSequence: 4,
    discipline: "ARCHITECTURE",
    elementKindOrId: "roof_sheathing",
    minPct: 100,
    requiredDocs: "",
  },
  {
    milestoneSequence: 4,
    discipline: "ARCHITECTURE",
    elementKindOrId: "windows",
    minPct: 90,
    requiredDocs: "window schedule w/ installer invoice",
  },
  // Milestone 5
  {
    milestoneSequence: 5,
    discipline: "PLUMBING",
    elementKindOrId: "rough_plumbing",
    minPct: 100,
    requiredDocs: "plumbing rough inspection record",
  },
  {
    milestoneSequence: 5,
    discipline: "ELECTRICAL",
    elementKindOrId: "rough_electrical",
    minPct: 100,
    requiredDocs: "electrical rough inspection record",
  },
  // Milestone 6
  {
    milestoneSequence: 6,
    discipline: "ARCHITECTURE",
    elementKindOrId: "insulation_air_sealing",
    minPct: 100,
    requiredDocs: "blower-door test",
  },
  {
    milestoneSequence: 6,
    discipline: "ARCHITECTURE",
    elementKindOrId: "drywall",
    minPct: 95,
    requiredDocs: "",
  },
  // Milestone 7
  {
    milestoneSequence: 7,
    discipline: "PLUMBING",
    elementKindOrId: "water_closet",
    minPct: 100,
    requiredDocs: "executed plumbing lien waiver",
  },
  {
    milestoneSequence: 7,
    discipline: "PLUMBING",
    elementKindOrId: "corner_shower",
    minPct: 100,
    requiredDocs: "",
  },
  {
    milestoneSequence: 7,
    discipline: "ELECTRICAL",
    elementKindOrId: "electrical_trim",
    minPct: 100,
    requiredDocs: "executed electrical lien waiver",
  },
  // Milestone 8
  {
    milestoneSequence: 8,
    discipline: "ARCHITECTURE",
    elementKindOrId: "final_finish",
    minPct: 100,
    requiredDocs: "certificate of occupancy",
  },
];

function main() {
  const sovTotal = sovRows.reduce((a, r) => a + r.scheduledValue, 0);
  const totalBudget = loanTermsRows.find((r) => r[0] === "totalBudget")![1] as number;
  if (sovTotal !== totalBudget) {
    throw new Error(
      `SOV sum ${sovTotal} !== totalBudget ${totalBudget}; adjust SOV rows`,
    );
  }

  const wb = XLSX.utils.book_new();

  const loanTerms = XLSX.utils.aoa_to_sheet([
    ["field", "value"],
    ...loanTermsRows,
  ]);
  XLSX.utils.book_append_sheet(wb, loanTerms, "Loan_Terms");

  const sov = XLSX.utils.json_to_sheet(sovRows, {
    header: [
      "lineNumber",
      "description",
      "csiCode",
      "scheduledValue",
      "disciplineHint",
      "zoneHint",
    ],
  });
  XLSX.utils.book_append_sheet(wb, sov, "SOV");

  const milestones = XLSX.utils.json_to_sheet(milestoneRows, {
    header: [
      "sequence",
      "name",
      "plannedCompletionDate",
      "plannedPercentOfLoan",
      "status",
    ],
  });
  XLSX.utils.book_append_sheet(wb, milestones, "Milestones");

  const reqs = XLSX.utils.json_to_sheet(requirementRows, {
    header: [
      "milestoneSequence",
      "discipline",
      "elementKindOrId",
      "minPct",
      "requiredDocs",
    ],
  });
  XLSX.utils.book_append_sheet(wb, reqs, "Milestone_Requirements");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  writeFileSync(OUT, buf);
  process.stdout.write(`wrote ${OUT}\n`);
  process.stdout.write(
    `sov_sum=$${sovTotal} milestones=${milestoneRows.length} reqs=${requirementRows.length}\n`,
  );
}

main();
