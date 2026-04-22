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
  exifMeta?: Record<string, unknown>;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

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

export type Milestone = {
  _id: ObjectIdString;
  sequence: number;
  name: string;
  plannedCompletionDate: IsoDateString;
  plannedPercentOfLoan: number;
  amountReleased: number;
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
  requiredCompletionDate: IsoDateString;
  sov: SovLine[];
  milestones: Milestone[];
  modelVersion: string;
  uploadedAt: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

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

export type UploadFinancePlanResponse = {
  document: DocumentRecord;
  pendingAgents: readonly string[];
  pipelineKickedOff: boolean;
};

export type UploadPhotosResponse = {
  documents: DocumentRecord[];
  pendingAgents: readonly string[];
};

export type PlanFormatList = { formats: PlanFormat[] };
