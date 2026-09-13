import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, redactSecrets } from "./secrets";

const previousKey = process.env.SCOPE_ENCRYPTION_KEY;
afterEach(() => { process.env.SCOPE_ENCRYPTION_KEY = previousKey; });

describe("provider secrets", () => {
  it("round-trips with authenticated encryption", () => {
    process.env.SCOPE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptSecret("sk-private-example-value");
    expect(encrypted).not.toContain("private-example");
    expect(decryptSecret(encrypted)).toBe("sk-private-example-value");
  });

  it("redacts common secret shapes from logs", () => {
    expect(redactSecrets("api_key=super-secret-value")).toBe("api_key=[redacted]");
  });
});
