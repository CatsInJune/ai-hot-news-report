import { describe, it, expect } from "vitest";
import { maskEmail } from "./mask";

describe("maskEmail", () => {
  it("常规：保首尾", () => {
    expect(maskEmail("receiver@example.com")).toBe("r***r@example.com");
  });

  it("本地名 2 字符：直接全打掉", () => {
    expect(maskEmail("ab@x.com")).toBe("***@x.com");
  });

  it("本地名 1 字符", () => {
    expect(maskEmail("a@x.com")).toBe("***@x.com");
  });

  it("空 / null / undefined → 空串", () => {
    expect(maskEmail("")).toBe("");
    expect(maskEmail(null)).toBe("");
    expect(maskEmail(undefined)).toBe("");
  });

  it("非邮箱 → ***", () => {
    expect(maskEmail("not-an-email")).toBe("***");
    expect(maskEmail("@x.com")).toBe("***");
    expect(maskEmail("foo@")).toBe("***");
  });

  it("trim 前后空格", () => {
    expect(maskEmail("  bob@x.com  ")).toBe("b***b@x.com");
  });
});
