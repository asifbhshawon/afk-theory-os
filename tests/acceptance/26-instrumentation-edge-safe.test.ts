import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Regression guard: Next compiles instrumentation.ts for the Edge runtime too.
// If it (transitively) imports Node-only code (pg, fs, sharp …) the whole app
// fails to compile and every page returns 500. The Node work must live in
// instrumentation-node.ts behind a positive NEXT_RUNTIME === "nodejs" check.
describe("instrumentation stays Edge-safe", () => {
  const read = (f: string) => fs.readFileSync(path.resolve(__dirname, "../../src", f), "utf8");

  it("instrumentation.ts only dynamically imports the Node file inside a positive runtime check", () => {
    const src = read("instrumentation.ts").replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/if\s*\(\s*process\.env\.NEXT_RUNTIME\s*===\s*["']nodejs["']\s*\)\s*\{[^}]*import\(\s*["']\.\/instrumentation-node["']\s*\)/s);
    // no static imports at all, and no direct reference to services / db / pg
    expect(src).not.toMatch(/^\s*import\s/m);
    expect(src).not.toMatch(/@\/server|@\/db|from\s+["']pg["']|from\s+["']fs["']/);
  });

  it("the Node-only start-up work lives in instrumentation-node.ts", () => {
    const src = read("instrumentation-node.ts");
    expect(src).toContain("resumePendingPortalSync");
  });
});
