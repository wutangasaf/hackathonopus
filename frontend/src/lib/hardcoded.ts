/**
 * Hardcoded identity for the contractor flow. Must match
 * `backend/src/lib/defaultContractor.ts` byte-for-byte — the
 * backend uses this server-side to stamp the contractor snapshot
 * onto every new Draw, and the contractor page header displays
 * the same values.
 */
export const CONTRACTOR_USER = {
  name: "John Smith",
  companyName: "Smith General Contracting",
  licenseNumber: "GC-2024-1001",
} as const;

/**
 * Fallback jobsite coordinates used when the browser fails to return
 * a Geolocation fix within the timeout, or the user declines the
 * permission prompt. Real captures prefer live `navigator.geolocation`.
 * Default is lower Manhattan — swap per deployment if needed.
 */
export const DEMO_JOBSITE_GPS = {
  lat: 40.7128,
  lon: -74.006,
} as const;
