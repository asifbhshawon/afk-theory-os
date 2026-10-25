export const PARTNER_SESSION_COOKIE = "afk_partner_session";
export const SESSION_TTL_HOURS = 24 * 7; // 7 days

export interface PortalPartner {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  permittedVentureIds: string[];
  avatarUrl?: string | null;
}

export interface FoundingPartnerConfig {
  id: string;
  name: string;
  email: string;
  role: string;
  permittedVentureIds: string[];
}

// Five founding partners with least-privilege venture assignments.
// Passwords are NOT stored in code and must be configured via environment variables or secure onboarding.
export const INITIAL_FOUNDING_PARTNERS: FoundingPartnerConfig[] = [
  {
    id: "partner-shawon",
    name: "Shawon",
    email: "shawon@afktheory.com",
    role: "ADMIN",
    permittedVentureIds: ["*"], // Full access across all ventures
  },
  {
    id: "partner-rafi",
    name: "Rafi",
    email: "rafi@afktheory.com",
    role: "PARTNER",
    permittedVentureIds: ["VENT-2026-0001", "VENT-2026-0002"],
  },
  {
    id: "partner-tousif",
    name: "Tousif",
    email: "tousif@afktheory.com",
    role: "PARTNER",
    permittedVentureIds: ["VENT-2026-0001"],
  },
  {
    id: "partner-midhat",
    name: "Midhat",
    email: "midhat@afktheory.com",
    role: "PARTNER",
    permittedVentureIds: ["VENT-2026-0001"],
  },
  {
    id: "partner-mueid",
    name: "Mueid",
    email: "mueid@afktheory.com",
    role: "PARTNER",
    permittedVentureIds: ["VENT-2026-0002"],
  },
];
