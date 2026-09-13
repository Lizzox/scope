import { afterEach, describe, expect, it, vi } from "vitest";
import { aiProposalSchema, createProviderAdapter } from "./provider";

describe("AI provider boundary", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("creates adapters for every MVP provider family", () => {
    expect(createProviderAdapter({ provider: "openai", apiKey: "test" }).id).toBe("openai");
    expect(createProviderAdapter({ provider: "openrouter", apiKey: "test" }).id).toBe("openrouter");
    expect(createProviderAdapter({ provider: "ollama" }).id).toBe("ollama");
    expect(createProviderAdapter({ provider: "anthropic", apiKey: "test" }).id).toBe("anthropic");
    expect(createProviderAdapter({ provider: "gemini", apiKey: "test" }).id).toBe("gemini");
  });

  it("rejects destructive or unknown model operations", () => {
    const result = aiProposalSchema.safeParse({ summary: "Delete everything", operations: [{ id: "1", type: "workspace.delete", workspaceId: crypto.randomUUID() }] });
    expect(result.success).toBe(false);
  });

  it("falls back to another Gemini flash model after a rate limit", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ models: [
        { name: "models/gemini-primary", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-2.5-flash-lite", supportedGenerationMethods: ["generateContent"] },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response("limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "fallback ok" }] } }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createProviderAdapter({ provider: "gemini", apiKey: "test" });
    const result = await adapter.generate({ model: "gemini-primary", input: "status" });
    expect(result.modelUsed).toBe("gemini-2.5-flash-lite");
    expect(result.text).toBe("fallback ok");
  });
});
