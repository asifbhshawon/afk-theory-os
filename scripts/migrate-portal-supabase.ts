import pg from "pg";
import dotenv from "dotenv";
import { scryptSync, randomBytes } from "crypto";
dotenv.config();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_BACKUP_URL || "";
console.log("Configuring Supabase database:", connectionString.replace(/:[^:]*@/, ":****@"));

const DEFAULT_CATEGORIES = [
  { id: "cat-prod", name: "Production", slug: "production", color: "#3B82F6", icon: "Factory", isShared: true, sortOrder: 1 },
  { id: "cat-fin", name: "Finance", slug: "finance", color: "#10B981", icon: "Wallet", isShared: true, sortOrder: 2 },
  { id: "cat-meet", name: "Partner Meeting", slug: "partner-meeting", color: "#8B5CF6", icon: "Users", isShared: true, sortOrder: 3 },
  { id: "cat-sup", name: "Supplier", slug: "supplier", color: "#F59E0B", icon: "Truck", isShared: true, sortOrder: 4 },
  { id: "cat-sales", name: "Sales & Delivery", slug: "sales-delivery", color: "#06B6D4", icon: "ShoppingBag", isShared: true, sortOrder: 5 },
  { id: "cat-mkt", name: "Marketing", slug: "marketing", color: "#EC4899", icon: "Megaphone", isShared: true, sortOrder: 6 },
  { id: "cat-photo", name: "Photoshoot", slug: "photoshoot", color: "#F97316", icon: "Camera", isShared: true, sortOrder: 7 },
  { id: "cat-drop", name: "Product Launch", slug: "product-launch", color: "#E11D48", icon: "Sparkles", isShared: true, sortOrder: 8 },
  { id: "cat-dsgn", name: "Design", slug: "design", color: "#6366F1", icon: "Palette", isShared: true, sortOrder: 9 },
  { id: "cat-pers", name: "Personal", slug: "personal", color: "#6B7280", icon: "User", isShared: false, sortOrder: 10 },
  { id: "cat-gen", name: "General", slug: "general", color: "#5A7352", icon: "Calendar", isShared: true, sortOrder: 11 },
];

const FOUNDING_PARTNERS = [
  {
    id: "partner-shawon",
    name: "Shawon",
    email: "shawon@afktheory.com",
    role: "ADMIN",
    permittedVentureIds: JSON.stringify(["*"]),
    password: process.env.PARTNER_PASSWORD_SHAWON || "AFK-Shawon-2026#ExecutiveKey",
  },
  {
    id: "partner-rafi",
    name: "Rafi",
    email: "rafi@afktheory.com",
    role: "PARTNER",
    permittedVentureIds: JSON.stringify(["VENT-2026-0001", "VENT-2026-0002"]),
    password: process.env.PARTNER_PASSWORD_RAFI || "AFK-Rafi-2026#PartnerKey",
  },
  {
    id: "partner-tousif",
    name: "Tousif",
    email: "tousif@afktheory.com",
    role: "PARTNER",
    permittedVentureIds: JSON.stringify(["VENT-2026-0001"]),
    password: process.env.PARTNER_PASSWORD_TOUSIF || "AFK-Tousif-2026#PartnerKey",
  },
  {
    id: "partner-midhat",
    name: "Midhat",
    email: "midhat@afktheory.com",
    role: "PARTNER",
    permittedVentureIds: JSON.stringify(["VENT-2026-0001"]),
    password: process.env.PARTNER_PASSWORD_MIDHAT || "AFK-Midhat-2026#PartnerKey",
  },
  {
    id: "partner-mueid",
    name: "Mueid",
    email: "mueid@afktheory.com",
    role: "PARTNER",
    permittedVentureIds: JSON.stringify(["VENT-2026-0002"]),
    password: process.env.PARTNER_PASSWORD_MUEID || "AFK-Mueid-2026#PartnerKey",
  },
];

async function seed() {
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    // 1. Seed categories
    console.log("Seeding portal categories...");
    for (const cat of DEFAULT_CATEGORIES) {
      await pool.query(
        `INSERT INTO portal_calendar_categories (id, name, slug, color, icon, is_shared, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING;`,
        [cat.id, cat.name, cat.slug, cat.color, cat.icon, cat.isShared, cat.sortOrder]
      );
    }
    console.log("[OK] Calendar categories seeded.");

    // 2. Seed partners
    console.log("Seeding founding partners...");
    for (const p of FOUNDING_PARTNERS) {
      const hash = hashPassword(p.password);
      await pool.query(
        `INSERT INTO portal_partners (id, name, email, password_hash, role, is_active, permitted_venture_ids)
         VALUES ($1, $2, $3, $4, $5, true, $6::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           password_hash = $4,
           name = $2,
           email = $3,
           role = $5,
           permitted_venture_ids = $6::jsonb;`,
        [p.id, p.name, p.email, hash, p.role, p.permittedVentureIds]
      );
      console.log(`[OK] Partner seeded/updated: ${p.name} (${p.email})`);
    }

    const partners = await pool.query("SELECT id, name, email, role FROM portal_partners;");
    console.log("Current partners in Supabase:", partners.rows);

    await pool.end();
  } catch (err: any) {
    console.error("Seeding failed:", err.message);
    await pool.end();
    process.exit(1);
  }
}

seed();
