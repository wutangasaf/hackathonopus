export const DEFAULT_CONTRACTOR = {
  name: "John Smith",
  companyName: "Smith General Contracting",
  licenseNumber: "GC-2024-1001",
} as const;

export type DefaultContractor = typeof DEFAULT_CONTRACTOR;
