import { describe, it, expect } from "vitest";
import {
  buildHref,
  escapeLike,
  filterKeyForStatus,
  kindsFor,
  parseLedgerFilter,
  parseOrderFilter,
  parsePage,
  parseSearch,
  statusesFor,
  LEDGER_FILTERS,
} from "../lib/query";

describe("portal query helpers", () => {
  it("buildHref drops empty values and encodes the rest", () => {
    expect(buildHref("/sales", { range: 30, status: "toship", q: "", page: undefined })).toBe("/sales?range=30&status=toship");
    expect(buildHref("/money", { q: "ads & fees" })).toBe("/money?q=ads+%26+fees");
    expect(buildHref("/sales", {})).toBe("/sales");
  });

  it("parsePage only accepts sane positive integers", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2", "9"])).toBe(2);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-4")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("99999999")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
  });

  it("parseSearch trims and caps length", () => {
    expect(parseSearch("  hello ")).toBe("hello");
    expect(parseSearch("x".repeat(200))).toHaveLength(60);
    expect(parseSearch(undefined)).toBe("");
  });

  it("escapeLike neutralises wildcards", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });

  it("order filters map to status lists and back", () => {
    expect(parseOrderFilter("shipped")).toBe("shipped");
    expect(parseOrderFilter("nope")).toBe("all");
    expect(statusesFor("all")).toBeNull();
    expect(statusesFor("toship")).toEqual(["CONFIRMED", "PACKED"]);
    expect(statusesFor("closed")).toEqual(["CANCELLED", "RETURNED"]);
    expect(filterKeyForStatus("PACKED")).toBe("toship");
    expect(filterKeyForStatus("RETURNED")).toBe("closed");
    expect(filterKeyForStatus("DELIVERED")).toBe("delivered");
  });

  it("ledger filters cover every transaction kind exactly once", () => {
    const all = ["SALE", "RETURN", "EXPENSE", "DEPOSIT", "LOAN", "DRAWING", "REIMBURSEMENT", "SETTLEMENT", "TRANSFER", "PURCHASE", "PRODUCTION", "PAYMENT", "REVERSAL", "OTHER"];
    const covered = LEDGER_FILTERS.flatMap((f) => (f.kinds ? [...f.kinds] : []));
    expect([...covered].sort()).toEqual([...all].sort());
    expect(parseLedgerFilter("expenses")).toBe("expenses");
    expect(parseLedgerFilter("???")).toBe("all");
    expect(kindsFor("in")).toEqual(["DEPOSIT", "LOAN"]);
    expect(kindsFor("all")).toBeNull();
  });
});
