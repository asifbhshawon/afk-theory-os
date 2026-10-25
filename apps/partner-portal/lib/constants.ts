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

export const INITIAL_FOUNDING_PARTNERS = [
  {
    id: "partner-shawon",
    name: "Shawon",
    email: "shawon@afktheory.com",
    role: "ADMIN",
    permittedVentureIds: ["*"], // Full access across all ventures
    initialPassword: "AFK-Shawon-Executive-2026!",
  },
  {
    id: "partner-rafi",
    name: "Rafi",
    email: "rafi@afktheory.com",
    role: "PARTNER",
    permittedVentureIds: ["VENT-2026-0001", "VENT-2026-0002"],
    initialPassword: "AFK-Rafi-Partner-2026!",
  },
  {
    id: "partner-tousif",
    name: "Tousif",
    email: "tousif@afktheory.com",
    role: "PARTNER",
    permittedVentureIds: ["VENT-2026-0001"],
    initialPassword: "AFK-Tousif-Partner-2026!",
  },
  {
    id: "partner-midhat",
    name: "Midhat",
    email: "midhat@afktheory.com",
    role: "PARTNER",
    permittedVentureIds: ["VENT-2026-0001"],
    initialPassword: "AFK-Midhat-Partner-2026!",
  },
  {
    id: "partner-mueid",
    name: "Mueid",
    email: "mueid@afktheory.com",
    role: "PARTNER",
    permittedVentureIds: ["VENT-2026-0002"],
    initialPassword: "AFK-Mueid-Partner-2026!",
  },
];
