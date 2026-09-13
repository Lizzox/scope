import { z } from "zod";

export type ProviderCapability = "streaming" | "structured-output" | "model-list" | "usage";
export type ProviderErrorCode = "authentication" | "rate_limit" | "context_limit" | "unavailable" | "invalid_response" | "unknown";

export interface ModelInfo { id: string; name: string; contextWindow?: number; inputPriceMicros?: number; outputPriceMicros?: number; }
export interface GenerationRequest { model: string; system?: string; input: string; maxTokens?: number; signal?: AbortSignal; schema?: z.ZodType; }
export interface GenerationResult<T = unknown> { text: string; data?: T; inputTokens?: number; outputTokens?: number; finishReason?: string; modelUsed?: string; }

export interface AIProviderAdapter {
  readonly id: string;
  readonly capabilities: ReadonlySet<ProviderCapability>;
  testConnection(): Promise<{ ok: true; latencyMs: number; models?: ModelInfo[] }>;
  listModels(): Promise<ModelInfo[]>;
  generate<T = unknown>(request: GenerationRequest): Promise<GenerationResult<T>>;
}

export class AIProviderError extends Error {
  constructor(public readonly code: ProviderErrorCode, message: string, public readonly retryable: boolean, public readonly status?: number) { super(message); this.name = "AIProviderError"; }
}

interface OpenAICompatibleOptions { id: string; endpoint: string; apiKey?: string; defaultHeaders?: Record<string, string>; }

export class OpenAICompatibleAdapter implements AIProviderAdapter {
  readonly capabilities = new Set<ProviderCapability>(["streaming", "structured-output", "model-list", "usage"]);
  constructor(private readonly options: OpenAICompatibleOptions) {}
  get id() { return this.options.id; }

  private headers() {
    return { "content-type": "application/json", ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}), ...this.options.defaultHeaders };
  }

  async testConnection() {
    const start = performance.now();
    const models = await this.listModels();
    return { ok: true as const, latencyMs: Math.round(performance.now() - start), models };
  }

  async listModels() {
    const response = await fetch(`${this.options.endpoint.replace(/\/$/, "")}/models`, { headers: this.headers(), signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw normalizeProviderError(response.status);
    const payload = await response.json() as { data?: { id: string }[]; models?: { name: string }[] };
    return (payload.data ?? payload.models?.map((model) => ({ id: model.name })) ?? []).map((model) => ({ id: model.id, name: model.id }));
  }

  async generate<T>(request: GenerationRequest): Promise<GenerationResult<T>> {
    const response = await fetch(`${this.options.endpoint.replace(/\/$/, "")}/chat/completions`, {
      method: "POST", headers: this.headers(), signal: request.signal,
      body: JSON.stringify({ model: request.model, messages: [...(request.system ? [{ role: "system", content: request.system }] : []), { role: "user", content: request.input }], max_tokens: request.maxTokens ?? 4096, response_format: request.schema ? { type: "json_object" } : undefined }),
    });
    if (!response.ok) throw normalizeProviderError(response.status);
    const payload = await response.json() as { choices?: { message?: { content?: string }; finish_reason?: string }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) throw new AIProviderError("invalid_response", "The model returned no content", false);
    let data: T | undefined;
    if (request.schema) {
      try { data = request.schema.parse(JSON.parse(text)) as T; }
      catch { throw new AIProviderError("invalid_response", "The structured model response did not match the requested schema", false); }
    }
    return { text, data, inputTokens: payload.usage?.prompt_tokens, outputTokens: payload.usage?.completion_tokens, finishReason: payload.choices?.[0]?.finish_reason };
  }
}

export class AnthropicAdapter implements AIProviderAdapter {
  readonly id = "anthropic";
  readonly capabilities = new Set<ProviderCapability>(["structured-output", "model-list", "usage"]);
  constructor(private readonly apiKey: string, private readonly endpoint = "https://api.anthropic.com/v1") {}
  private headers() { return { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" }; }
  async testConnection() { const start = performance.now(); const models = await this.listModels(); return { ok: true as const, latencyMs: Math.round(performance.now() - start), models }; }
  async listModels() {
    const response = await fetch(`${this.endpoint}/models?limit=100`, { headers: this.headers(), signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw normalizeProviderError(response.status);
    const payload = await response.json() as { data?: { id: string; display_name?: string }[] };
    return (payload.data ?? []).map((model) => ({ id: model.id, name: model.display_name ?? model.id }));
  }
  async generate<T>(request: GenerationRequest): Promise<GenerationResult<T>> {
    const response = await fetch(`${this.endpoint}/messages`, { method: "POST", headers: this.headers(), signal: request.signal, body: JSON.stringify({ model: request.model, max_tokens: request.maxTokens ?? 4096, system: request.system, messages: [{ role: "user", content: request.schema ? `${request.input}\n\nReturn only valid JSON.` : request.input }] }) });
    if (!response.ok) throw normalizeProviderError(response.status);
    const payload = await response.json() as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number }; stop_reason?: string };
    const text = payload.content?.find((item) => item.type === "text")?.text;
    if (!text) throw new AIProviderError("invalid_response", "The model returned no text content", false);
    const data = request.schema ? parseStructured<T>(text, request.schema) : undefined;
    return { text, data, inputTokens: payload.usage?.input_tokens, outputTokens: payload.usage?.output_tokens, finishReason: payload.stop_reason };
  }
}

export class GeminiAdapter implements AIProviderAdapter {
  readonly id = "gemini";
  readonly capabilities = new Set<ProviderCapability>(["streaming", "structured-output", "model-list", "usage"]);
  constructor(private readonly apiKey: string, private readonly endpoint = "https://generativelanguage.googleapis.com/v1beta") {}
  private headers() { return { "content-type": "application/json", "x-goog-api-key": this.apiKey }; }
  async testConnection() { const start = performance.now(); const models = await this.listModels(); return { ok: true as const, latencyMs: Math.round(performance.now() - start), models }; }
  async listModels() {
    const response = await fetch(`${this.endpoint}/models?pageSize=100`, { headers: this.headers(), signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw normalizeProviderError(response.status);
    const payload = await response.json() as { models?: { name: string; displayName?: string; inputTokenLimit?: number; supportedGenerationMethods?: string[] }[] };
    const excluded = /(tts|image|imagen|banana|veo|lyria|robotics|computer-use|deep-research|antigravity|transcribe|embedding|aqa)/i;
    return (payload.models ?? []).filter((model) => model.name && (!model.supportedGenerationMethods || model.supportedGenerationMethods.includes("generateContent")) && !excluded.test(model.name)).map((model) => ({ id: model.name.replace(/^models\//, ""), name: model.displayName ?? model.name, contextWindow: model.inputTokenLimit }));
  }
  async generate<T>(request: GenerationRequest): Promise<GenerationResult<T>> {
    const requested = request.model.replace(/^models\//, "");
    let candidates = [requested];
    try {
      const available = (await this.listModels()).map((model) => model.id);
      const preferred = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash"];
      candidates = [...new Set([requested, ...preferred.filter((model) => available.includes(model)), ...available.filter((model) => /flash/i.test(model))])].slice(0, 4);
    } catch { /* Generation can still use the explicitly selected model. */ }
    let lastError: unknown;
    for (const model of candidates) {
      try { return await this.generateWithModel<T>(model, request); }
      catch (error) {
        lastError = error;
        if (!(error instanceof AIProviderError) || !["rate_limit", "unavailable", "unknown"].includes(error.code)) throw error;
      }
    }
    throw lastError;
  }
  private async generateWithModel<T>(model: string, request: GenerationRequest): Promise<GenerationResult<T>> {
    const response = await fetch(`${this.endpoint}/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: this.headers(), signal: request.signal, body: JSON.stringify({ systemInstruction: request.system ? { parts: [{ text: request.system }] } : undefined, contents: [{ role: "user", parts: [{ text: request.input }] }], generationConfig: { maxOutputTokens: request.maxTokens ?? 4096, responseMimeType: request.schema ? "application/json" : "text/plain" } }) });
    if (!response.ok) throw normalizeProviderError(response.status);
    const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
    if (!text) throw new AIProviderError("invalid_response", "The model returned no text content", false);
    const data = request.schema ? parseStructured<T>(text, request.schema) : undefined;
    return { text, data, inputTokens: payload.usageMetadata?.promptTokenCount, outputTokens: payload.usageMetadata?.candidatesTokenCount, finishReason: payload.candidates?.[0]?.finishReason, modelUsed: model };
  }
}

export type ProviderConfig =
  | { provider: "openai" | "openrouter" | "ollama" | "compatible"; apiKey?: string; endpoint?: string; headers?: Record<string, string> }
  | { provider: "anthropic"; apiKey: string; endpoint?: string }
  | { provider: "gemini"; apiKey: string; endpoint?: string };

export function createProviderAdapter(config: ProviderConfig): AIProviderAdapter {
  if (config.provider === "anthropic") return new AnthropicAdapter(config.apiKey, config.endpoint);
  if (config.provider === "gemini") return new GeminiAdapter(config.apiKey, config.endpoint);
  const defaults = { openai: "https://api.openai.com/v1", openrouter: "https://openrouter.ai/api/v1", ollama: "http://localhost:11434/v1", compatible: "" } as const;
  const endpoint = config.endpoint ?? defaults[config.provider];
  if (!endpoint) throw new Error("A custom endpoint is required for an OpenAI-compatible provider");
  return new OpenAICompatibleAdapter({ id: config.provider, endpoint, apiKey: config.apiKey, defaultHeaders: config.headers });
}

function parseStructured<T>(text: string, schema: z.ZodType): T {
  try { return schema.parse(JSON.parse(text)) as T; }
  catch { throw new AIProviderError("invalid_response", "The structured model response did not match the requested schema", false); }
}

function normalizeProviderError(status: number) {
  if (status === 401 || status === 403) return new AIProviderError("authentication", "Provider authentication failed", false, status);
  if (status === 429) return new AIProviderError("rate_limit", "Provider rate limit reached", true, status);
  if (status === 400 || status === 413) return new AIProviderError("context_limit", "The request exceeds the provider context limit", false, status);
  if (status >= 500) return new AIProviderError("unavailable", "The provider is currently unavailable", true, status);
  return new AIProviderError("unknown", "The provider request failed", false, status);
}

export const aiOperationSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("task.update"), taskId: z.string().uuid(), patch: z.object({ title: z.string().min(1).max(300).optional(), description: z.string().max(20_000).optional(), status: z.enum(["backlog", "in-progress", "review", "done"]).optional(), priority: z.enum(["low", "medium", "high", "urgent"]).optional(), dueDate: z.string().date().nullable().optional(), assigneeId: z.string().uuid().nullable().optional(), labelIds: z.array(z.string().uuid()).max(50).optional(), milestoneId: z.string().uuid().nullable().optional() }) }),
  z.object({ id: z.string(), type: z.literal("task.create"), projectId: z.string().uuid(), title: z.string().min(1).max(300), description: z.string().max(20_000).default("") }),
  z.object({ id: z.string(), type: z.literal("subtask.create"), taskId: z.string().uuid(), title: z.string().min(1).max(300) }),
  z.object({ id: z.string(), type: z.literal("milestone.create"), projectId: z.string().uuid(), name: z.string().min(1).max(160), description: z.string().max(10_000).default(""), targetDate: z.string().date().nullable().optional() }),
  z.object({ id: z.string(), type: z.literal("dependency.create"), blockerTaskId: z.string().uuid(), blockedTaskId: z.string().uuid() }),
]);

export const aiProposalSchema = z.object({ summary: z.string().min(1).max(600), operations: z.array(aiOperationSchema).max(50) });
