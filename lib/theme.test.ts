import { describe, expect, it } from "vitest";
import { contrastRatio, validateTheme } from "./theme";

describe("theme validation", () => {
  it("matches the documented dark contrast", () => {
    expect(contrastRatio("#F5F7FA", "#0B0D10")).toBeGreaterThan(18);
  });

  it("rejects inaccessible custom themes", () => {
    const result = validateTheme({ name: "Quiet", background: "#FFFFFF", surface: "#F6F7F9", text: "#BBBBBB", textMuted: "#CCCCCC", accent: "#315FD4", success: "#177245", danger: "#B42318", radius: 12 });
    expect(result.valid).toBe(false);
  });
});
