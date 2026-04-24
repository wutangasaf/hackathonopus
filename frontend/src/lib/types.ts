export const DISCIPLINES = [
  "ARCHITECTURE",
  "STRUCTURAL",
  "ELECTRICAL",
  "PLUMBING",
] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const SHEET_ROLES = [
  "PLAN_VIEW",
  "ELEVATION",
  "SECTION",
  "DETAIL",
  "SCHEDULE",
  "OTHER",
] as const;
export type SheetRole = (typeof SHEET_ROLES)[number];

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  ARCHITECTURE: "Architecture",
  STRUCTURAL: "Structural",
  ELECTRICAL: "Electrical",
  PLUMBING: "Plumbing",
};

export const SHEET_ROLE_LABEL: Record<SheetRole, string> = {
  PLAN_VIEW: "Plan",
  ELEVATION: "Elevation",
  SECTION: "Section",
  DETAIL: "Detail",
  SCHEDULE: "Schedule",
  OTHER: "Cover / Notes",
};

export function formatSheetChip(
  s: Pick<ClassifiedSheet, "discipline" | "sheetRole">,
): string {
  return `${DISCIPLINE_LABEL[s.discipline]} ${SHEET_ROLE_LABEL[s.sheetRole]}`;
}

export const DOCUMENT_KINDS = [
  "PLAN",
  "FINANCE_PLAN",
  "SCHEDULE",
  "PHOTO",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const PROJECT_STATUSES = ["SETUP", "ACTIVE", "COMPLETED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const LOAN_TYPES = [
  "residential",
  "commercial_poc",
  "hud_221d4",
  "hybrid",
] as const;
export type LoanType = (typeof LOAN_TYPES)[number];

export const MILESTONE_STATUSES = [
  "pending",
  "in_progress",
  "claimed",
  "verified",
  "rejected",
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const AGENT_RUN_STATUSES = ["running", "succeeded", "failed"] as const;
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

export const PHOTO_QUALITIES = ["GOOD", "NEEDS_RETAKE"] as const;
export type PhotoQuality = (typeof PHOTO_QUALITIES)[number];

export const OBSERVED_STATES = [
  "PRESENT",
  "ABSENT",
  "PARTIAL",
  "DEVIATED",
] as const;
export type ObservedState = (typeof OBSERVED_STATES)[number];

export const PER_ELEMENT_STATUSES = [
  "VERIFIED",
  "PARTIAL",
  "MISSING",
  "DEVIATED",
  "UNVERIFIED",
] as const;
export type PerElementStatus = (typeof PER_ELEMENT_STATUSES)[number];

export const SOV_FLAGS = [
  "ok",
  "minor",
  "material",
  "unapproved_scope",
] as const;
export type SovFlag = (typeof SOV_FLAGS)[number];

export const OVERALL_STATUSES = [
  "ON_TRACK",
  "BEHIND",
  "DEVIATION_FOUND",
  "TECHNICAL_DEFAULT_RISK",
] as const;
export type OverallStatus = (typeof OVERALL_STATUSES)[number];

export const DRAW_VERDICTS = [
  "APPROVE",
  "APPROVE_WITH_CONDITIONS",
  "HOLD",
  "REJECT",
] as const;
export type DrawVerdictValue = (typeof DRAW_VERDICTS)[number];

export const DRAW_STATUSES = [
  "parsing",
  "ready_for_review",
  "approved",
  "rejected",
  "failed",
] as const;
export type DrawStatus = (typeof DRAW_STATUSES)[number];

export const DRAW_LINE_APPROVAL_STATUSES = [
  "pending",
  "confirmed",
  "overridden",
] as const;
export type DrawLineApprovalStatus = (typeof DRAW_LINE_APPROVAL_STATUSES)[number];

export const AGENT_NAMES = [
  "PlanClassifier",
  "PlanFormatExtractor",
  "FinancePlanIngester",
  "PhotoGuidance",
  "PhotoQuality",
  "PhotoToPlanFormat",
  "ComparisonAndGap",
] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

export type ObjectIdString = string;
export type IsoDateString = string;

export type Project = {
  _id: ObjectIdString;
  name: string;
  address?: string;
  status: ProjectStatus;
  currentMilestoneId?: ObjectIdString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type ExifMeta = {
  present: boolean;
  capturedAt?: IsoDateString;
  gps?: { lat: number; lon: number; altitude?: number };
  camera?: { make?: string; model?: string };
  orientation?: number;
  error?: string;
  source?: "exif_verified" | "client_hinted";
  captureSource?:
    | "phone_camera"
    | "desktop_camera"
    | "native_upload"
    | "drone"
    | "iot";
};

export type DocumentRecord = {
  _id: ObjectIdString;
  projectId: ObjectIdString;
  kind: DocumentKind;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  sha256: string;
  serverReceivedAt: IsoDateString;
  uploaderRef?: string;
  exifMeta?: ExifMeta;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export function photoRawUrl(projectId: string, photoId: string): string {
  return `/api/projects/${projectId}/photos/${photoId}/raw`;
}

export type Titleblock = {
  sheetLabel?: string;
  date?: string;
  scale?: string;
  architect?: string;
};

export type ClassifiedSheet = {
  documentId: ObjectIdString;
  pageNumber: number;
  discipline: Discipline;
  sheetRole: SheetRole;
  titleblock: Titleblock;
  notes?: string;
};

export type PlanClassification = {
  _id: ObjectIdString;
  projectId: ObjectIdString;
  version: number;
  sheets: ClassifiedSheet[];
  sourceDocumentIds: ObjectIdString[];
  extractedAt: IsoDateString;
  modelVersion: string;
};

export type PlanElement = {
  elementId: string;
  kind: string;
  identifier: string;
  spec: Record<string, string>;
  location?: string;
  drawingRef?: string;
};

export type PlanFormat = {
  _id: ObjectIdString;
  projectId: ObjectIdString;
  discipline: Discipline;
  version: number;
  elements: PlanElement[];
  inspectorChecklist: string[];
  scaleNotes?: string;
  sourceSheets: string[];
  modelVersion: string;
  extractedAt: IsoDateString;
};

export type CellMapping = {
  discipline: Discipline;
  elementKindOrId: string;
  weight: number;
};

export type SovLine = {
  lineNumber: string;
  description: string;
  csiCode?: string;
  scheduledValue: number;
  disciplineHint?: Discipline;
  zoneHint?: string;
  cellMappings: CellMapping[];
};

export type RequiredCompletion = {
  discipline: Discipline;
  elementKindOrId: string;
  minPct: number;
};

export type PlanDocRef = {
  documentId: ObjectIdString;
  sheetLabels?: string[];
  notes?: string;
};

export type Milestone = {
  _id: ObjectIdString;
  sequence: number;
  name: string;
  plannedStartDate: IsoDateString;
  plannedCompletionDate: IsoDateString;
  plannedPercentOfLoan: number;
  trancheAmount: number;
  plannedReleasePct: number;
  actualReleasePct: number | null;
  actualReleasedAt: IsoDateString | null;
  amountReleased: number;
  planDocRefs: PlanDocRef[];
  requiredCompletion: RequiredCompletion[];
  requiredDocs: string[];
  status: MilestoneStatus;
};

export type FinancePlan = {
  _id: ObjectIdString;
  projectId: ObjectIdString;
  loanType: LoanType;
  loanAmount: number;
  totalBudget: number;
  currency: "USD";
  retainagePct: number;
  retainageStepDownAt: number;
  retainageStepDownTo: number;
  coThresholdSingle: number;
  coThresholdCumulativePct: number;
  materialDelayDays: number;
  cureDaysMonetary: number;
  cureDaysNonMonetary: number;
  kickoffDate: IsoDateString;
  requiredCompletionDate: IsoDateString;
  sov: SovLine[];
  milestones: Milestone[];
  modelVersion: string;
  uploadedAt: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type MilestoneInput = Omit<
  Milestone,
  "_id" | "amountReleased" | "actualReleasePct" | "actualReleasedAt"
> & {
  status?: MilestoneStatus;
};

export type CreateFinancePlanRequest = Omit<
  FinancePlan,
  | "_id"
  | "projectId"
  | "milestones"
  | "modelVersion"
  | "uploadedAt"
  | "createdAt"
  | "updatedAt"
> & {
  milestones: MilestoneInput[];
};

export type PatchMilestoneRequest = Partial<{
  actualReleasePct: number;
  amountReleased: number;
  status: MilestoneStatus;
}>;

export type UsageMeta = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  model: string;
};

export type AgentRun = {
  _id: ObjectIdString;
  projectId: ObjectIdString;
  agentName: string;
  status: AgentRunStatus;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  usage?: UsageMeta;
  modelVersion?: string;
  startedAt: IsoDateString;
  completedAt?: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type UploadPlansResponse = {
  documents: DocumentRecord[];
  pendingAgents: readonly string[];
  pipelineKickedOff: boolean;
};

export type UploadPhotosResponse = {
  documents: DocumentRecord[];
  pendingAgents: readonly string[];
  pipelineKickedOffFor: ObjectIdString[];
};

export type PlanFormatList = { formats: PlanFormat[] };

// ---------- Photo guidance (Agent 4) ----------

export type PhotoGuidanceShot = {
  shotId: string;
  discipline: Discipline;
  target: string;
  framing?: string;
  angle?: string;
  lighting?: string;
  safety?: string;
  referenceElementIds: string[];
  referenceLineNumbers: string[];
};

export type PhotoGuidance = {
  _id: ObjectIdString;
  projectId: ObjectIdString;
  drawId: ObjectIdString;
  shotList: PhotoGuidanceShot[];
  modelVersion: string;
  generatedAt: IsoDateString;
};

// ---------- Photo detail (Agents 5+6) ----------

export type PhotoAssessment = {
  quality: PhotoQuality;
  discipline: Discipline | null;
  matchedShotId?: string;
  phaseFit?: number;
  issues: string[];
  retakeInstructions?: string;
};

export type ObservationMatchedElement = {
  elementId: string;
  observedState: ObservedState;
  observedPct?: number;
  confidence: number;
  evidence: string;
};

export type Observation = {
  matchedElements: ObservationMatchedElement[];
  unexpectedObservations: string[];
  safetyFlags: string[];
};

export type PhotoDetailResponse = {
  document: DocumentRecord;
  assessment: PhotoAssessment | null;
  observation: Observation | null;
};

// ---------- Draw reports (Agent 7) ----------

export type PerElementFinding = {
  discipline: Discipline;
  elementId: string;
  plannedState: string;
  observedState: ObservedState | PerElementStatus | string;
  status: PerElementStatus;
  citations: string[];
};

export type SovLineFinding = {
  sovLineNumber: string;
  claimedPct: number;
  observedPct: number;
  variance: number;
  flag: SovFlag;
  evidencePhotoIds: ObjectIdString[];
};

export type DrawVerdict = {
  verdict: DrawVerdictValue;
  reasoning: string;
  conditions?: string[];
  missingRequirements?: string[];
};

// ---------- Draws (contractor-facing) ----------

export type DrawLine = {
  lineNumber: string;
  description: string;
  csiCode?: string;
  scheduledValue: number;
  pctThisPeriod: number;
  pctCumulative: number;
  amountThisPeriod: number;
  aiSuggestedMilestoneId?: string;
  aiSuggestedDiscipline?: Discipline;
  aiConfidence?: number;
  aiReasoning?: string;
  confirmedMilestoneId?: string;
  approvalStatus: DrawLineApprovalStatus;
};

export type DrawContractorSnapshot = {
  name: string;
  companyName: string;
  licenseNumber?: string;
};

export type Draw = {
  _id: ObjectIdString;
  projectId: ObjectIdString;
  drawNumber: number;
  periodStart: IsoDateString;
  periodEnd: IsoDateString;
  contractor: DrawContractorSnapshot;
  g703DocumentId: ObjectIdString;
  g702DocumentId?: ObjectIdString;
  status: DrawStatus;
  totalAmountRequested?: number;
  lines: DrawLine[];
  extractorRunId?: ObjectIdString;
  extractorError?: string;
  approvedAt?: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type PatchDrawLineRequest = {
  approvalStatus: DrawLineApprovalStatus;
  confirmedMilestoneId?: string;
};

export type GapReport = {
  _id: ObjectIdString;
  projectId: ObjectIdString;
  milestoneId: ObjectIdString;
  perElement: PerElementFinding[];
  sovLineFindings: SovLineFinding[];
  overallStatus: OverallStatus;
  daysOffset?: number;
  loanInBalance: boolean;
  remainingBudget?: number;
  remainingCost?: number;
  unapprovedDeviations: string[];
  narrative: string;
  drawVerdict: DrawVerdict;
  modelVersion: string;
  generatedAt: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};
