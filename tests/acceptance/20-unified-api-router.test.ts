import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, OPTIONS } from "@/app/api/[[...path]]/route";

describe("Unified Catch-All API Router (/api/[[...path]])", () => {
  it("returns 200 API directory on root /api request", async () => {
    const req = new NextRequest("http://localhost:3000/api");
    const res = await GET(req, { params: Promise.resolve({ path: [] }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("online");
    expect(data.name).toMatch(/AFK THEORY Business OS/);
    expect(Array.isArray(data.endpoints)).toBe(true);
    expect(data.endpoints).toContain("GET    /api/health");
  });

  it("routes /api/health to health handler", async () => {
    const req = new NextRequest("http://localhost:3000/api/health");
    const res = await GET(req, { params: Promise.resolve({ path: ["health"] }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("UP");
    expect(data.business).toBe("AFK THEORY");
  });

  it("returns structured 404 for non-existent API routes", async () => {
    const req = new NextRequest("http://localhost:3000/api/unknown-service");
    const res = await GET(req, { params: Promise.resolve({ path: ["unknown-service"] }) });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Not Found");
    expect(data.message).toContain("/api/unknown-service");
    expect(data.availableEndpoints.length).toBeGreaterThan(5);
  });

  it("handles OPTIONS preflight requests cleanly", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Allow")).toContain("GET");
  });

  it("protects /api/backup with 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3000/api/backup", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ path: ["backup"] }) });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
  });
});
